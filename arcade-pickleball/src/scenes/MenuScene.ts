import Phaser from "phaser"
import { CONFIG } from "../config"
import { InputManager } from "../input/InputManager"
import { drawCourt } from "../render/draw"
import { PLAYER_CSS, textStyle } from "../render/ui"
import type { PlayerId } from "../systems/types"

export class MenuScene extends Phaser.Scene {
  private input2!: InputManager
  private controls: Phaser.GameObjects.Text[] = []
  private startHint!: Phaser.GameObjects.Text

  constructor() {
    super("Menu")
  }

  create(): void {
    const { width, height } = CONFIG.view
    this.input2 = new InputManager(this)

    const court = this.add.graphics()
    drawCourt(court, CONFIG)
    court.setAlpha(0.35)

    this.add
      .text(width / 2, 170, "ARCADE PICKLEBALL", textStyle(72, "#f4e04d", { fontStyle: "bold" }))
      .setOrigin(0.5)
    this.add.text(width / 2, 240, "Milestone 1 · the dink prototype", textStyle(28)).setOrigin(0.5)
    this.add
      .text(
        width / 2,
        330,
        [
          "Singles, rally scoring to 7, win by 2.",
          "Volleying from inside the kitchen is a fault.",
          "Time your swing: a late or early dink floats up, and floaters get attacked.",
        ].join("\n"),
        textStyle(24, "#f2f2ea", { align: "center", lineSpacing: 8 }),
      )
      .setOrigin(0.5, 0)

    for (const p of [0, 1] as PlayerId[]) {
      const t = this.add
        .text(
          p === 0 ? width * 0.27 : width * 0.73,
          500,
          "",
          textStyle(24, PLAYER_CSS[p], { align: "center", lineSpacing: 6 }),
        )
        .setOrigin(0.5, 0)
      this.controls.push(t)
    }

    this.startHint = this.add
      .text(width / 2, height - 90, "", textStyle(32, "#ffffff"))
      .setOrigin(0.5)
    this.tweens.add({ targets: this.startHint, alpha: 0.45, yoyo: true, repeat: -1, duration: 700 })
  }

  update(): void {
    const inp = this.input2
    inp.update()
    for (const p of [0, 1] as PlayerId[]) {
      this.controls[p].setText(
        [
          `PLAYER ${p + 1}${p === 0 ? " (near)" : " (far)"}`,
          `Move: ${inp.movePrompt(p)}`,
          `Dink (soft): ${inp.prompt(p, "dink")}`,
          `Drive (hard): ${inp.prompt(p, "drive")}`,
        ].join("\n"),
      )
    }
    const confirm = inp.device(0) === "gamepad" ? "Ⓐ" : "Enter"
    this.startHint.setText(`Press ${confirm} to start`)

    if (inp.pressedByAnyone("confirm")) this.scene.start("Match")
  }
}
