// Shared, engine-agnostic types. Nothing in systems/ or entities/ imports Phaser,
// so the rules and tuning carry over if the game moves to another engine.

export type PlayerId = 0 | 1

export type ShotType = "dink" | "drive" | "smash"

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** What a player wants to do this step. Produced by the input layer, consumed by the match. */
export interface Intent {
  /** -1..1, screen-relative: +x is screen right, +y is screen down (toward the near baseline). */
  moveX: number
  moveY: number
  /** True only on the step the button was pressed. */
  dink: boolean
  drive: boolean
  smash: boolean
}

export const IDLE_INTENT: Intent = { moveX: 0, moveY: 0, dink: false, drive: false, smash: false }

export function otherPlayer(id: PlayerId): PlayerId {
  return id === 0 ? 1 : 0
}
