import { describe, expect, it } from "vitest"
import { CONFIG, type GameConfig } from "../src/config"
import { RallyRules } from "../src/systems/rules"

function rallyAfterServe(cfg: GameConfig = CONFIG) {
  // Player 0 serves from the near side into the far side's box at x < 0.
  const r = new RallyRules(cfg)
  r.startRally(0, -1)
  r.onServe()
  return r
}

describe("rally rules", () => {
  it("accepts a serve into the diagonal box", () => {
    const r = rallyAfterServe()
    expect(r.onBounce(-1.5, -5)).toBeNull()
  })

  it("faults a serve into the kitchen or the wrong box", () => {
    expect(rallyAfterServe().onBounce(-1.5, -1.5)?.reason).toBe("Short serve")
    expect(rallyAfterServe().onBounce(1.5, -5)?.reason).toBe("Wrong service box")
  })

  it("faults a ball that lands out", () => {
    const r = rallyAfterServe()
    r.onBounce(-1.5, -5)
    r.onHit(1, "drive", false)
    const result = r.onBounce(0, 7.5)
    expect(result).toEqual({ winner: 0, loser: 1, reason: "Out" })
  })

  it("gives the point to the hitter on a double bounce", () => {
    const r = rallyAfterServe()
    r.onBounce(-1.5, -5)
    expect(r.onBounce(-1.6, -5.5)).toEqual({ winner: 0, loser: 1, reason: "Double bounce" })
  })

  it("faults a volley from inside the kitchen, but not after a bounce", () => {
    const r = rallyAfterServe()
    r.onBounce(-1.5, -5)
    r.onHit(1, "dink", false)
    expect(r.onHit(0, "dink", true)?.reason).toBe("Kitchen volley")

    const r2 = rallyAfterServe()
    r2.onBounce(-1.5, -5)
    r2.onHit(1, "dink", false)
    r2.onBounce(0, 1.2)
    expect(r2.onHit(0, "dink", true)).toBeNull()
  })

  it("faults the hitter when the ball hits the net", () => {
    const r = rallyAfterServe()
    expect(r.onNet()).toEqual({ winner: 1, loser: 0, reason: "Net" })
  })

  it("enforces the two-bounce rule only when it is on", () => {
    const off = rallyAfterServe()
    expect(off.onHit(1, "drive", false)).toBeNull()

    const cfg = { ...CONFIG, rules: { ...CONFIG.rules, twoBounceRule: true } }
    const on = rallyAfterServe(cfg)
    expect(on.onHit(1, "drive", false)?.reason).toBe("Let it bounce")
  })

  it("counts consecutive dinks", () => {
    const r = rallyAfterServe()
    r.onBounce(-1.5, -5)
    r.onHit(1, "dink", false)
    r.onBounce(0, 1)
    r.onHit(0, "dink", false)
    expect(r.dinkStreak).toBe(2)
    r.onBounce(0, -1)
    r.onHit(1, "drive", false)
    expect(r.dinkStreak).toBe(0)
  })
})
