import Phaser from "phaser"
import { CONFIG } from "../config"
import { isInReach } from "../entities/Paddle"
import { InputManager } from "../input/InputManager"
import { drawBall, drawBallShadow, drawCourt, drawNet, drawPlayer } from "../render/draw"
import { project } from "../render/projection"
import { PLAYER_CSS, textStyle } from "../render/ui"
import { Match, type MatchEvent } from "../systems/match"
import type { Intent, PlayerId } from "../systems/types"

const LABEL_COLORS: Record<string, string> = {
  PERFECT: "#7dff8a",
  GOOD: "#d8f27a",
  EARLY: "#ffb04d",
  LATE: "#ffb04d",
}

export class MatchScene extends Phaser.Scene {
  private match!: Match
  private inp!: InputManager
  private accumulator = 0
  /** Shot presses seen this frame, held until a simulation step consumes them. */
  private latched: [{ dink: boolean; drive: boolean }, { dink: boolean; drive: boolean }] = [
    { dink: false, drive: false },
    { dink: false, drive: false },
  ]
  private paused = false

  private shadowGfx!: Phaser.GameObjects.Graphics
  private ballGfx!: Phaser.GameObjects.Graphics
  private playerGfx!: Phaser.GameObjects.Graphics[]
  private scoreText!: Phaser.GameObjects.Text[]
  private streakText!: Phaser.GameObjects.Text
  private promptText!: Phaser.GameObjects.Text
  private footerText!: Phaser.GameObjects.Text[]
  private centerText!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Rectangle
  private overlayText!: Phaser.GameObjects.Text

  constructor() {
    super("Match")
  }

