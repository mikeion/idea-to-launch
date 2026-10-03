// CPU player. Engine-agnostic: it reads the Match and returns an Intent, exactly
// like a human's input would. It predicts the ball with the real physics, so all
// of its "skill" comes from deliberate human-like flaws: reaction delay, timing
// noise, positioning error, slower movement and how well it aims.
import type { GameConfig } from "../config"
import { idealContactTime, type TimedSample } from "../entities/Paddle"
import type { Match } from "./match"
import { predictPath, type PathSample } from "./physics"
import type { Rng } from "./rng"
import { sideOf } from "./rules"
import { otherPlayer, type Intent, type PlayerId, type ShotType } from "./types"

export interface CpuProfile {
  /** Seconds after the opponent's hit before the CPU reacts. */
  reactionTime: number
  /** Standard deviation of swing timing error, in seconds. */
  timingNoise: number
  /** Standard deviation of where it decides to stand, in meters. */
  positionError: number
  /** Fraction of full movement speed it uses. */
  speedScale: number
  /** Attacks (drives) balls above this height. */
  attackHeight: number
  /** Smashes (instead of drives) volleys above this height. */
  smashHeight: number
  /** 0..1: how often it aims away from the opponent instead of roughly back at them. */
  aimSkill: number
  /** Ball-machine mode: every Nth shot is a deliberate floater (0 = never). */
  floaterEvery: number
}

interface Plan {
  goalX: number
  goalY: number
  shot: ShotType
  /** Swing at the ball after this many bounces since the opponent's hit (0 = volley). */
  bounces: number
}

export class CpuPlayer {
  private offset = 0
  /** When this CPU started waiting to serve. */
  private serveWaitStart: number | null = null
  private lastHits = -1
  private hitSeenAt = 0
  private plan: Plan | null = null
  private plannedSwing: number | null = null
  private shotsHit = 0

  constructor(
    readonly id: PlayerId,
    private rng: Rng,
    readonly profile: CpuProfile,
  ) {}

