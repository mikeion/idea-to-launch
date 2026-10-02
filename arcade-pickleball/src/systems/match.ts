import { CONFIG, type GameConfig } from "../config"
import { cloneBall, createBall, holdBall, type Ball } from "../entities/Ball"
import {
  idealContactTime,
  isInReach,
  speedWindowScale,
  timingLabel,
  timingQuality,
  type TimedSample,
  type TimingLabel,
} from "../entities/Paddle"
import {
  createPlayer,
  halfCourtBounds,
  isInKitchen,
  movePlayer,
  type MoveBounds,
  type Player,
} from "../entities/Player"
import { predictPath, stepBall } from "./physics"
import { Rng } from "./rng"
import { RallyRules, sideOf, type PointResult } from "./rules"
import { Score } from "./scoring"
import { planServe, planShot } from "./shots"
import { otherPlayer, type Intent, type PlayerId, type ShotType, type Vec3 } from "./types"

export type MatchPhase = "serve" | "rally" | "pointOver" | "gameOver"

export type MatchEvent =
  | { type: "serve"; player: PlayerId }
  | {
      type: "hit"
      player: PlayerId
      shot: ShotType
      quality: number
      timingError: number
      label: TimingLabel
      auto: boolean
      contact: Vec3
    }
  | { type: "whiff"; player: PlayerId }
  | { type: "bounce"; x: number; y: number }
  | { type: "net" }
  | { type: "point"; result: PointResult; points: [number, number] }
  | { type: "gameOver"; winner: PlayerId }

export interface MatchStats {
  rallies: number
  longestRally: number
  longestDinkStreak: number
}

/** How far ahead the paddle looks when judging the ideal contact moment. */
const PREDICT_SECONDS = 1.2

/**
 * One game to 7. Owns the ball, both players, the rules and the score, and is
 * stepped at a fixed rate with each player's intent. No rendering, no Phaser.
 */
export class Match {
  phase: MatchPhase = "serve"
  readonly players: [Player, Player] = [createPlayer(0), createPlayer(1)]
  readonly ball: Ball = createBall()
  readonly score: Score
  readonly rules: RallyRules
  time = 0
  lastPoint: PointResult | null = null
  winner: PlayerId | null = null
  readonly stats: MatchStats = { rallies: 0, longestRally: 0, longestDinkStreak: 0 }

  private phaseTimer = 0
  private rng: Rng
  /** Ball positions since the last hit, used to judge late swings. */
  private history: TimedSample[] = []
  private serveBounds: MoveBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

  constructor(
    readonly cfg: GameConfig = CONFIG,
    seed: number = Date.now(),
    firstServer: PlayerId = 0,
  ) {
    this.rng = new Rng(seed)
    this.score = new Score(cfg, firstServer)
    this.rules = new RallyRules(cfg)
    this.resetForServe()
  }

  get server(): Player {
    return this.players[this.score.server]
  }

  get receiver(): Player {
    return this.players[otherPlayer(this.score.server)]
  }

  step(dt: number, intents: [Intent, Intent]): MatchEvent[] {
    const events: MatchEvent[] = []
    this.time += dt
    switch (this.phase) {
      case "serve":
        this.stepServe(dt, intents, events)
        break
      case "rally":
        this.stepRally(dt, intents, events)
        break
      case "pointOver":
        this.stepFree(dt, intents)
        this.phaseTimer -= dt
        if (this.phaseTimer <= 0) {
          this.winner = this.score.winner()
          if (this.winner !== null) {
            this.phase = "gameOver"
            events.push({ type: "gameOver", winner: this.winner })
          } else {
            this.resetForServe()
          }
        }
        break
      case "gameOver":
        this.stepFree(dt, intents)
        break
    }
    return events
  }

  private resetForServe(): void {
    const { court } = this.cfg
    const server = this.server
    const receiver = this.receiver
    // A player's right-hand side is +x for the near player and -x for the far player.
    const serveSignX = ((this.score.serveFromRight() ? 1 : -1) * server.side) as 1 | -1
    server.x = serveSignX * 1.4
    server.y = server.side * (court.length / 2 + 0.45)
    receiver.x = -serveSignX * 1.4
    receiver.y = receiver.side * (court.length / 2 + 0.5)
    this.serveBounds =
      serveSignX > 0
        ? { minX: 0.15, maxX: court.width / 2, minY: server.y, maxY: server.y }
        : { minX: -court.width / 2, maxX: -0.15, minY: server.y, maxY: server.y }
    for (const p of this.players) {
      p.pendingPress = null
      p.swingTimer = 0
    }
    this.rules.startRally(server.id, -serveSignX as 1 | -1)
    this.history = []
    this.holdBallForServe()
    this.phase = "serve"
  }

  private holdBallForServe(): void {
    const s = this.server
    holdBall(this.ball, { x: s.x + 0.2 * s.side, y: s.y - s.side * 0.35, z: 0.75 })
  }

  private stepServe(dt: number, intents: [Intent, Intent], events: MatchEvent[]): void {
    const server = this.server
    const receiver = this.receiver
    movePlayer(server, intents[server.id], dt, this.serveBounds, this.cfg)
    movePlayer(receiver, intents[receiver.id], dt, halfCourtBounds(receiver, this.cfg), this.cfg)
    this.holdBallForServe()

    const intent = intents[server.id]
    if (!intent.dink && !intent.drive) return
    const plan = planServe(
      server,
      { x: this.ball.x, y: this.ball.y, z: this.ball.z },
      intent.drive,
      this.rules.serveBoxSignX,
      intent.moveX,
      this.rng,
      this.cfg,
    )
    this.launch(plan.velocity)
    this.rules.onServe()
    this.swing(server, intent.drive ? "drive" : "dink")
    this.phase = "rally"
    events.push({ type: "serve", player: server.id })
  }

