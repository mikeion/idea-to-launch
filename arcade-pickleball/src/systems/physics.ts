import type { GameConfig } from "../config"
import { cloneBall, type Ball } from "../entities/Ball"
import type { Vec3 } from "./types"

export type PhysicsEvent = { type: "bounce"; x: number; y: number } | { type: "net"; x: number }

/** Advance the ball by dt: gravity, net collision, bounces and rolling. */
export function stepBall(ball: Ball, dt: number, cfg: GameConfig): PhysicsEvent[] {
  const events: PhysicsEvent[] = []
  const { gravity, restitution, bounceFriction, restSpeed, rollFriction } = cfg.ball

  if (ball.rolling) {
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed > 0) {
      const slowed = Math.max(0, speed - rollFriction * dt)
      ball.vx *= slowed / speed
      ball.vy *= slowed / speed
    }
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    return events
  }

  const prevY = ball.y
  const prevZ = ball.z
  ball.vz -= gravity * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  ball.z += ball.vz * dt

  // Net: if the ball crossed y = 0 below the net top, it hits the net and drops back.
  const crossed = (prevY > 0 && ball.y <= 0) || (prevY < 0 && ball.y >= 0)
  if (crossed) {
    const frac = prevY / (prevY - ball.y)
    const zAtNet = prevZ + (ball.z - prevZ) * frac
    if (zAtNet < cfg.court.netHeight) {
      ball.y = Math.sign(prevY) * 0.04
      ball.vy = -ball.vy * 0.15
      ball.vx *= 0.3
      events.push({ type: "net", x: ball.x })
    }
  }

  if (ball.z <= 0 && ball.vz < 0) {
    events.push({ type: "bounce", x: ball.x, y: ball.y })
    ball.z = 0
    ball.vz = -ball.vz * restitution
    ball.vx *= bounceFriction
    ball.vy *= bounceFriction
    if (ball.vz < restSpeed) {
      ball.vz = 0
      ball.rolling = true
    }
  }
  return events
}

export interface PathSample extends Vec3 {
  /** Seconds from the start of the prediction. */
  t: number
  /** Ground contacts so far in this prediction, including any at this sample. */
  bounces: number
}

/** Simulate a copy of the ball forward without touching the real one. */
export function predictPath(
  ball: Ball,
  duration: number,
  dt: number,
  cfg: GameConfig,
): PathSample[] {
  const sim = cloneBall(ball)
  const samples: PathSample[] = []
  let bounces = 0
  for (let t = dt; t <= duration + 1e-9; t += dt) {
    for (const e of stepBall(sim, dt, cfg)) {
      if (e.type === "bounce") bounces++
    }
    samples.push({ t, x: sim.x, y: sim.y, z: sim.z, bounces })
    if (sim.rolling) break
  }
  return samples
}

/** Launch velocity that lands the ball at (tx, ty) after rising to height `apex`. */
export function solveShot(
  from: Vec3,
  tx: number,
  ty: number,
  apex: number,
  gravity: number,
): { vx: number; vy: number; vz: number } {
  const h = Math.max(apex, from.z + 0.02)
  const vz = Math.sqrt(2 * gravity * (h - from.z))
  const flightTime = vz / gravity + Math.sqrt((2 * h) / gravity)
  return { vx: (tx - from.x) / flightTime, vy: (ty - from.y) / flightTime, vz }
}

/** Height of the ball as it passes over the net line, or null if it never crosses. */
export function heightAtNet(
  from: Vec3,
  vel: { vy: number; vz: number },
  gravity: number,
): number | null {
  if (vel.vy === 0) return null
  const t = -from.y / vel.vy
  if (t <= 0) return null
  return from.z + vel.vz * t - 0.5 * gravity * t * t
}

/** Lowest apex for a shot from `from` to (tx, ty) that still passes the net at `minNetZ`. */
export function apexForClearance(
  from: Vec3,
  tx: number,
  ty: number,
  minNetZ: number,
  gravity: number,
): number {
  const clears = (apex: number) => {
    const h = heightAtNet(from, solveShot(from, tx, ty, apex, gravity), gravity)
    return h === null || h >= minNetZ
  }
  let lo = from.z + 0.02
  if (clears(lo)) return lo
  let hi = Math.max(lo + 0.5, 3)
  while (!clears(hi) && hi < 20) hi *= 1.5
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (clears(mid)) hi = mid
    else lo = mid
  }
  return hi
}
