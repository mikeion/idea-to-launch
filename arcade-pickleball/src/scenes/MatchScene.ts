import Phaser from "phaser"
import { Sfx } from "../audio/Sfx"
import { CONFIG, type GameConfig } from "../config"
import { InputManager } from "../input/InputManager"
import { MatchView } from "../render/MatchView"
import { PLAYER_CSS, textStyle } from "../render/ui"
import { loadSettings, matchConfig, type GameMode, type Settings } from "../settings"
import { CpuPlayer } from "../systems/ai"
import { Match, type MatchEvent } from "../systems/match"
import { Rng } from "../systems/rng"
import { sideOf } from "../systems/rules"
import type { Intent, PlayerId } from "../systems/types"

const LABEL_COLORS: Record<string, string> = {
  PERFECT: "#7dff8a",
  GOOD: "#d8f27a",
  EARLY: "#ffb04d",
  LATE: "#ffb04d",
}

/** Little bits of color commentary as a dink rally builds. */
const TENSION_CALLS: Record<number, string> = {
  5: "Tension rising…",
  8: "Who blinks first?",
  12: "Nerves of steel!",
  16: "This is pickleball.",
}

export interface MatchSceneData {
  mode: GameMode
}

interface PracticeStats {
  streak: number
  best: number
  labels: Record<string, number>
  smashes: number
}

export class MatchScene extends Phaser.Scene {
  private mode: GameMode = "cpu"
  private settings!: Settings
  private cfg!: GameConfig
  private match!: Match
  private view!: MatchView
  private inp!: InputManager
  private cpu: CpuPlayer | null = null
  private accumulator = 0
  /** Shot presses seen this frame, held until a simulation step consumes them. */
  private latched: [ShotPresses, ShotPresses] = [noPresses(), noPresses()]
  private paused = false
  /** Seconds of freeze-frame left after a smash. */
  private hitStopLeft = 0
  private sfx!: Sfx
  private practice: PracticeStats = newPracticeStats()

  private pressureGfx!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text[]
  private sideText!: Phaser.GameObjects.Text
  private promptText!: Phaser.GameObjects.Text
  private footerText!: Phaser.GameObjects.Text[]
  private centerText!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Rectangle
  private overlayText!: Phaser.GameObjects.Text

  constructor() {
    super("Match")
  }

  init(data: Partial<MatchSceneData>): void {
    this.mode = data.mode ?? "cpu"
  }

  create(): void {
    const { width, height } = CONFIG.view
    this.settings = loadSettings()
    this.cfg = matchConfig(this.settings)
    const seed = Date.now()
    this.match =
      this.mode === "practice"
        ? new Match(this.cfg, seed, 1, { endless: true, fixedServer: 1 })
        : new Match(this.cfg, seed, 0)
    this.cpu =
      this.mode === "cpu"
        ? new CpuPlayer(1, new Rng(seed + 1), this.cfg.cpu[this.settings.difficulty])
        : this.mode === "practice"
          ? new CpuPlayer(1, new Rng(seed + 1), this.cfg.cpu.machine)
          : null
    this.inp = new InputManager(this)
    this.view = new MatchView(this, this.cfg)
    this.accumulator = 0
    this.paused = false
    this.hitStopLeft = 0
    this.latched = [noPresses(), noPresses()]
    this.practice = newPracticeStats()
    this.sfx = new Sfx(this)
    this.sfx.enabled = this.settings.sound

    const hud = 1000
    this.scoreText = [0, 1].map((p) =>
      this.add
        .text(24, 14 + p * 40, "", textStyle(30, PLAYER_CSS[p], { fontStyle: "bold" }))
        .setDepth(hud),
    )
    this.pressureGfx = this.add.graphics().setDepth(hud)
    this.add.text(PRESSURE_X, 96, "PRESSURE", textStyle(18, "#c9d1d9")).setDepth(hud)
    this.sideText = this.add
      .text(width - 24, 18, "", textStyle(24, "#f2f2ea", { align: "right", lineSpacing: 4 }))
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
      .rectangle(0, 0, width, height, 0x000000, 0.65)
      .setOrigin(0)
      .setDepth(hud + 1)
      .setVisible(false)
    this.overlayText = this.add
      .text(
        width / 2,
        height / 2,
        "",
        textStyle(32, "#ffffff", { align: "center", lineSpacing: 12 }),
      )
      .setOrigin(0.5)
      .setDepth(hud + 2)

    if (this.mode === "practice") {
      this.showCenter("Ball machine\nTime your dinks. Smash the pop-ups.", "#f4e04d", 2.6)
    }
  }

