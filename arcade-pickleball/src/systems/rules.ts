import type { GameConfig } from "../config"
import { otherPlayer, type PlayerId, type ShotType } from "./types"

export type PointReason =
  | "Out"
  | "Net"
  | "Double bounce"
  | "Kitchen volley"
  | "Short serve"
  | "Wrong service box"
  | "Let it bounce"
  | "Didn't clear the net"

export interface PointResult {
  winner: PlayerId
  reason: PointReason
  /** The player who made the error, or who failed to reach the ball. */
  loser: PlayerId
}

/** The side of the court a y coordinate is on. Player 0 owns y > 0. */
export function sideOf(y: number): PlayerId {
  return y > 0 ? 0 : 1
}

/**
 * Tracks one rally and decides when it ends. Only rules live here: physics
 * reports bounces and net hits, the match reports hits.
 */
export class RallyRules {
  server: PlayerId = 0
  /** Player at the far side of the diagonal the serve must land in, expressed as the sign of x. */
  serveBoxSignX: 1 | -1 = 1
  lastHitter: PlayerId | null = null
  /** Ground contacts since the last hit. */
  bouncesSinceHit = 0
  /** Hits so far this rally; the serve is hit 1. */
  hits = 0
  /** Consecutive dinks this rally (both players). */
  dinkStreak = 0

  constructor(private cfg: GameConfig) {}

  startRally(server: PlayerId, serveBoxSignX: 1 | -1): void {
    this.server = server
    this.serveBoxSignX = serveBoxSignX
    this.lastHitter = null
    this.bouncesSinceHit = 0
    this.hits = 0
    this.dinkStreak = 0
  }

  /** Is this player allowed to touch the ball right now? */
  canHit(player: PlayerId, ballY: number): boolean {
    if (this.lastHitter === null || this.lastHitter === player) return false
    return sideOf(ballY) === player && this.bouncesSinceHit < 2
  }

  onServe(): void {
    this.lastHitter = this.server
    this.bouncesSinceHit = 0
    this.hits = 1
  }

  /** `deliberate` is false for the automatic scramble, which breaks a dink streak. */
  onHit(
    player: PlayerId,
    shot: ShotType,
    playerInKitchen: boolean,
    deliberate = true,
  ): PointResult | null {
    const volley = this.bouncesSinceHit === 0
    this.lastHitter = player
    this.bouncesSinceHit = 0
    this.hits++
    this.dinkStreak = shot === "dink" && deliberate ? this.dinkStreak + 1 : 0

    if (volley && playerInKitchen) return this.fault(player, "Kitchen volley")
    // Hit 2 is the return of serve, hit 3 is the server's third shot.
    if (volley && this.cfg.rules.twoBounceRule && (this.hits === 2 || this.hits === 3)) {
      return this.fault(player, "Let it bounce")
    }
    return null
  }

  onNet(): PointResult | null {
    if (this.lastHitter === null) return null
    return this.fault(this.lastHitter, "Net")
  }

  onBounce(x: number, y: number): PointResult | null {
    if (this.lastHitter === null) return null
    const hitter = this.lastHitter
    const receiver = otherPlayer(hitter)

    if (sideOf(y) === hitter) return this.fault(hitter, "Didn't clear the net")

    this.bouncesSinceHit++
    if (this.bouncesSinceHit >= 2) return this.fault(receiver, "Double bounce")

    // First bounce on the receiver's side: was it in?
    const { width, length, kitchenDepth } = this.cfg.court
    const inCourt = Math.abs(x) <= width / 2 && Math.abs(y) <= length / 2
    if (!inCourt) return this.fault(hitter, "Out")

    if (this.hits === 1) {
      if (Math.abs(y) <= kitchenDepth) return this.fault(hitter, "Short serve")
      if (x * this.serveBoxSignX < 0) return this.fault(hitter, "Wrong service box")
    }
    return null
  }

  private fault(loser: PlayerId, reason: PointReason): PointResult {
    return { winner: otherPlayer(loser), loser, reason }
  }
}
