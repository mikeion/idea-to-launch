// Raw key and button names live only here. Gameplay code only ever sees actions.

export type Action =
  | "left"
  | "right"
  | "up"
  | "down"
  | "dink"
  | "drive"
  | "smash"
  | "special"
  | "confirm"
  | "pause"
  | "back"

/** Phaser key names (Phaser.Input.Keyboard.KeyCodes) per action, one map per player. */
export const KEYBOARD: [Record<Action, string[]>, Record<Action, string[]>] = [
  // Player 1 has two layouts: WASD + Q/E/R, or arrows + Z/X/C (handy when playing the CPU).
  {
    left: ["A", "LEFT"],
    right: ["D", "RIGHT"],
    up: ["W", "UP"],
    down: ["S", "DOWN"],
    dink: ["Q", "Z"],
    drive: ["E", "X"],
    smash: ["R", "C"],
    special: ["F", "V"],
    confirm: ["ENTER", "SPACE", "Q", "Z"],
    pause: ["ESC"],
    back: ["BACKSPACE"],
  },
  {
    left: ["J"],
    right: ["L"],
    up: ["I"],
    down: ["K"],
    dink: ["U"],
    drive: ["O"],
    smash: ["P"],
    special: ["SEMICOLON"],
    confirm: ["U"],
    pause: [],
    back: [],
  },
]

/** Standard-layout gamepad button indices (W3C "standard" mapping, as on Steam Deck / Xbox). */
export const GAMEPAD_BUTTONS: Record<Action, number[]> = {
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  dink: [0], // A
  drive: [1], // B
  smash: [2], // X
  special: [3], // Y
  confirm: [0, 9], // A, Start
  pause: [9], // Start
  back: [8], // Select / View
}

/** Glyph shown in on-screen prompts when the player is using a gamepad. */
export const GAMEPAD_GLYPHS: Partial<Record<Action, string>> = {
  dink: "Ⓐ",
  drive: "Ⓑ",
  smash: "Ⓧ",
  special: "Ⓨ",
  confirm: "Ⓐ",
  pause: "Start",
  back: "Select",
}

export const STICK_DEADZONE = 0.25
