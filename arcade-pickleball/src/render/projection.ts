import type { GameConfig } from "../config"

export interface ScreenPoint {
  x: number
  y: number
  /** Size multiplier at this depth (far side is smaller). */
  scale: number
}

/** Court coordinates (meters) to screen pixels for the angled top-down (3/4) view. */
export function project(x: number, y: number, z: number, cfg: GameConfig): ScreenPoint {
  const v = cfg.view
  const scale = 1 + y * v.perspective
  return {
    x: v.width / 2 + x * v.pxPerMeterX * scale,
    y: v.netScreenY + y * v.pxPerMeterY - z * v.pxPerMeterZ * scale,
    scale,
  }
}
