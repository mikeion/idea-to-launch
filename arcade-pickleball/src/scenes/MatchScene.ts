import Phaser from "phaser"
import { Sfx } from "../audio/Sfx"
import { CONFIG } from "../config"
import { isInReach } from "../entities/Paddle"
import { InputManager } from "../input/InputManager"
import { drawBall, drawBallShadow, drawCourt, drawNet, drawPlayer } from "../render/draw"
import { project } from "../render/projection"
import { PLAYER_CSS, textStyle } from "../render/ui"
import { Match, type MatchEvent } from "../systems/match"
import { sideOf } from "../systems/rules"
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
  private latched: [ShotPresses, ShotPresses] = [noPresses(), noPresses()]
  private paused = false
  /** Seconds of freeze-frame left after a smash. */
  private hitStopLeft = 0
  private sfx!: Sfx
  private pressureGfx!: Phaser.GameObjects.Graphics

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
    this.hitStopLeft = 0
    this.latched = [noPresses(), noPresses()]
    this.sfx = new Sfx(this)

    drawCourt(this.add.graphics().setDepth(0), CONFIG)
    this.shadowGfx = this.add.graphics().setDepth(1)
    drawNet(this.add.graphics().setDepth(netScreenY), CONFIG)
    this.playerGfx = [this.add.graphics(), this.add.graphics()]
    this.ballGfx = this.add.graphics()

    const hud = 1000
    this.scoreText = [0, 1].map((p) =>
      this.add
        .text(24, 14 + p * 40, "", textStyle(30, PLAYER_CSS[p], { fontStyle: "bold" }))
        .setDepth(hud),
    )
    this.pressureGfx = this.add.graphics().setDepth(hud)
    this.add.text(PRESSURE_X, 96, "PRESSURE", textStyle(18, "#c9d1d9")).setDepth(hud)
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
      this.latched[p].smash ||= base[p].smash
    }

    const realDt = Math.min(delta, 100) / 1000
    if (this.hitStopLeft > 0) {
      this.hitStopLeft -= realDt
      this.render()
      return
    }

    const dt = 1 / CONFIG.simHz
    this.accumulator += realDt * CONFIG.simSpeed * this.timeScale()
    while (this.accumulator >= dt && this.hitStopLeft <= 0) {
      const intents = [0, 1].map((p) => ({ ...base[p], ...this.latched[p] })) as [Intent, Intent]
      this.latched = [noPresses(), noPresses()]
      this.handleEvents(this.match.step(dt, intents))
      this.accumulator -= dt
    }
    if (this.hitStopLeft > 0) this.accumulator = 0
    this.render()
  }

  /** Slow motion while a player lines up a smash on a high ball. Presentation only. */
  private timeScale(): number {
    const m = this.match
    const attacker = m.smashOpportunity
    if (m.phase !== "rally" || attacker === null) return 1
    const onTheirSide = sideOf(m.ball.y) === attacker
    return onTheirSide && m.ball.z > CONFIG.smash.slowMoMinHeight ? CONFIG.smash.slowMoScale : 1
  }

  private handleEvents(events: MatchEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "hit": {
          const pl = this.match.players[e.player]
          const text = e.auto ? "SCRAMBLE" : e.label
          if (e.shot === "smash") {
            this.sfx.smash()
            this.hitStopLeft = CONFIG.smash.hitStop
            this.cameras.main.shake(CONFIG.smash.shakeDuration * 1000, CONFIG.smash.shakeIntensity)
          } else if (e.shot === "drive") {
            this.sfx.drive()
          } else {
            this.sfx.dink()
          }
          this.floatText(
            pl.x,
            pl.y,
            `${e.shot.toUpperCase()} · ${text}`,
            LABEL_COLORS[e.label] ?? "#ffffff",
          )
          break
        }
        case "serve":
          this.sfx.dink()
          break
        case "bounce":
          this.sfx.bounce()
          break
        case "net":
          this.sfx.net()
          break
        case "smashChance": {
          const pl = this.match.players[e.player]
          this.sfx.smashChance()
          this.floatText(
            pl.x,
            pl.y,
            `SMASH IT!  ${this.inp.prompt(e.player, "smash")}`,
            "#f4e04d",
            0.35,
          )
          break
        }
        case "whiff": {
          this.sfx.whiff()
          const pl = this.match.players[e.player]
          this.floatText(pl.x, pl.y, "whiff", "#b8c0c8")
          break
        }
        case "point": {
          const w = e.result.winner
          this.sfx.point()
          const how = e.ending === "attack" ? "WINNER  ·  " : ""
          this.showCenter(`${e.result.reason}!\n${how}Point P${w + 1}`, PLAYER_CSS[w])
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

  private floatText(x: number, y: number, msg: string, color: string, height = 2.1): void {
    const p = project(x, y, height, CONFIG)
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
    const glow =
      m.smashOpportunity !== null && m.phase === "rally"
        ? 0.5 + 0.5 * Math.sin(this.time.now / 70)
        : 0
    drawBall(this.ballGfx, m.ball, CONFIG, glow)
    this.ballGfx.setDepth(project(m.ball.x, m.ball.y, 0, CONFIG).y + 0.5)
    for (const p of m.players) {
      const canHit =
        m.phase === "rally" && m.rules.canHit(p.id, m.ball.y) && isInReach(p, m.ball, CONFIG)
      drawPlayer(this.playerGfx[p.id], p, m.ball, CONFIG, canHit)
      this.playerGfx[p.id].setDepth(project(p.x, p.y, 0, CONFIG).y)
    }

    for (const p of [0, 1] as PlayerId[]) {
      const serving = m.score.server === p ? "●" : "  "
      this.scoreText[p].setText(`${serving} P${p + 1}  ${m.score.points[p]}`)
      this.footerText[p].setText(
        `P${p + 1}: ${inp.movePrompt(p)} move · ${inp.prompt(p, "dink")} dink · ${inp.prompt(p, "drive")} drive · ${inp.prompt(p, "smash")} smash`,
      )
    }
    this.drawPressure()
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
            `Longest dink rally: ${m.stats.longestDinkStreak}    Longest rally: ${m.stats.longestRally} shots`,
            `Points won by attacks: ${m.stats.endings.attack}    Unforced errors: ${m.stats.endings.unforced}`,
            "",
            `${confirm}: rematch    ${back}: menu`,
            "",
            "Did the pressure build? Did points end in a satisfying attack?",
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

  private drawPressure(): void {
    const g = this.pressureGfx
    g.clear()
    for (const p of [0, 1] as PlayerId[]) {
      const v = this.match.pressure[p]
      const y = 26 + p * 40
      g.fillStyle(0x000000, 0.5)
      g.fillRoundedRect(PRESSURE_X, y, PRESSURE_W, 14, 6)
      if (v > 0) {
        // Green when calm, through yellow, to red at full pressure.
        const color = v < 0.5 ? 0x7dd36b : v < 0.8 ? 0xf4c94d : 0xff5a4d
        g.fillStyle(color)
        g.fillRoundedRect(PRESSURE_X, y, Math.max(12, PRESSURE_W * v), 14, 6)
      }
      g.lineStyle(2, 0xffffff, 0.5)
      g.strokeRoundedRect(PRESSURE_X, y, PRESSURE_W, 14, 6)
    }
  }
}

const PRESSURE_X = 170
const PRESSURE_W = 150

interface ShotPresses {
  dink: boolean
  drive: boolean
  smash: boolean
}

function noPresses(): ShotPresses {
  return { dink: false, drive: false, smash: false }
}
