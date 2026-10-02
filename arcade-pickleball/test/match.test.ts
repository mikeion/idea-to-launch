import { describe, expect, it } from "vitest"
import { CONFIG } from "../src/config"
import { Match, type MatchEvent } from "../src/systems/match"
import { solveShot } from "../src/systems/physics"
import { IDLE_INTENT, type Intent } from "../src/systems/types"

const dt = 1 / CONFIG.simHz

/** A rally where player 1 has just dinked a ball toward player 0 standing at (0, py). */
function incomingDink(py: number) {
  const m = new Match(CONFIG, 7)
  m.phase = "rally"
  m.rules.startRally(1, 1)
  m.rules.onServe()
  m.rules.hits = 4 // mid-rally: player 1 is the last hitter, serve rules no longer apply
  m.players[0].x = 0
  m.players[0].y = py
  m.players[1].y = -2.4
  const from = { x: 0, y: -2.3, z: 0.5 }
  Object.assign(m.ball, from, solveShot(from, 0, 1.2, 1.1, CONFIG.ball.gravity), { rolling: false })
  return m
}

function run(m: Match, steps: number, intent0: (m: Match) => Intent = () => IDLE_INTENT) {
  const events: MatchEvent[] = []
  for (let i = 0; i < steps && m.phase === "rally"; i++) {
    events.push(...m.step(dt, [intent0(m), IDLE_INTENT]))
  }
  return events
}

describe("match", () => {
  it("calls a kitchen volley when a player in the kitchen hits before the bounce", () => {
    const m = incomingDink(0.8)
    // Press as soon as the ball crosses the net into reach, before it bounces.
    const events = run(m, 200, (mm) => ({
      ...IDLE_INTENT,
      dink: mm.ball.y > 0.1 && mm.rules.bouncesSinceHit === 0,
    }))
    const point = events.find((e) => e.type === "point")
    expect(point?.type === "point" && point.result.reason).toBe("Kitchen volley")
  })

  it("rewards a well-timed dink and punishes an early one with a floater", () => {
    // Press the dink at a given time, then measure how high the reply flies.
    const apexOf = (pressAt: number) => {
      const m = incomingDink(2.5)
      let pressed = false
      const events = run(m, 400, (mm) => {
        const press = !pressed && mm.rules.bouncesSinceHit === 1 && mm.time >= pressAt
        if (press) pressed = true
        return { ...IDLE_INTENT, dink: press }
      })
      const hit = events.find((e) => e.type === "hit")
      let apex = 0
      for (let i = 0; i < 200; i++) {
        m.step(dt, [IDLE_INTENT, IDLE_INTENT])
        apex = Math.max(apex, m.ball.z)
      }
      return { hit, apex }
    }

    // Sweep press times and keep the best one: that is a well-timed press.
    let best = { quality: -1, at: 0 }
    for (let t = 0.6; t < 1.6; t += 0.02) {
      const { hit } = apexOf(t)
      if (hit?.type === "hit" && !hit.auto && hit.quality > best.quality)
        best = { quality: hit.quality, at: t }
    }
    expect(best.quality).toBe(1)

    const good = apexOf(best.at)
    const early = apexOf(best.at - 0.15)
    expect(early.hit?.type === "hit" && early.hit.label).toBe("EARLY")
    expect(early.apex).toBeGreaterThan(good.apex + 0.3)
  })

  it("auto-scrambles a bounced ball that is about to get past a player who never swings", () => {
    const m = incomingDink(2.5)
    const events = run(m, 400)
    const hit = events.find((e) => e.type === "hit")
    expect(hit?.type === "hit" && hit.auto).toBe(true)
  })
})