  intent(match: Match): Intent {
    const me = match.players[this.id]
    const cfg = match.cfg
    const out: Intent = { moveX: 0, moveY: 0, dink: false, drive: false, smash: false }
    const dt = 1 / cfg.simHz

    if (match.phase === "serve") {
      if (match.score.server !== this.id) return out
      this.serveWaitStart ??= match.time
      if (match.time - this.serveWaitStart > 0.9) {
        this.serveWaitStart = null
        if (this.rng.next() < 0.7) out.dink = true
        else out.drive = true
        out.moveX = this.rng.range(-0.8, 0.8)
      }
      return out
    }
    this.serveWaitStart = null

    if (match.rules.hits !== this.lastHits) {
      this.lastHits = match.rules.hits
      this.hitSeenAt = match.time
      this.plan = null
      this.plannedSwing = null
    }

    const opponent = match.players[otherPlayer(this.id)]
    const ballComing =
      match.phase === "rally" &&
      match.rules.lastHitter !== null &&
      match.rules.lastHitter !== this.id
    // Home: just behind the kitchen line, shading toward the ball.
    let goalX = clamp(match.ball.x * 0.35, -1.5, 1.5)
    let goalY = me.side * (cfg.court.kitchenDepth + 0.3)
    let swing: ShotType | null = null

    if (ballComing && match.time - this.hitSeenAt >= this.profile.reactionTime) {
      const path = predictPath(match.ball, 2.5, dt, cfg)
      const bounced = match.rules.bouncesSinceHit
      if (!this.plan) this.plan = this.choosePlan(match, path, bounced, cfg)
      if (this.plan) {
        goalX = this.plan.goalX
        goalY = this.plan.goalY
        if (Math.hypot(goalX - me.x, goalY - me.y) < 0.5) {
          goalX = me.x
          goalY = me.y
        }
        if (bounced === this.plan.bounces && !me.pendingPress) {
          const samples: TimedSample[] = [
            { time: match.time, x: match.ball.x, y: match.ball.y, z: match.ball.z },
          ]
          for (const s of path) {
            if (s.bounces + bounced > this.plan.bounces) break
            samples.push({ time: match.time + s.t, x: s.x, y: s.y, z: s.z })
          }
          // Keep re-planning while the ideal moment is still ahead, then swing at
          // the planned time (ideal plus this shot's timing noise).
          const sweet =
            this.plan.shot === "smash" ? cfg.smash.sweetSpotHeight : cfg.player.sweetSpotHeight
          const ideal = idealContactTime(me, samples, cfg, sweet)
          if (ideal !== null && ideal > match.time) this.plannedSwing = ideal + this.offset
          if (this.plannedSwing !== null && match.time >= this.plannedSwing - dt / 2) {
            swing = this.plan.shot
            this.plannedSwing = null
            this.shotsHit++
            this.offset = this.nextOffset()
          }
        }
      }
    }

    if (swing) {
      out.dink = swing === "dink"
      out.drive = swing === "drive"
      out.smash = swing === "smash"
      // The stick at the moment of the hit is the aim.
      out.moveX = this.aim(opponent.x)
      return out
    }

    const dx = goalX - me.x
    const dy = goalY - me.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0.05) {
      const speed = this.profile.speedScale
      out.moveX = (dx / Math.max(dist, 0.3)) * speed
      out.moveY = (dy / Math.max(dist, 0.3)) * speed
    }
    return out
  }

  private nextOffset(): number {
    const { floaterEvery, timingNoise } = this.profile
    // Ball machine: deliberately swing late now and then so the player gets a pop-up to smash.
    if (floaterEvery > 0 && (this.shotsHit + 1) % floaterEvery === 0) return 0.17
    return gaussian(this.rng) * timingNoise
  }

  /** Stick x at contact (aim is screen-relative): away from the opponent, or roughly anywhere. */
  private aim(opponentX: number): number {
    if (this.rng.next() < this.profile.aimSkill) {
      const away = opponentX > 0 ? -1 : 1
      return away * this.rng.range(0.5, 1)
    }
    return this.rng.range(-0.5, 0.5)
  }

  private choosePlan(
    match: Match,
    path: PathSample[],
    bounced: number,
    cfg: GameConfig,
  ): Plan | null {
    const me = match.players[this.id]
    const p = this.profile
    const mine = (s: PathSample) => sideOf(s.y) === this.id
    const speed = cfg.player.moveSpeed * p.speedScale
    const reachable = (s: PathSample) =>
      Math.hypot(s.x - me.x, s.y - me.y) - cfg.player.reach < speed * s.t * 0.9
    const err = () => gaussian(this.rng) * p.positionError

    // A high ball we can get to before it bounces, outside the kitchen: attack it.
    if (bounced === 0) {
      const volley = path.find(
        (s) =>
          mine(s) &&
          s.bounces === 0 &&
          s.z > p.attackHeight &&
          s.z < cfg.player.reachHeight - 0.2 &&
          Math.abs(s.y) > cfg.court.kitchenDepth + 0.15 &&
          reachable(s),
      )
      if (volley) {
        const shot: ShotType = volley.z > p.smashHeight ? "smash" : "drive"
        return {
          goalX: volley.x + err(),
          goalY: volley.y + me.side * 0.3 + err(),
          shot,
          bounces: 0,
        }
      }
    }

    // Otherwise let it bounce. If it sits up high after the bounce, drive it at the
    // top; if not, dink it at a comfortable height.
    const afterBounce = path.filter((s) => mine(s) && s.bounces + bounced === 1)
    const peak = afterBounce.reduce<PathSample | null>((a, s) => (!a || s.z > a.z ? s : a), null)
    if (peak && peak.z > p.attackHeight && peak.z < cfg.player.reachHeight - 0.2) {
      return {
        goalX: peak.x + err(),
        goalY: peak.y + me.side * 0.3 + err(),
        shot: "drive",
        bounces: 1,
      }
    }
    const spot = afterBounce.find((s) => s.z > 0.25 && s.z < 1.2)
    if (!spot) return null
    return {
      goalX: spot.x + err(),
      goalY: spot.y + me.side * 0.3 + err(),
      shot: "dink",
      bounces: 1,
    }
  }
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
