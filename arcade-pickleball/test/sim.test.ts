import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { Match, type MatchEvent } from "../src/systems/match"
import { Rng } from "../src/systems/rng"
import { CpuPlayer } from "../src/systems/ai"
import { Bot } from "./bot"

/** Bot timing noise (seconds), roughly a human who is getting the hang of it. */
const HUMANISH_NOISE = 0.1

function playGame(seed: number, onEvent: (e: MatchEvent, m: Match) => void = () => {}) {
  const match = new Match(CONFIG, seed)
  const rng = new Rng(seed + 1)
  const bots = [new Bot(0, rng, HUMANISH_NOISE), new Bot(1, rng, HUMANISH_NOISE)] as const
  const dt = 1 / CONFIG.simHz
  const maxSteps = CONFIG.simHz * 60 * 20
  for (let i = 0; i < maxSteps && match.phase !== "gameOver"; i++) {
    for (const e of match.step(dt, [bots[0].intent(match), bots[1].intent(match)]))
      onEvent(e, match)
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

// Milestone 2 "done when": rallies build tension and end in an attack more often
// than in an unforced error.
describe("pressure and the attack", () => {
  it("fills both pressure meters with each dink in a row, and resets on anything else", () => {
    playGame(5, (e, m) => {
      if (e.type !== "hit" || m.phase !== "rally") return
      const expected =
        e.shot === "dink" && !e.auto ? Math.min(1, m.rules.dinkStreak * CONFIG.pressure.perDink) : 0
      expect(m.pressure[0]).toBeCloseTo(expected)
      expect(m.pressure[1]).toBeCloseTo(expected)
    })
  })

  it("ends more points with attacks than with unforced errors, and smashes happen", () => {
    let attack = 0
    let unforced = 0
    let smashes = 0
    let chances = 0
    for (let seed = 1; seed <= 4; seed++) {
      const m = playGame(seed, (e) => {
        if (e.type === "hit" && e.shot === "smash") smashes++
        if (e.type === "smashChance") chances++
      })
      attack += m.stats.endings.attack
      unforced += m.stats.endings.unforced
    }
    expect(chances).toBeGreaterThan(0)
    expect(smashes).toBeGreaterThan(0)
    expect(attack).toBeGreaterThan(unforced * 1.5)
  })
})

describe("CPU difficulty", () => {
  it("is ordered: a fixed human-like bot does best against easy and worst against hard", () => {
    const winsAgainst = (level: "easy" | "medium" | "hard") => {
      let wins = 0
      for (let seed = 1; seed <= 4; seed++) {
        const match = new Match(CONFIG, seed)
        const rng = new Rng(seed * 7)
        const human = new Bot(0, rng, HUMANISH_NOISE)
        const cpu = new CpuPlayer(1, rng, CONFIG.cpu[level])
        for (let i = 0; i < CONFIG.simHz * 60 * 20 && match.phase !== "gameOver"; i++) {
          match.step(1 / CONFIG.simHz, [human.intent(match), cpu.intent(match)])
        }
        expect(match.phase).toBe("gameOver")
        if (match.winner === 0) wins++
      }
      return wins
    }
    const easy = winsAgainst("easy")
    const hard = winsAgainst("hard")
    expect(easy).toBeGreaterThan(hard)
  })
})
