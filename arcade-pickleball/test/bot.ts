// The simulation tests' bot: the real CPU player with no reaction delay, no
// positioning error and a chosen amount of timing noise.
import { CpuPlayer } from "../src/systems/ai"
import type { Rng } from "../src/systems/rng"
import type { PlayerId } from "../src/systems/types"

export class Bot extends CpuPlayer {
  constructor(id: PlayerId, rng: Rng, timingNoise = 0.03) {
    super(id, rng, {
      reactionTime: 0,
      timingNoise,
      positionError: 0,
      speedScale: 1,
      attackHeight: 1.05,
      smashHeight: 1.5,
      aimSkill: 0,
      floaterEvery: 0,
    })
  }
}
