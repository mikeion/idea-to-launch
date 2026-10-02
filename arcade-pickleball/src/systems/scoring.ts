import type { GameConfig } from "../config"
import type { PlayerId } from "./types"

/** Rally scoring: every rally scores a point, and the rally winner serves next. */
export class Score {
  points: [number, number] = [0, 0]
  server: PlayerId

  constructor(
    private cfg: GameConfig,
    firstServer: PlayerId = 0,
  ) {
    this.server = firstServer
  }

  pointTo(winner: PlayerId): void {
    this.points[winner]++
    this.server = winner
  }

  /** Server stands on their right-hand side when their own score is even. */
  serveFromRight(): boolean {
    return this.points[this.server] % 2 === 0
  }

  winner(): PlayerId | null {
    const { pointsToWin, winBy } = this.cfg.rules
    const [a, b] = this.points
    if (a >= pointsToWin && a - b >= winBy) return 0
    if (b >= pointsToWin && b - a >= winBy) return 1
    return null
  }
}
