import Phaser from "phaser"
import { CONFIG } from "./config"
import { COLORS } from "./render/draw"
import { BootScene } from "./scenes/BootScene"
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
  fps: { target: 60 },
  scene: [BootScene, MenuScene, MatchScene],
})

// Handy for poking at the game from the browser console while tuning.
;(window as unknown as { game: Phaser.Game }).game = game
