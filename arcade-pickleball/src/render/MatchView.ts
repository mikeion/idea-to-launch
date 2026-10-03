import Phaser from "phaser"
import type { GameConfig } from "../config"
import { isInReach } from "../entities/Paddle"
import type { Match } from "../systems/match"
import { otherPlayer, type PlayerId } from "../systems/types"
import { COLORS, drawBall, drawBallShadow, drawCourt, drawNet, drawPlayer } from "./draw"
import { project } from "./projection"
import { textStyle } from "./ui"

/**
 * Draws a Match: court, net, players, ball and shadow, depth-sorted for the 3/4
 * view, plus the optional timing assist. Used by the match itself and by the
 * menu's attract-mode demo.
 */
export class MatchView {
  private shadow: Phaser.GameObjects.Graphics
  private ball: Phaser.GameObjects.Graphics
  private players: Phaser.GameObjects.Graphics[]
  private assist: Phaser.GameObjects.Graphics
  private marker: Phaser.GameObjects.Graphics

  constructor(
    private scene: Phaser.Scene,
    private cfg: GameConfig,
  ) {
    drawCourt(scene.add.graphics().setDepth(0), cfg)
    this.marker = scene.add.graphics().setDepth(1)
    this.shadow = scene.add.graphics().setDepth(2)
    drawNet(scene.add.graphics().setDepth(cfg.view.netScreenY), cfg)
    this.players = [scene.add.graphics(), scene.add.graphics()]
    this.ball = scene.add.graphics()
    this.assist = scene.add.graphics().setDepth(990)
  }

  /** `assistFor`: players (humans) who get the timing ring and landing marker. */
  render(m: Match, assistFor: PlayerId[] = []): void {
    const cfg = this.cfg
    drawBallShadow(this.shadow, m.ball, cfg)
    const glow =
      m.smashOpportunity !== null && m.phase === "rally"
        ? 0.5 + 0.5 * Math.sin(this.scene.time.now / 70)
        : 0
    drawBall(this.ball, m.ball, cfg, glow)
    this.ball.setDepth(project(m.ball.x, m.ball.y, 0, cfg).y + 0.5)
    for (const p of m.players) {
      const canHit =
        m.phase === "rally" && m.rules.canHit(p.id, m.ball.y) && isInReach(p, m.ball, cfg)
      drawPlayer(this.players[p.id], p, m.ball, cfg, canHit)
      this.players[p.id].setDepth(project(p.x, p.y, 0, cfg).y)
    }
    this.drawAssist(m, assistFor)
  }

  private drawAssist(m: Match, assistFor: PlayerId[]): void {
    const g = this.assist
    const mk = this.marker
    g.clear()
    mk.clear()
    if (assistFor.length === 0 || m.phase !== "rally") return

    // Landing marker: where the ball will bounce, red if it's going out (let it go!).
    const landing = m.predictedBounce()
    if (
      landing &&
      m.rules.lastHitter !== null &&
      assistFor.includes(otherPlayer(m.rules.lastHitter))
    ) {
      const { width, length } = this.cfg.court
      const out = Math.abs(landing.x) > width / 2 || Math.abs(landing.y) > length / 2
      const s = project(landing.x, landing.y, 0, this.cfg)
      const color = out ? 0xff5a4d : 0xffffff
      mk.lineStyle(2, color, out ? 0.9 : 0.55)
      mk.strokeEllipse(s.x, s.y, 22 * s.scale, 10 * s.scale)
      mk.lineBetween(s.x - 6 * s.scale, s.y, s.x + 6 * s.scale, s.y)
    }

    // Timing ring: closes in on the ball and turns green at the ideal moment to swing.
    for (const id of assistFor) {
      const hint = m.swingHint(id)
      if (!hint) continue
      const dt = hint.ideal - m.time
      if (dt > 0.5 || dt < -hint.window) continue
      const b = project(m.ball.x, m.ball.y, m.ball.z, this.cfg)
      const r0 = 9 * b.scale
      const perfect = Math.abs(dt) <= hint.perfectWindow
      const good = Math.abs(dt) <= hint.window * 0.45
      const color = perfect ? 0x7dff8a : good ? 0xf4e04d : 0xffffff
      const radius = r0 + Math.max(0, dt) * 70 * b.scale
      g.lineStyle(perfect ? 4 : 2, color, dt < 0 ? 0.5 : 0.9)
      g.strokeCircle(b.x, b.y, radius)
      if (hint.smash) {
        g.lineStyle(2, COLORS.ball, 0.9)
        g.strokeCircle(b.x, b.y, radius + 5)
      }
    }
  }

  floatText(x: number, y: number, msg: string, color: string, height = 2.1): void {
    const p = project(x, y, height, this.cfg)
    p.y = Math.max(p.y, 130) // keep labels for the far player clear of the HUD
    const t = this.scene.add
      .text(p.x, p.y, msg, textStyle(22, color, { fontStyle: "bold" }))
      .setOrigin(0.5)
      .setDepth(999)
    this.scene.tweens.add({
      targets: t,
      y: p.y - 40,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    })
  }
}
