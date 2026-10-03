import { CONFIG, type GameConfig } from "./config"

export type Difficulty = "easy" | "medium" | "hard"
export type GameMode = "cpu" | "versus" | "practice"

export interface Settings {
  difficulty: Difficulty
  /** Timing ring around the ball and landing marker. */
  assist: boolean
  twoBounceRule: boolean
  sound: boolean
}

const KEY = "arcade-pickleball.settings"
const DEFAULTS: Settings = {
  difficulty: "medium",
  assist: true,
  twoBounceRule: CONFIG.rules.twoBounceRule,
  sound: true,
}

// Remembered per browser for convenience only; the game works the same without storage.
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // Storage blocked or corrupt: use defaults.
  }
  return { ...DEFAULTS }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Ignore: settings just won't persist.
  }
}

/** The config a match runs with, after settings that change rules. */
export function matchConfig(s: Settings): GameConfig {
  return { ...CONFIG, rules: { ...CONFIG.rules, twoBounceRule: s.twoBounceRule } }
}