  private stepRally(dt: number, intents: [Intent, Intent], events: MatchEvent[]): void {
    for (const p of this.players)
      movePlayer(p, intents[p.id], dt, halfCourtBounds(p, this.cfg), this.cfg)

    for (const p of this.players) {
      if (this.phase !== "rally") break
      this.handlePaddle(p, intents[p.id], events)
    }

    for (const e of stepBall(this.ball, dt, this.cfg)) {
      if (e.type === "bounce") events.push({ type: "bounce", x: e.x, y: e.y })
      if (e.type === "net") events.push({ type: "net" })
      if (this.phase !== "rally") continue
      const result = e.type === "bounce" ? this.rules.onBounce(e.x, e.y) : this.rules.onNet()
      if (result) this.endPoint(result, events)
    }
    this.history.push({ time: this.time, x: this.ball.x, y: this.ball.y, z: this.ball.z })
  }

  /** Buffer shot presses, hit when the ball is in reach, and auto-block a ball about to get past. */
  private handlePaddle(p: Player, intent: Intent, events: MatchEvent[]): void {
    const pressed: ShotType | null = intent.drive ? "drive" : intent.dink ? "dink" : null
    if (pressed) p.pendingPress = { shot: pressed, at: this.time }

    const canHit = this.rules.canHit(p.id, this.ball.y) && isInReach(p, this.ball, this.cfg)
    if (canHit && p.pendingPress) {
      this.hit(p, p.pendingPress.shot, p.pendingPress.at, intent, false, events)
      return
    }

    if (p.pendingPress && this.time - p.pendingPress.at > this.cfg.timing.inputBuffer) {
      p.pendingPress = null
      this.swing(p, null)
      events.push({ type: "whiff", player: p.id })
    }

    // DESIGN: the automatic hit only rescues a ball that has already bounced on your
    // side. Volleys always need a button press, so players can let an out ball go
    // and are never auto-faulted for volleying from the kitchen.
    if (canHit && this.rules.bouncesSinceHit === 1 && this.aboutToEscape(p)) {
      this.hit(p, "dink", this.time, intent, true, events)
    }
  }

  private aboutToEscape(p: Player): boolean {
    const next = cloneBall(this.ball)
    const dt = 1 / this.cfg.simHz
    const bounced = stepBall(next, dt, this.cfg).some((e) => e.type === "bounce")
    return bounced || !isInReach(p, next, this.cfg)
  }

  private hit(
    p: Player,
    shot: ShotType,
    pressTime: number,
    intent: Intent,
    auto: boolean,
    events: MatchEvent[],
  ): void {
    const ideal = idealContactTime(p, this.contactSamples(p), this.cfg) ?? this.time
    const timingError = pressTime - ideal
    const windowScale = speedWindowScale(Math.hypot(this.ball.vx, this.ball.vy), this.cfg)
    const quality = auto
      ? this.cfg.timing.autoHitQuality
      : timingQuality(timingError, this.cfg, windowScale)
    const label: TimingLabel = auto ? "LATE" : timingLabel(quality, timingError, this.cfg)
    const contact = {
      x: this.ball.x,
      y: this.ball.y,
      z: Math.max(this.ball.z, this.cfg.ball.radius),
    }

    const result = this.rules.onHit(p.id, shot, isInKitchen(p, this.cfg), !auto)
    const plan = planShot(p, contact, shot, quality, intent.moveX, this.rng, this.cfg)
    this.ball.z = contact.z
    this.launch(plan.velocity)
    p.pendingPress = null
    this.swing(p, shot)
    this.stats.longestDinkStreak = Math.max(this.stats.longestDinkStreak, this.rules.dinkStreak)
    events.push({ type: "hit", player: p.id, shot, quality, timingError, label, auto, contact })
    if (result) this.endPoint(result, events)
  }

  /** Where the ball has been since the last hit plus where it is about to go, on this player's side. */
  private contactSamples(p: Player): TimedSample[] {
    const dt = 1 / this.cfg.simHz
    const bouncesLeft = 2 - this.rules.bouncesSinceHit
    const samples: TimedSample[] = this.history.filter((s) => sideOf(s.y) === p.id)
    samples.push({ time: this.time, x: this.ball.x, y: this.ball.y, z: this.ball.z })
    for (const s of predictPath(this.ball, PREDICT_SECONDS, dt, this.cfg)) {
      if (s.bounces >= bouncesLeft) break
      samples.push({ time: this.time + s.t, x: s.x, y: s.y, z: s.z })
    }
    return samples
  }

  private launch(v: { vx: number; vy: number; vz: number }): void {
    this.ball.vx = v.vx
    this.ball.vy = v.vy
    this.ball.vz = v.vz
    this.ball.rolling = false
    this.history = []
  }

  private swing(p: Player, shot: ShotType | null): void {
    p.swingTimer = 0.22
    p.swingShot = shot
  }

  private endPoint(result: PointResult, events: MatchEvent[]): void {
    this.lastPoint = result
    this.score.pointTo(result.winner)
    this.stats.rallies++
    this.stats.longestRally = Math.max(this.stats.longestRally, this.rules.hits)
    this.phase = "pointOver"
    this.phaseTimer = this.cfg.flow.pointOverDelay
    for (const p of this.players) p.pendingPress = null
    events.push({ type: "point", result, points: [...this.score.points] })
  }

  /** Between points: players can wander, the ball finishes its flight, nothing counts. */
  private stepFree(dt: number, intents: [Intent, Intent]): void {
    for (const p of this.players)
      movePlayer(p, intents[p.id], dt, halfCourtBounds(p, this.cfg), this.cfg)
    stepBall(this.ball, dt, this.cfg)
  }
}
