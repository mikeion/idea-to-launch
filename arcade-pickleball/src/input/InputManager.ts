import Phaser from "phaser"
import type { Intent, PlayerId } from "../systems/types"
import { GAMEPAD_BUTTONS, GAMEPAD_GLYPHS, KEYBOARD, STICK_DEADZONE, type Action } from "./bindings"

export type Device = "keyboard" | "gamepad"

const ACTIONS = Object.keys(GAMEPAD_BUTTONS) as Action[]

/**
 * Turns keyboard and gamepad state into per-player actions. Keyboard controls
 * both players (left and right hand); gamepad 1 drives player 1, gamepad 2 player 2.
 * Call update() once per frame before reading.
 */
export class InputManager {
  private keys: [Map<Action, Phaser.Input.Keyboard.Key[]>, Map<Action, Phaser.Input.Keyboard.Key[]>]
  private down: [Set<Action>, Set<Action>] = [new Set(), new Set()]
  private prevDown: [Set<Action>, Set<Action>] = [new Set(), new Set()]
  private stick: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]
  private lastDevice: [Device, Device] = ["keyboard", "keyboard"]

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!
    this.keys = [0, 1].map((p) => {
      const map = new Map<Action, Phaser.Input.Keyboard.Key[]>()
      for (const action of ACTIONS) {
        map.set(
          action,
          KEYBOARD[p][action].map((name) => kb.addKey(name, false)),
        )
      }
      return map
    }) as InputManager["keys"]
  }

  update(): void {
    const pads = this.scene.input.gamepad?.getAll() ?? []
    for (const p of [0, 1] as PlayerId[]) {
      this.prevDown[p] = this.down[p]
      const down = new Set<Action>()
      let kbUsed = false
      for (const [action, keys] of this.keys[p]) {
        if (keys.some((k) => k.isDown)) {
          down.add(action)
          kbUsed = true
        }
      }

      let sx = 0
      let sy = 0
      const pad = pads[p]
      if (pad) {
        let padUsed = false
        for (const action of ACTIONS) {
          if (GAMEPAD_BUTTONS[action].some((i) => pad.buttons[i]?.pressed)) {
            down.add(action)
            padUsed = true
          }
        }
        const lx = pad.axes[0]?.getValue() ?? 0
        const ly = pad.axes[1]?.getValue() ?? 0
        if (Math.hypot(lx, ly) > STICK_DEADZONE) {
          sx = lx
          sy = ly
          padUsed = true
        }
        if (padUsed) this.lastDevice[p] = "gamepad"
      }
      if (kbUsed) this.lastDevice[p] = "keyboard"

      this.down[p] = down
      this.stick[p] = { x: sx, y: sy }
    }
  }

  isDown(player: PlayerId, action: Action): boolean {
    return this.down[player].has(action)
  }

  /** True only on the frame the action went down. */
  pressed(player: PlayerId, action: Action): boolean {
    return this.down[player].has(action) && !this.prevDown[player].has(action)
  }

  pressedByAnyone(action: Action): boolean {
    return this.pressed(0, action) || this.pressed(1, action)
  }

  intent(player: PlayerId): Intent {
    let mx = (this.isDown(player, "right") ? 1 : 0) - (this.isDown(player, "left") ? 1 : 0)
    let my = (this.isDown(player, "down") ? 1 : 0) - (this.isDown(player, "up") ? 1 : 0)
    if (mx === 0 && my === 0) {
      mx = this.stick[player].x
      my = this.stick[player].y
    }
    return {
      moveX: mx,
      moveY: my,
      dink: this.pressed(player, "dink"),
      drive: this.pressed(player, "drive"),
    }
  }

  device(player: PlayerId): Device {
    return this.lastDevice[player]
  }

  /** Button or key label for an action, matching the device the player last used. */
  prompt(player: PlayerId, action: Action): string {
    if (this.lastDevice[player] === "gamepad") return GAMEPAD_GLYPHS[action] ?? action
    return KEYBOARD[player][action][0] ?? action
  }

  /** Short label for how the player moves. */
  movePrompt(player: PlayerId): string {
    if (this.lastDevice[player] === "gamepad") return "Stick"
    return player === 0 ? "WASD" : "IJKL"
  }
}