  create(): void {
    const { width, height, netScreenY } = CONFIG.view
    this.match = new Match(CONFIG, Date.now(), 0)
    this.inp = new InputManager(this)
    this.accumulator = 0
    this.paused = false

    drawCourt(this.add.graphics().setDepth(0), CONFIG)
    this.shadowGfx = this.add.graphics().setDepth(1)
    drawNet(this.add.graphics().setDepth(netScreenY), CONFIG)
    this.playerGfx = [this.add.graphics(), this.add.graphics()]
    this.ballGfx = this.add.graphics()

    const hud = 1000
    this.scoreText = [0, 1].map((p) =>
      this.add
        .text(24, 18 + p * 40, "", textStyle(30, PLAYER_CSS[p], { fontStyle: "bold" }))
        .setDepth(hud),
    )
    this.streakText = this.add
      .text(width - 24, 18, "", textStyle(26, "#f2f2ea", { align: "right" }))
      .setOrigin(1, 0)
      .setDepth(hud)
    this.promptText = this.add
      .text(width / 2, height - 52, "", textStyle(26, "#ffffff"))
      .setOrigin(0.5)
      .setDepth(hud)
    this.footerText = [0, 1].map((p) =>
      this.add
        .text(p === 0 ? 24 : width - 24, height - 16, "", textStyle(18, PLAYER_CSS[p]))
        .setOrigin(p === 0 ? 0 : 1, 1)
        .setDepth(hud),
    )
    this.centerText = this.add
      .text(width / 2, 300, "", textStyle(46, "#ffffff", { fontStyle: "bold", align: "center" }))
      .setOrigin(0.5)
      .setDepth(hud)
    this.overlay = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.6)
      .setOrigin(0)
      .setDepth(hud + 1)
      .setVisible(false)
    this.overlayText = this.add
      .text(
        width / 2,
        height / 2,
        "",
        textStyle(34, "#ffffff", { align: "center", lineSpacing: 12 }),
      )
      .setOrigin(0.5)
      .setDepth(hud + 2)
  }

  update(_time: number, delta: number): void {
    const inp = this.inp
    inp.update()

    if (this.match.phase === "gameOver") {
      if (inp.pressedByAnyone("confirm")) return void this.scene.restart()
      if (inp.pressedByAnyone("back")) return void this.scene.start("Menu")
    } else if (inp.pressedByAnyone("pause")) {
      this.paused = !this.paused
    }
    if (this.paused) {
      if (inp.pressedByAnyone("back")) return void this.scene.start("Menu")
      this.render()
      return
    }

    const base = [inp.intent(0), inp.intent(1)]
    for (const p of [0, 1] as PlayerId[]) {
      this.latched[p].dink ||= base[p].dink
      this.latched[p].drive ||= base[p].drive
    }

    const dt = 1 / CONFIG.simHz
    this.accumulator += (Math.min(delta, 100) / 1000) * CONFIG.simSpeed
    while (this.accumulator >= dt) {
      const intents = [0, 1].map((p) => ({ ...base[p], ...this.latched[p] })) as [Intent, Intent]
      this.latched = [
        { dink: false, drive: false },
        { dink: false, drive: false },
      ]
      this.handleEvents(this.match.step(dt, intents))
      this.accumulator -= dt
    }
    this.render()
  }

  private handleEvents(events: MatchEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "hit": {
          const pl = this.match.players[e.player]
          const text = e.auto ? "SCRAMBLE" : e.label
          this.floatText(
            pl.x,
            pl.y,
            `${e.shot.toUpperCase()} · ${text}`,
            LABEL_COLORS[e.label] ?? "#ffffff",
          )
          break
        }
        case "whiff": {
          const pl = this.match.players[e.player]
          this.floatText(pl.x, pl.y, "whiff", "#b8c0c8")
          break
        }
        case "point": {
          const w = e.result.winner
          this.showCenter(`${e.result.reason}!\nPoint P${w + 1}`, PLAYER_CSS[w])
          break
        }
        case "gameOver":
          this.centerText.setText("")
          break
        default:
          break
      }
    }
  }

  private floatText(x: number, y: number, msg: string, color: string): void {
    const p = project(x, y, 2.1, CONFIG)
    p.y = Math.max(p.y, 130) // keep labels for the far player clear of the HUD
    const t = this.add
      .text(p.x, p.y, msg, textStyle(22, color, { fontStyle: "bold" }))
      .setOrigin(0.5)
      .setDepth(999)
    this.tweens.add({
      targets: t,
      y: p.y - 40,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    })
  }

  private showCenter(msg: string, color: string): void {
    this.tweens.killTweensOf(this.centerText)
    this.centerText.setText(msg).setColor(color).setAlpha(1).setScale(0.8)
    this.tweens.add({ targets: this.centerText, scale: 1, duration: 160, ease: "Back.easeOut" })
    this.tweens.add({
      targets: this.centerText,
      alpha: 0,
      delay: CONFIG.flow.pointOverDelay * 1000 - 300,
      duration: 300,
    })
  }

  private render(): void {
    const m = this.match
    const inp = this.inp

    drawBallShadow(this.shadowGfx, m.ball, CONFIG)
    drawBall(this.ballGfx, m.ball, CONFIG, false)
    this.ballGfx.setDepth(project(m.ball.x, m.ball.y, 0, CONFIG).y + 0.5)
    for (const p of m.players) {
      const canHit =
        m.phase === "rally" && m.rules.canHit(p.id, m.ball.y) && isInReach(p, m.ball, CONFIG)
      drawPlayer(this.playerGfx[p.id], p, m.ball, CONFIG, canHit)
      this.playerGfx[p.id].setDepth(project(p.x, p.y, 0, CONFIG).y)
    }

    for (const p of [0, 1] as PlayerId[]) {
      const serving = m.score.server === p ? "  ● serve" : ""
      this.scoreText[p].setText(`P${p + 1}  ${m.score.points[p]}${serving}`)
      this.footerText[p].setText(
        `P${p + 1}: ${inp.movePrompt(p)} move · ${inp.prompt(p, "dink")} dink · ${inp.prompt(p, "drive")} drive`,
      )
    }
    this.streakText.setText(
      `Dink rally: ${m.phase === "rally" || m.phase === "pointOver" ? m.rules.dinkStreak : 0}\nBest: ${m.stats.longestDinkStreak}`,
    )

    if (m.phase === "serve") {
      const s = m.score.server
      this.promptText
        .setText(
          `P${s + 1} serve: ${inp.prompt(s, "dink")} soft · ${inp.prompt(s, "drive")} hard   (move sideways to aim)`,
        )
        .setColor(PLAYER_CSS[s])
    } else {
      this.promptText.setText("")
    }

    const pause = inp.device(0) === "gamepad" ? "Start" : "Esc"
    const back = inp.device(0) === "gamepad" ? "Select" : "Backspace"
    if (m.phase === "gameOver" && m.winner !== null) {
      const [a, b] = m.score.points
      const confirm = inp.device(0) === "gamepad" ? "Ⓐ" : "Enter"
      this.overlay.setVisible(true)
      this.overlayText
        .setText(
          [
            `PLAYER ${m.winner + 1} WINS  ${Math.max(a, b)}–${Math.min(a, b)}`,
            "",
            `Longest dink rally: ${m.stats.longestDinkStreak}`,
            `Longest rally: ${m.stats.longestRally} shots`,
            "",
            `${confirm}: rematch    ${back}: menu`,
            "",
            "Did waiting for the pop-up feel tense?",
          ].join("\n"),
        )
        .setColor(PLAYER_CSS[m.winner])
    } else if (this.paused) {
      this.overlay.setVisible(true)
      this.overlayText
        .setText(`PAUSED\n\n${pause}: resume    ${back}: quit to menu`)
        .setColor("#ffffff")
    } else {
      this.overlay.setVisible(false)
      this.overlayText.setText("")
    }
  }
}
