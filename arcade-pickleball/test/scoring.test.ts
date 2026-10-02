import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { Score } from "../src/systems/scoring"

describe("rally scoring", () => {
  it("gives the rally winner the point and the serve", () => {
    const s = new Score(CONFIG, 0)
    s.pointTo(1)
    expect(s.points).toEqual([0, 1])
    expect(s.server).toBe(1)
  })

  it("serves from the right on an even score, left on odd", () => {
    const s = new Score(CONFIG, 0)
    expect(s.serveFromRight()).toBe(true)
    s.pointTo(0)
    expect(s.serveFromRight()).toBe(false)
  })

  it("needs 7 points and a 2 point lead", () => {
    const s = new Score(CONFIG, 0)
    s.points = [6, 5]
    expect(s.winner()).toBeNull()
    s.points = [7, 6]
    expect(s.winner()).toBeNull()
    s.points = [8, 6]
    expect(s.winner()).toBe(0)
    s.points = [3, 7]
    expect(s.winner()).toBe(1)
  })
})
