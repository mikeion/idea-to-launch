import type { Vec3 } from "../systems/types"

export interface Ball extends Vec3 {
  vx: number
  vy: number
  vz: number
  /** True once the ball has stopped bouncing and is sliding along the ground. */
  rolling: boolean
}

export function createBall(): Ball {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rolling: false }
}

export function cloneBall(ball: Ball): Ball {
  return { ...ball }
}

export function holdBall(ball: Ball, at: Vec3): void {
  ball.x = at.x
  ball.y = at.y
  ball.z = at.z
  ball.vx = 0
  ball.vy = 0
  ball.vz = 0
  ball.rolling = false
}
