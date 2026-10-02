import type { GameConfig } from "../config"
import type { Player } from "./Player"
import type { Vec3 } from "../systems/types"

// The paddle has no state of its own in Milestone 1: it is the player's reach
// plus the rules for judging when a swing was well timed.

export function horizontalDistance(player: Player, pos: Vec3): number {
  return Math.hypot(pos.x - player.x, pos.y - player.y)
}

export function isInReach(player: Player, pos: Vec3, cfg: GameConfig): boolean {
  return horizontalDistance(player, pos) <= cfg.player.reach && pos.z <= cfg.player.reachHeight
}

/** How far the ball is from the ideal contact point (in front of the body, about waist high). */
export function sweetSpotDistance(player: Player, pos: Vec3, cfg: GameConfig): number {
  const dz = (pos.z - cfg.player.sweetSpotHeight) * cfg.player.sweetSpotHeightWeight
  return Math.hypot(horizontalDistance(player, pos), dz)
}

/**
 * Shot quality from timing error: 1 inside the perfect window, falling linearly
 * to 0 at the edge of the timing window.
 */
export function timingQuality(timingError: number, cfg: GameConfig, windowScale = 1): number {
  const perfectWindow = cfg.timing.perfectWindow * windowScale
  const window = cfg.timing.window * windowScale
  const err = Math.abs(timingError)
  if (err <= perfectWindow) return 1
  return Math.max(0, 1 - (err - perfectWindow) / (window - perfectWindow))
}

/** Timing windows shrink for fast incoming balls. */
export function speedWindowScale(ballSpeed: number, cfg: GameConfig): number {
  const { fastBallSpeed, fastBallMinScale } = cfg.timing
  if (ballSpeed <= fastBallSpeed) return 1
  return Math.max(fastBallMinScale, fastBallSpeed / ballSpeed)
}

export type TimingLabel = "PERFECT" | "GOOD" | "EARLY" | "LATE"

export function timingLabel(quality: number, timingError: number, cfg: GameConfig): TimingLabel {
  if (quality >= cfg.timing.perfectLabel) return "PERFECT"
  if (quality >= cfg.timing.goodLabel) return "GOOD"
  return timingError < 0 ? "EARLY" : "LATE"
}

/** Ball positions with absolute times: where the ball has been and where it is predicted to go. */
export interface TimedSample extends Vec3 {
  time: number
}

/**
 * The moment (absolute time) the ball is best placed for this player to hit:
 * the reachable sample closest to their sweet spot. Returns null if the ball
 * is never reachable in the samples given.
 */
export function idealContactTime(
  player: Player,
  samples: TimedSample[],
  cfg: GameConfig,
): number | null {
  let best: number | null = null
  let bestDist = Infinity
  for (const s of samples) {
    if (!isInReach(player, s, cfg)) continue
    const d = sweetSpotDistance(player, s, cfg)
    if (d < bestDist) {
      bestDist = d
      best = s.time
    }
  }
  return best
}
