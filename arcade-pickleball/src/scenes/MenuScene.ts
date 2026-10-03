import Phaser from "phaser"
import { Sfx } from "../audio/Sfx"
import { CONFIG } from "../config"
import { InputManager } from "../input/InputManager"
import { MatchView } from "../render/MatchView"
import { textStyle } from "../render/ui"
import { loadSettings, saveSettings, type Difficulty, type Settings } from "../settings"
import { CpuPlayer } from "../systems/ai"
import { Match } from "../systems/match"
import { Rng } from "../systems/rng"

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"]

interface Item {
  label: () => string
  /** Left/right changes a value; confirm activates. */
  change?: (dir: 1 | -1) => void
  activate?: () => void
}

export class MenuScene extends Phaser.Scene {
  private inp!: InputManager
  private sfx!: Sfx
  private settings!: Settings
  private items: Item[] = []
  private texts: Phaser.GameObjects.Text[] = []
  private selected = 0
  private focusHint!: Phaser.GameObjects.Text
  private controlsText!: Phaser.GameObjects.Text
  private highlight!: Phaser.GameObjects.Rectangle

  // Attract mode: two CPUs play behind the menu.
  private demo!: Match
  private demoView!: MatchView
  private demoCpus!: [CpuPlayer, CpuPlayer]
  private demoAcc = 0

  constructor() {
    super("Menu")
  }

  create(): void {
    const { width, height } = CONFIG.view
    this.inp = new InputManager(this)
    this.settings = loadSettings()
    this.sfx = new Sfx(this)
    this.sfx.enabled = this.settings.sound

    this.demoView = new MatchView(this, CONFIG)
    this.newDemo()
    this.add.rectangle(0, 0, width, height, 0x0b0e12, 0.62).setOrigin(0).setDepth(500)

    this.add
      .text(width / 2, 92, "ARCADE PICKLEBALL", textStyle(68, "#f4e04d", { fontStyle: "bold" }))
      .setOrigin(0.5)
      .setDepth(1000)
    this.add
      .text(width / 2, 152, "Dink. Wait for the pop-up. Smash.", textStyle(26, "#f2f2ea"))
      .setOrigin(0.5)
      .setDepth(1000)

    const s = this.settings
    const onOff = (v: boolean) => (v ? "On" : "Off")
    this.items = [
      {
        label: () => `Play vs CPU      ◀ ${cap(s.difficulty)} ▶`,
        change: (d) => {
          const i = DIFFICULTIES.indexOf(s.difficulty)
          s.difficulty = DIFFICULTIES[(i + d + DIFFICULTIES.length) % DIFFICULTIES.length]
        },
        activate: () => this.scene.start("Match", { mode: "cpu" }),
      },
      {
        label: () => "Practice (ball machine)",
        activate: () => this.scene.start("Match", { mode: "practice" }),
      },
      {
        label: () => "2 Players (one keyboard or two gamepads)",
        activate: () => this.scene.start("Match", { mode: "versus" }),
      },
      { label: () => "How to play", activate: () => this.scene.start("HowTo") },
      {
        label: () => `Timing assist:  ${onOff(s.assist)}`,
        change: () => (s.assist = !s.assist),
        activate: () => (s.assist = !s.assist),
      },
      {
        label: () => `Two-bounce rule:  ${onOff(s.twoBounceRule)}`,
        change: () => (s.twoBounceRule = !s.twoBounceRule),
        activate: () => (s.twoBounceRule = !s.twoBounceRule),
      },
      {
        label: () => `Sound:  ${onOff(s.sound)}`,
        change: () => (s.sound = !s.sound),
        activate: () => (s.sound = !s.sound),
      },
    ]
    this.highlight = this.add
      .rectangle(width / 2, 0, 720, 48, 0xf4e04d, 0.16)
      .setStrokeStyle(2, 0xf4e04d, 0.8)
      .setDepth(999)
    this.texts = this.items.map((_, i) =>
      this.add
        .text(width / 2, 232 + i * 54 + (i >= 4 ? 18 : 0), "", textStyle(30, "#f2f2ea"))
        .setOrigin(0.5)
        .setDepth(1000),
    )

    this.controlsText = this.add
      .text(
        width / 2,
        height - 70,
        "",
        textStyle(20, "#c9d1d9", { align: "center", lineSpacing: 6 }),
      )
      .setOrigin(0.5)
      .setDepth(1000)
    this.focusHint = this.add
      .text(
        width / 2,
        height - 22,
        "Click the game first so it can hear your keyboard",
        textStyle(20, "#ffb04d"),
      )
      .setOrigin(0.5)
      .setDepth(1000)
    this.selected = Math.min(this.selected, this.items.length - 1)
  }

  private newDemo(): void {
    const seed = Date.now()
    const rng = new Rng(seed)
    this.demo = new Match(CONFIG, seed, 0)
    this.demoCpus = [
      new CpuPlayer(0, rng, CONFIG.cpu.hard),
      new CpuPlayer(1, rng, CONFIG.cpu.medium),
    ]
    this.demoAcc = 0
  }

  update(_time: number, delta: number): void {
    const inp = this.inp
    inp.update()

    // Attract mode.
    const dt = 1 / CONFIG.simHz
    this.demoAcc += Math.min(delta, 100) / 1000
    while (this.demoAcc >= dt) {
      this.demo.step(dt, [this.demoCpus[0].intent(this.demo), this.demoCpus[1].intent(this.demo)])
      this.demoAcc -= dt
    }
    if (this.demo.phase === "gameOver") this.newDemo()
    this.demoView.render(this.demo)

    // Menu navigation.
    const n = this.items.length
    if (inp.navPressed("up")) this.move(-1)
    if (inp.navPressed("down")) this.move(1)
    const item = this.items[this.selected]
    if (item.change && (inp.navPressed("left") || inp.navPressed("right"))) {
      item.change(inp.navPressed("left") ? -1 : 1)
      this.changed()
    }
    if (inp.pressedByAnyone("confirm") && item.activate) {
      this.sfx.menu()
      item.activate()
      this.changed()
      return
    }
    this.selected = (this.selected + n) % n

    for (let i = 0; i < n; i++) {
      const on = i === this.selected
      this.texts[i]
        .setText(this.items[i].label())
        .setColor(on ? "#f4e04d" : "#f2f2ea")
        .setFontStyle(on ? "bold" : "")
    }
    this.highlight.setY(this.texts[this.selected].y)
    const pad = inp.device(0) === "gamepad"
    this.controlsText.setText(
      pad
        ? "Gamepad: Stick move · Ⓐ dink · Ⓑ drive · Ⓧ smash · Start pause   |   Menu: D-pad + Ⓐ"
        : "Keyboard: WASD or Arrows move · Q/Z dink · E/X drive · R/C smash · Esc pause\nPlayer 2: IJKL · U dink · O drive · P smash   |   Menu: Up/Down + Enter",
    )
    this.focusHint.setVisible(!document.hasFocus())
  }

  private move(d: 1 | -1): void {
    this.selected = (this.selected + d + this.items.length) % this.items.length
    this.sfx.menu()
  }

  private changed(): void {
    saveSettings(this.settings)
    this.sfx.enabled = this.settings.sound
  }
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}
