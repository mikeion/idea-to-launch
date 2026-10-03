import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { CpuPlayer } from "../src/systems/ai"
import { Match } from "../src/systems/match"
import { solveShot } from "../src/systems/physics"
import { Rng } from "../src/systems/rng"
import { IDLE_INTENT } from "../src/systems/types"
import { Bot } from "./bot"

const dt = 1 / CONFIG.simHz

describe("practice mode", () => {
  it("never ends, the machine always serves, and it feeds smash chances", () => {
    const m = new Match(CONFIG, 3, 1, { endless: true, fixedServer: 1 })
    const rng = new Rng(4)
    const you = new Bot(0, rng, 0.08)
    const machine = new CpuPlayer(1, rng, CONFIG.cpu.machine)
    let chances = 0
    let serves = 0
    for (let i = 0; i < CONFIG.simHz * 60 * 4; i++) {
      for (const e of m.step(dt, [you.intent(m), machine.intent(m)])) {
        if (e.type === "smashChance" && e.player === 0) chances++
        if (e.type === "serve") {
          serves++
          expect(e.player).toBe(1)
        }
      }
    }
    expect(m.phase).not.toBe("gameOver")
    expect(serves).toBeGreaterThanOrEqual(1)
    expect(chances).toBeGreaterThan(3)
  })
})

describe("timing assist", () => {
  function incoming(playerY: number) {
    const m = new Match(CONFIG, 7)
    m.phase = "rally"
    m.rules.startRally(1, 1)
    m.rules.onServe()
    m.rules.hits = 4
    m.players[0].x = 0
    m.players[0].y = playerY
    const from = { x: 0, y: -2.3, z: 0.5 }
    Object.assign(m.ball, from, solveShot(from, 0, 1.2, 1.1, CONFIG.ball.gravity), {
      rolling: false,
    })
    return m
  }

  it("predicts the moment that the swing is judged against", () => {
    const m = incoming(2.5)
    const hint = m.swingHint(0)!
    expect(hint).not.toBeNull()
    // Swing exactly at the hinted moment: it should be judged PERFECT.
    let label = ""
    for (let i = 0; i < 400 && !label; i++) {
      const press = m.time + dt / 2 >= hint.ideal
      for (const e of m.step(dt, [{ ...IDLE_INTENT, dink: press }, IDLE_INTENT])) {
        if (e.type === "hit") label = e.label
      }
    }
    expect(label).toBe("PERFECT")
  })

  it("shows nothing when the player can't reach the ball from where they stand", () => {
    expect(incoming(6).swingHint(0)).toBeNull()
  })
})
