import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { createBall } from "../src/entities/Ball"
import { pressureWindowScale } from "../src/entities/Paddle"
import { createPlayer } from "../src/entities/Player"
import { predictPath } from "../src/systems/physics"
import { Rng } from "../src/systems/rng"
import { planShot } from "../src/systems/shots"
import type { ShotType, Vec3 } from "../src/systems/types"

const near = { ...createPlayer(0), x: 0, y: 2.6 }

/** Fraction of shots from `contact` that clear the net and land in the opponent's court. */
function successRate(contact: Vec3, shot: ShotType, quality: number, tries = 200) {
  const rng = new Rng(11)
  const { width, length } = CONFIG.court
  let ok = 0
  for (let i = 0; i < tries; i++) {
    const plan = planShot(near, contact, shot, quality, 0, rng, CONFIG)
    const ball = { ...createBall(), ...contact, ...plan.velocity }
    const first = predictPath(ball, 3, 1 / 240, CONFIG).find((s) => s.bounces === 1)
    if (first && first.y < 0 && Math.abs(first.x) <= width / 2 && -first.y <= length / 2) ok++
  }
  return ok / tries
}

function horizontalSpeed(contact: Vec3, shot: ShotType) {
  const v = planShot(near, contact, shot, 1, 0, new Rng(1), CONFIG).velocity
  return Math.hypot(v.vx, v.vy)
}

describe("smash", () => {
  it("is much faster than a drive", () => {
    const high = { x: 0, y: 2.6, z: 2.0 }
    expect(horizontalSpeed(high, "smash")).toBeGreaterThan(horizontalSpeed(high, "drive") * 1.3)
  })

  it("is reliable on a high ball and risky on a low one", () => {
    const high = successRate({ x: 0, y: 2.6, z: 2.0 }, "smash", 0.8)
    const low = successRate({ x: 0, y: 2.6, z: 0.5 }, "smash", 0.8)
    expect(high).toBeGreaterThan(0.85)
    expect(low).toBeLessThan(high - 0.25)
  })
})

describe("pressure", () => {
  it("narrows the timing window as it builds", () => {
    expect(pressureWindowScale(0, CONFIG)).toBe(1)
    expect(pressureWindowScale(0.5, CONFIG)).toBeLessThan(1)
    expect(pressureWindowScale(1, CONFIG)).toBeCloseTo(1 - CONFIG.pressure.maxWindowShrink)
  })
})
