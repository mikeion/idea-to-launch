# Arcade Pickleball — Project Plan

An arcade-style pickleball game built around one core idea: **the tension of the dink exchange, then the sudden attack.** If that loop isn't fun, nothing else matters, so we build and test it first.

## How to use this plan (for Claude Code)

- Work one milestone at a time. Do not start the next milestone until the current one's "Done when" checklist passes and the human has playtested it.
- Keep every gameplay number (speeds, gravity, meter rates, hitbox sizes) in `src/config.ts` so tuning never requires touching logic.
- Prefer small, runnable steps. After each step, the game should still launch with `npm run dev`.
- When a design choice is ambiguous, pick the simplest option, leave a `// DESIGN:` comment, and mention it in your summary.

## Tech stack

- **TypeScript + Phaser 3**, bundled with **Vite**. Runs in the browser, no install for playtesters, easy to share as a link.
- **View:** angled top-down (3/4) court. The ball tracks a height value (`z`) separate from its court position, drawn with a shadow on the ground. Height is what makes dinks, pop-ups and smashes readable, so it is core, not polish.
- **Input:** all controls go through an input abstraction (actions like `move`, `dink`, `drive`, `smash`, `special`), never raw keys in gameplay code. Keyboard and gamepad both map to these actions from Milestone 1.
- **Engine decision point:** Phaser is for fast prototyping. After Milestone 2, decide whether to keep Phaser (Steam/Steam Deck via a desktop wrapper like Electron or Tauri) or rebuild in Godot/Unity (if consoles become a real goal). Keep game logic separate from Phaser-specific rendering code where practical, so the design and tuning carry over either way.

## Platform targets

- **Now:** browser, for fast playtesting.
- **Release:** Steam (Windows/Linux) and **Steam Deck**.
- **Maybe later:** consoles (would likely require an engine change, see above).

### Steam Deck requirements (apply from the start)

- **Fully playable with a gamepad.** No keyboard or mouse required anywhere, including menus, name entry and settings.
- **Native resolution 1280x800 (16:10).** Design the court and UI at this size first, then scale for other screens. No important UI cut off at 16:9.
- **Readable text on a 7" screen.** Minimum font size around 9pt equivalent at 1280x800; check this every milestone.
- **Controller button prompts** (A/B/X/Y style glyphs) shown when a gamepad is active, keyboard prompts when keyboard is active.
- **Runs at a steady 60fps** on modest hardware; avoid heavy effects that would drain the battery.

```
src/
  main.ts          # Phaser game setup
  config.ts        # all tunable numbers
  scenes/          # Boot, Match, Menu
  entities/        # Ball, Player, Paddle
  systems/         # physics, rules, scoring, pressure meter, AI
```

## Simplified arcade rules

- Doubles court with a kitchen (non-volley zone) on each side of the net.
- **Kitchen rule:** volleying while standing in the kitchen is a fault. This is what creates the dink game, so keep it.
- **Rally scoring to 7**, win by 2. (Simpler and faster than real side-out scoring.)
- Two-bounce rule: include as a toggle in `config.ts`, default **off** for the prototype.
- Serves: simple underhand serve diagonally across, no complex foot-fault rules.

---

## Milestone 1 — The dink prototype (the make-or-break test)

Goal: two players, singles, one paddle each, and a ball. Nothing else.

- Court with net and kitchen lines drawn with simple shapes (no art yet).
- Ball with position, height, velocity, gravity and bounce; shadow on the ground.
- Players move freely. Hitting is automatic when the ball is in reach, but the player chooses the shot with two buttons: **soft (dink)** and **hard (drive)**.
- Shot quality depends on timing: a well-timed dink stays low over the net; a mistimed one floats higher.
- Kitchen-volley fault and basic scoring.
- Input abstraction with keyboard and gamepad mappings; game renders at 1280x800.

**Done when:** two people can play a full game to 7 (on one keyboard, or with two gamepads), and a rally of 5+ dinks happens naturally. Then the human playtests and answers: _does waiting for the pop-up feel tense?_

## Milestone 2 — Pressure and the attack

Goal: make the dink-then-attack rhythm the heart of the game.

- **Pressure meter** for each side. Each dink in a row fills both meters. Higher pressure means a narrower timing window, so mistakes (pop-ups) become more likely.
- A ball that pops up high triggers a visible "smash opportunity" (ball glows, slight slow-motion).
- **Smash** shot: fast, hard to return, but risky if the ball wasn't high enough.
- Screen shake, hit-stop and simple sound effects on smashes.

**Done when:** rallies naturally build tension and end in a satisfying attack more often than in an unforced error.

## Milestone 3 — Doubles and AI

- Four players: 2v2 with local co-op (2 humans vs 2 AI, or human + AI partner).
- Basic AI: positions near the kitchen line, dinks when the ball is low, smashes when it's high, with a difficulty setting that changes reaction time and error rate.
- Partner logic: AI covers its half of the court and calls off the human on shared balls.
- Small comedic penalty when partners collide going for the same ball.

**Done when:** a solo player can enjoy a full doubles match against AI.

## Milestone 4 — Characters and special moves

- Character archetypes with different stats:
  - **Banger:** powerful drives, weaker dinks.
  - **Dinker:** precise soft game, slow pressure build for themselves.
  - **All-rounder** and **Speedster** as additional options.
- Special meter that fills from good shots. Specials based on real trick shots:
  - **Erne:** leap around the kitchen to volley near the net.
  - **ATP (around the post):** curving shot that goes around the net post.
- Character select screen.

**Done when:** different characters clearly change how a match plays.

## Milestone 5 — Polish and shareable build

- Menus, pause, rematch button, match settings (difficulty, score target, two-bounce toggle).
- Art pass (simple stylized sprites), music, crowd/ambient sound.
- Controller button glyphs and full gamepad navigation of every menu.
- Production web build deployed as a static site (e.g. GitHub Pages or Netlify) for playtesters.
- Desktop build (Electron or Tauri, or engine export if rebuilt) tested on a Steam Deck: gamepad-only play, 1280x800 layout, text readability, steady 60fps.

## Later ideas (not scheduled)

- Online multiplayer.
- Wacky courts (wind, moving obstacles, beach/rooftop themes).
- Tournament or ladder mode.
- Mobile touch controls.

## Playtest questions after every milestone

1. Was there a moment that felt genuinely tense or exciting?
2. Did any point end in a way that felt unfair or confusing?
3. Did you want to play another game right away?