  /** Human-controlled players in this mode. */
  private get humans(): PlayerId[] {
    return this.mode === "versus" ? [0, 1] : [0]
  }

  update(_time: number, delta: number): void {
    const inp = this.inp
    inp.update()

    if (this.match.phase === "gameOver") {
      if (inp.pressedByAnyone("confirm")) return void this.scene.restart({ mode: this.mode })
      if (inp.pressedByAnyone("back") || inp.pressedByAnyone("pause")) {
        return void this.scene.start("Menu")
      }
    } else if (inp.pressedByAnyone("pause")) {
      this.paused = !this.paused
    }
    if (this.paused) {
      if (inp.pressedByAnyone("back")) return void this.scene.start("Menu")
      this.render()
      return
    }

    // In single-player modes the keyboard's second layout and any gamepad drive player 1.
    const base: Intent[] = [inp.intent(0), inp.intent(1)]
    for (const p of this.humans) {
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

    const dt = 1 / this.cfg.simHz
    this.accumulator += realDt * this.cfg.simSpeed * this.timeScale()
    while (this.accumulator >= dt && this.hitStopLeft <= 0) {
      const intents = [0, 1].map((p) =>
        this.cpu && this.cpu.id === p
          ? this.cpu.intent(this.match)
          : { ...base[p], ...this.latched[p] },
      ) as [Intent, Intent]
      this.latched = [noPresses(), noPresses()]
      this.handleEvents(this.match.step(dt, intents))
      this.accumulator -= dt
    }
    if (this.hitStopLeft > 0) this.accumulator = 0
    this.render()
  }

  /** Slow motion while a human lines up a smash on a high ball. Presentation only. */
  private timeScale(): number {
    const m = this.match
    const attacker = m.smashOpportunity
    if (m.phase !== "rally" || attacker === null || !this.humans.includes(attacker)) return 1
    const onTheirSide = sideOf(m.ball.y) === attacker
    return onTheirSide && m.ball.z > this.cfg.smash.slowMoMinHeight ? this.cfg.smash.slowMoScale : 1
  }

  private name(p: PlayerId): string {
    if (this.mode === "cpu") return p === 0 ? "YOU" : "CPU"
    if (this.mode === "practice") return p === 0 ? "YOU" : "MACHINE"
    return `P${p + 1}`
  }

  private handleEvents(events: MatchEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "hit": {
          const pl = this.match.players[e.player]
          const text = e.auto ? "SCRAMBLE" : e.label
          if (e.shot === "smash") {
            this.sfx.smash()
            this.hitStopLeft = this.cfg.smash.hitStop
            this.cameras.main.shake(
              this.cfg.smash.shakeDuration * 1000,
              this.cfg.smash.shakeIntensity,
            )
          } else if (e.shot === "drive") {
            this.sfx.drive()
          } else {
            this.sfx.dink()
          }
          this.view.floatText(
            pl.x,
            pl.y,
            `${e.shot.toUpperCase()} · ${text}`,
            LABEL_COLORS[e.label] ?? "#ffffff",
          )
          if (this.humans.includes(e.player)) this.trackPractice(e)
          const call = TENSION_CALLS[this.match.rules.dinkStreak]
          if (call && e.shot === "dink" && !e.auto) this.flash(call)
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
          this.sfx.smashChance()
          if (this.humans.includes(e.player)) {
            const pl = this.match.players[e.player]
            this.view.floatText(
              pl.x,
              pl.y,
              `SMASH IT!  ${this.inp.prompt(e.player, "smash")}`,
              "#f4e04d",
              0.35,
            )
          }
          break
        }
        case "whiff": {
          this.sfx.whiff()
          const pl = this.match.players[e.player]
          this.view.floatText(pl.x, pl.y, "whiff", "#b8c0c8")
          break
        }
        case "point": {
          const w = e.result.winner
          this.sfx.point()
          if (this.mode === "practice") {
            // In practice a point ending on your error breaks your return streak.
            if (e.result.loser === 0) this.practice.streak = 0
            const msg = e.result.loser === 0 ? `${e.result.reason}` : "Nice! Machine missed."
            this.showCenter(msg, e.result.loser === 0 ? "#ffb04d" : "#7dff8a")
            break
          }
          const how = e.ending === "attack" ? "WINNER  ·  " : ""
          const point = this.name(w) === "YOU" ? "Your point" : `Point ${this.name(w)}`
          this.showCenter(`${e.result.reason}!\n${how}${point}`, PLAYER_CSS[w])
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

  private trackPractice(e: Extract<MatchEvent, { type: "hit" }>): void {
    const s = this.practice
    s.labels[e.auto ? "SCRAMBLE" : e.label] = (s.labels[e.auto ? "SCRAMBLE" : e.label] ?? 0) + 1
    if (e.shot === "smash") s.smashes++
    s.streak++
    s.best = Math.max(s.best, s.streak)
  }

  private flash(msg: string): void {
    const t = this.add
      .text(CONFIG.view.width / 2, 150, msg, textStyle(30, "#f4e04d", { fontStyle: "bold italic" }))
      .setOrigin(0.5)
      .setDepth(998)
      .setAlpha(0)
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: 140,
      duration: 250,
      yoyo: true,
      hold: 700,
      onComplete: () => t.destroy(),
    })
  }

  private showCenter(msg: string, color: string, seconds = this.cfg.flow.pointOverDelay): void {
    this.tweens.killTweensOf(this.centerText)
    this.centerText.setText(msg).setColor(color).setAlpha(1).setScale(0.8)
    this.tweens.add({ targets: this.centerText, scale: 1, duration: 160, ease: "Back.easeOut" })
    this.tweens.add({
      targets: this.centerText,
      alpha: 0,
      delay: seconds * 1000 - 300,
      duration: 300,
    })
  }

  private render(): void {
    const m = this.match
    const inp = this.inp
    this.view.render(m, this.settings.assist ? this.humans : [])

    for (const p of [0, 1] as PlayerId[]) {
      const serving = m.score.server === p ? "●" : "  "
      const score = this.mode === "practice" ? "" : `  ${m.score.points[p]}`
      this.scoreText[p].setText(`${serving} ${this.name(p)}${score}`)
      if (this.humans.includes(p)) {
        this.footerText[p].setText(
          `${this.name(p)}: ${inp.movePrompt(p)} move · ${inp.prompt(p, "dink")} dink · ${inp.prompt(p, "drive")} drive · ${inp.prompt(p, "smash")} smash · ${p === 0 ? (inp.device(0) === "gamepad" ? "Start" : "Esc") + " pause" : ""}`,
        )
      } else {
        const label =
          this.mode === "practice" ? "Ball machine" : `CPU · ${this.settings.difficulty}`
        this.footerText[p].setText(label)
      }
    }
    this.drawPressure()
    this.sideText.setText(this.sidePanel())

    if (m.phase === "serve" && this.humans.includes(m.score.server)) {
      const s = m.score.server
      this.promptText
        .setText(
          `Serve: ${inp.prompt(s, "dink")} soft · ${inp.prompt(s, "drive")} hard   (hold left/right to aim)`,
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
      const headline =
        this.mode === "cpu"
          ? m.winner === 0
            ? `YOU WIN  ${Math.max(a, b)}–${Math.min(a, b)}`
            : `CPU WINS  ${Math.max(a, b)}–${Math.min(a, b)}`
          : `PLAYER ${m.winner + 1} WINS  ${Math.max(a, b)}–${Math.min(a, b)}`
      this.overlay.setVisible(true)
      this.overlayText
        .setText(
          [
            headline,
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

  private sidePanel(): string {
    const m = this.match
    if (this.mode === "practice") {
      const l = this.practice.labels
      return [
        `Return streak: ${this.practice.streak}   Best: ${this.practice.best}`,
        `Perfect ${l.PERFECT ?? 0} · Good ${l.GOOD ?? 0}`,
        `Early ${l.EARLY ?? 0} · Late ${l.LATE ?? 0} · Scramble ${l.SCRAMBLE ?? 0}`,
        `Smashes: ${this.practice.smashes}`,
      ].join("\n")
    }
    const live = m.phase === "rally" || m.phase === "pointOver" ? m.rules.dinkStreak : 0
    return `Dink rally: ${live}\nBest: ${m.stats.longestDinkStreak}`
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

const PRESSURE_X = 230
const PRESSURE_W = 150

interface ShotPresses {
  dink: boolean
  drive: boolean
  smash: boolean
}

function noPresses(): ShotPresses {
  return { dink: false, drive: false, smash: false }
}

function newPracticeStats(): PracticeStats {
  return { streak: 0, best: 0, labels: {}, smashes: 0 }
}
