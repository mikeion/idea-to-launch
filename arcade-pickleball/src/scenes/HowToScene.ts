import Phaser from "phaser"
import { CONFIG } from "../config"
import { InputManager } from "../input/InputManager"
import { COLORS, drawCourt } from "../render/draw"
import { textStyle } from "../render/ui"

const PAGES: { title: string; lines: string[] }[] = [
  {
    title: "The idea",
    lines: [
      "Pickleball's best moments come from the dink game:",
      "soft shots that drop into the kitchen, back and forth, until someone cracks.",
      "",
      "A well-timed dink stays low. A mistimed one pops up high and deep.",
      "Pop-ups glow. That's your chance: SMASH it.",
    ],
  },
  {
    title: "Swinging",
    lines: [
      "Move to the ball, then press a shot as it arrives:",
      "DINK (soft)  ·  DRIVE (hard)  ·  SMASH (overhead, for high balls)",
      "",
      "Your swing is judged on timing: PERFECT, GOOD, EARLY or LATE.",
      "With Timing assist on, a ring closes in on the ball.",
      "Swing when it turns GREEN. If no ring appears, you're out of position.",
      "A red marker on the ground means the ball is going out: let it go!",
    ],
  },
  {
    title: "Rules",
    lines: [
      "Rally scoring to 7, win by 2. Every rally is a point.",
      "",
      "The KITCHEN is the zone next to the net.",
      "You can't volley (hit before the bounce) while standing in it.",
      "",
      "You lose the point if your shot hits the net, lands out,",
      "or if the ball bounces twice on your side.",
      "Serves go diagonally. Press dink for a soft serve, drive for a hard one.",
    ],
  },
  {
    title: "Pressure",
    lines: [
      "Every dink in a row fills the PRESSURE meters (top left).",
      "More pressure means a tighter timing window for everyone:",
      "the longer the rally, the more likely someone pops one up.",
      "",
      "Drives and smashes reset the pressure.",
      "Fast balls are harder to time. Smashing a low ball usually finds the net.",
      "",
      "Tip: start in Practice. The ball machine feeds a pop-up every few shots.",
    ],
  },
]

export class HowToScene extends Phaser.Scene {
  private inp!: InputManager
  private page = 0
  private title!: Phaser.GameObjects.Text
  private body!: Phaser.GameObjects.Text
  private footer!: Phaser.GameObjects.Text

  constructor() {
    super("HowTo")
  }

  create(): void {
    const { width, height } = CONFIG.view
    this.inp = new InputManager(this)
    this.page = 0
    const court = this.add.graphics()
    drawCourt(court, CONFIG)
    court.setAlpha(0.25)
    this.add.rectangle(0, 0, width, height, COLORS.background, 0.5).setOrigin(0)
    this.title = this.add
      .text(width / 2, 120, "", textStyle(52, "#f4e04d", { fontStyle: "bold" }))
      .setOrigin(0.5)
    this.body = this.add
      .text(width / 2, 200, "", textStyle(28, "#f2f2ea", { align: "center", lineSpacing: 12 }))
      .setOrigin(0.5, 0)
    this.footer = this.add.text(width / 2, height - 60, "", textStyle(24, "#c9d1d9")).setOrigin(0.5)
  }

  update(): void {
    const inp = this.inp
    inp.update()
    if (inp.pressedByAnyone("back") || inp.pressedByAnyone("pause"))
      return void this.scene.start("Menu")
    if (inp.navPressed("right") || inp.pressedByAnyone("confirm")) {
      if (this.page === PAGES.length - 1) return void this.scene.start("Menu")
      this.page++
    }
    if (inp.navPressed("left")) this.page = Math.max(0, this.page - 1)

    const p = PAGES[this.page]
    this.title.setText(`${p.title}   ${this.page + 1}/${PAGES.length}`)
    this.body.setText(p.lines.join("\n"))
    const pad = inp.device(0) === "gamepad"
    const next = pad ? "Ⓐ / ▶" : "Enter / →"
    const back = pad ? "◀" : "←"
    const exit = pad ? "Start" : "Esc"
    this.footer.setText(`${next}: next    ${back}: back    ${exit}: menu`)
  }
}
