import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { Match } from "../src/systems/match"
import { Rng } from "../src/systems/rng"
import { Bot } from "./bot"

/** Bot timing noise (seconds), roughly a human who is getting the hang of it. */
const HUMANISH_NOISE = 0.1

function playGame(seed: number) {
  const match = new Match(CONFIG, seed)
  const rng = new Rng(seed + 1)
  const bots = [new Bot(0, rng, HUMANISH_NOISE), new Bot(1, rng, HUMANISH_NOISE)] as const
  const dt = 1 / CONFIG.simHz
  const maxSteps = CONFIG.simHz * 60 * 20
  for (let i = 0; i < maxSteps && match.phase !== "gameOver"; i++) {
    match.step(dt, [bots[0].intent(match), bots[1].intent(match)])
  }
  return match
}

// Milestone 1 "done when": a full game to 7 can be played, and dink rallies of 5+ happen.
describe("bot vs bot simulation", () => {
  it("finishes full games to 7 (win by 2) with dink rallies of 5+", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const match = playGame(seed)
      expect(match.phase).toBe("gameOver")
      const [a, b] = match.score.points
      expect(Math.max(a, b)).toBeGreaterThanOrEqual(CONFIG.rules.pointsToWin)
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(CONFIG.rules.winBy)
      expect(match.stats.longestDinkStreak).toBeGreaterThanOrEqual(5)
    }
  })
})
