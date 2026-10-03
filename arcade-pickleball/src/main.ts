import Phaser from "phaser"
import { CONFIG } from "./config"
import { COLORS } from "./render/draw"
import { BootScene } from "./scenes/BootScene"
import { HowToScene } from "./scenes/HowToScene"
import { MatchScene } from "./scenes/MatchScene"
import { MenuScene } from "./scenes/MenuScene"

// Designed at the Steam Deck's native 1280x800 and scaled to fit other screens.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: CONFIG.view.width,
  height: CONFIG.view.height,
  backgroundColor: COLORS.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  // smoothStep would clamp each frame's delta to 1/60s, slowing the whole game down
  // whenever the frame rate dips. Scenes use real elapsed time (capped at 100ms) instead.
  fps: { target: 60, smoothStep: false },
  scene: [BootScene, MenuScene, MatchScene, HowToScene],
})

// Handy for poking at the game from the browser console while tuning.
;(window as unknown as { game: Phaser.Game }).game = game
