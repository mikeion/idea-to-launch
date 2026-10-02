import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { createBall } from "../src/entities/Ball"
import {
  apexForClearance,
  heightAtNet,
  predictPath,
  solveShot,
  stepBall,
} from "../src/systems/physics"

const g = CONFIG.ball.gravity
const dt = 1 / CONFIG.simHz

describe("ball physics", () => {
  it("lands a solved shot on its target", () => {
    const from = { x: 0.5, y: 2.3, z: 0.4 }
    const v = solveShot(from, -1, -1.2, 1.2, g)
    const ball = { ...createBall(), ...from, ...v }
    const path = predictPath(ball, 3, dt / 4, CONFIG)
    const firstBounce = path.find((s) => s.bounces === 1)!
    expect(firstBounce.x).toBeCloseTo(-1, 1)
    expect(firstBounce.y).toBeCloseTo(-1.2, 1)
  })

  it("finds the lowest apex that clears the net", () => {
    const from = { x: 0, y: 6, z: 0.4 }
    const minNetZ = CONFIG.court.netHeight + 0.1
    const apex = apexForClearance(from, 0, -1.2, minNetZ, g)
    const h = heightAtNet(from, solveShot(from, 0, -1.2, apex, g), g)!
    expect(h).toBeGreaterThanOrEqual(minNetZ - 1e-3)
    expect(h).toBeLessThan(minNetZ + 0.02)
  })

  it("stops a low ball at the net and drops it back", () => {
    const ball = { ...createBall(), y: 1, z: 0.3, vy: -6, vz: 0 }
    let hitNet = false
    for (let i = 0; i < 60; i++) {
      if (stepBall(ball, dt, CONFIG).some((e) => e.type === "net")) hitNet = true
    }
    expect(hitNet).toBe(true)
    expect(ball.y).toBeGreaterThan(0)
  })

  it("bounces lower each time and eventually rolls", () => {
    const ball = { ...createBall(), y: 3, z: 1.5 }
    const heights: number[] = []
    let peak = 0
    for (let i = 0; i < CONFIG.simHz * 5 && !ball.rolling; i++) {
      const bounced = stepBall(ball, dt, CONFIG).some((e) => e.type === "bounce")
      if (bounced) {
        heights.push(peak)
        peak = 0
      }
      peak = Math.max(peak, ball.z)
    }
    expect(ball.rolling).toBe(true)
    for (let i = 2; i < heights.length; i++) expect(heights[i]).toBeLessThan(heights[i - 1])
  })
})
