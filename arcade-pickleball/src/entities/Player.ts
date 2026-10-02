import type { GameConfig } from "../config"
import type { Intent, PlayerId, ShotType } from "../systems/types"

export interface Player {
  id: PlayerId
  /** +1 for the near side (player 1), -1 for the far side (player 2). Also the sign of y on their half. */
  side: 1 | -1
  x: number
  y: number
  /** A shot button pressed shortly before the ball came into reach (input buffer). */
  pendingPress: { shot: ShotType; at: number } | null
  /** Time left on the swing animation, and which shot it was. Purely visual. */
  swingTimer: number
  swingShot: ShotType | null
}

export function createPlayer(id: PlayerId): Player {
  return {
    id,
    side: id === 0 ? 1 : -1,
    x: 0,
    y: 0,
    pendingPress: null,
    swingTimer: 0,
    swingShot: null,
  }
}

/** Optional box a player is confined to (used to keep the server behind the baseline). */
export interface MoveBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** The area a player can normally move in: their own half plus runoff, never touching the net. */
export function halfCourtBounds(player: Player, cfg: GameConfig): MoveBounds {
  const { court, player: p } = cfg
  const halfW = court.width / 2 + court.sideRunoff
  const back = court.length / 2 + court.backRunoff
  const near = p.netGap
  return player.side === 1
    ? { minX: -halfW, maxX: halfW, minY: near, maxY: back }
    : { minX: -halfW, maxX: halfW, minY: -back, maxY: -near }
}

export function movePlayer(
  player: Player,
  intent: Intent,
  dt: number,
  bounds: MoveBounds,
  cfg: GameConfig,
): void {
  let mx = intent.moveX
  let my = intent.moveY
  const len = Math.hypot(mx, my)
  if (len > 1) {
    mx /= len
    my /= len
  }
  const speed = cfg.player.moveSpeed
  player.x = clamp(player.x + mx * speed * dt, bounds.minX, bounds.maxX)
  player.y = clamp(player.y + my * speed * dt, bounds.minY, bounds.maxY)
  player.swingTimer = Math.max(0, player.swingTimer - dt)
}

export function isInKitchen(player: Player, cfg: GameConfig): boolean {
  return Math.abs(player.y) <= cfg.court.kitchenDepth
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
