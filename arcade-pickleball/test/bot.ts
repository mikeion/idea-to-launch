// A simple test-only bot used to check that the rules and tuning produce real
// rallies. It is deliberately dumb: hold the kitchen line, volley-attack balls
// that come in high, otherwise let the ball bounce and dink it, all with noisy
// timing. It is not the Milestone 3 AI.
import type { GameConfig } from "../src/config"
import { idealContactTime, type TimedSample } from "../src/entities/Paddle"
import type { Match } from "../src/systems/match"
import { predictPath, type PathSample } from "../src/systems/physics"
import type { Rng } from "../src/systems/rng"
import { sideOf } from "../src/systems/rules"
import type { Intent, PlayerId, ShotType } from "../src/systems/types"

interface Plan {
  goalX: number
  goalY: number
  shot: ShotType
  /** Only swing at samples with this many bounces since the opponent's hit. */
  bounces: number
}

export class Bot {
  private offset = 0
  private servedAt = -1
  private lastHits = -1
  private plan: Plan | null = null
  private plannedSwing: number | null = null

  constructor(
    private id: PlayerId,
    private rng: Rng,
    /** Standard deviation of timing error, in seconds. */
    private timingNoise = 0.03,
    /** Volley-attack balls passing above this height. */
    private attackHeight = 1.05,
  ) {}

  intent(match: Match): Intent {
    const me = match.players[this.id]
    const cfg = match.cfg
    const out: Intent = { moveX: 0, moveY: 0, dink: false, drive: false }
    const dt = 1 / cfg.simHz

    if (match.phase === "serve") {
      if (match.score.server === this.id && match.time - this.servedAt > 0.5) {
        this.servedAt = match.time
        out.dink = true
      }
      return out
    }

    if (match.rules.hits !== this.lastHits) {
      this.lastHits = match.rules.hits
      this.plan = null
      this.plannedSwing = null
    }

    const ballComing =
      match.phase === "rally" &&
      match.rules.lastHitter !== null &&
      match.rules.lastHitter !== this.id
    let goalX = 0
    let goalY = me.side * (cfg.court.kitchenDepth + 0.3)

    if (ballComing) {
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
          const ideal = idealContactTime(me, samples, cfg)
          if (ideal !== null && ideal > match.time) this.plannedSwing = ideal + this.offset
          if (this.plannedSwing !== null && match.time >= this.plannedSwing - dt / 2) {
            out.drive = this.plan.shot === "drive"
            out.dink = this.plan.shot === "dink"
            this.offset = gaussian(this.rng) * this.timingNoise
            this.plannedSwing = null
          }
        }
      }
    }

    const dx = goalX - me.x
    const dy = goalY - me.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0.05) {
      out.moveX = dx / Math.max(dist, 0.3)
      out.moveY = dy / Math.max(dist, 0.3)
    }
    return out
  }

  private choosePlan(
    match: Match,
    path: PathSample[],
    bounced: number,
    cfg: GameConfig,
  ): Plan | null {
    const me = match.players[this.id]
    const mine = (s: PathSample) => sideOf(s.y) === this.id
    const reachable = (s: PathSample) =>
      Math.hypot(s.x - me.x, s.y - me.y) - cfg.player.reach < cfg.player.moveSpeed * s.t * 0.9

    // A high ball we can get to before it bounces, outside the kitchen: attack it.
    if (bounced === 0) {
      const volley = path.find(
        (s) =>
          mine(s) &&
          s.bounces === 0 &&
          s.z > this.attackHeight &&
          s.z < cfg.player.reachHeight - 0.2 &&
          Math.abs(s.y) > cfg.court.kitchenDepth + 0.15 &&
          reachable(s),
      )
      if (volley)
        return { goalX: volley.x, goalY: volley.y + me.side * 0.3, shot: "drive", bounces: 0 }
    }

    // Otherwise let it bounce. If it sits up high after the bounce, drive it at the
    // top; if not, dink it at a comfortable height.
    const afterBounce = path.filter((s) => mine(s) && s.bounces + bounced === 1)
    const peak = afterBounce.reduce<PathSample | null>((a, s) => (!a || s.z > a.z ? s : a), null)
    if (peak && peak.z > this.attackHeight && peak.z < cfg.player.reachHeight - 0.2) {
      return { goalX: peak.x, goalY: peak.y + me.side * 0.3, shot: "drive", bounces: 1 }
    }
    const spot = afterBounce.find((s) => s.z > 0.25 && s.z < 1.2)
    if (!spot) return null
    return { goalX: spot.x, goalY: spot.y + me.side * 0.3, shot: "dink", bounces: 1 }
  }
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
}
