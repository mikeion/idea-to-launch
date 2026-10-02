import type Phaser from "phaser"
import { CONFIG } from "../config"

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Text style with a size floor so nothing drops below readable on a 7" 1280x800 screen. */
export function textStyle(
  size: number,
  color = "#f2f2ea",
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${Math.max(size, CONFIG.view.minFontPx)}px`,
    color,
    stroke: "#0b0e12",
    strokeThickness: Math.max(3, Math.round(size / 8)),
    ...extra,
  }
}

export const PLAYER_CSS = ["#6f9dff", "#ffa66b"]
