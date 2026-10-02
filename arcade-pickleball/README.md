# Arcade Pickleball

An arcade pickleball game built around the tension of the dink exchange and the sudden attack. See [PLAN.md](PLAN.md) for the full milestone plan.

**Status: Milestones 1 (the dink prototype) and 2 (pressure and the attack) are built and waiting for a human playtest.** After this playtest, the plan calls for the engine decision (keep Phaser or move to Godot/Unity).

## Run it

```bash
npm install
npm run dev        # open the printed URL
npm test           # rules, physics, scoring, match flow, and bot-vs-bot simulations
npm run check      # typecheck + formatting + tests (what CI runs)
npm run build      # static site in dist/
```

## Controls

|              | Player 1 (near, blue)          | Player 2 (far, orange) | Gamepad            |
| ------------ | ------------------------------ | ---------------------- | ------------------ |
| Move         | W A S D                        | I J K L                | Left stick / D-pad |
| Dink (soft)  | Q                              | U                      | Ⓐ                  |
| Drive (hard) | E                              | O                      | Ⓑ                  |
| Smash        | R                              | P                      | Ⓧ                  |
| Pause        | Esc                            |                        | Start              |
| Quit to menu | Backspace (paused / game over) |                        | Select             |

Gamepad 1 controls player 1 and gamepad 2 controls player 2. The keyboard always works for both players. On-screen prompts switch to the device each player last used.

## How it plays

### Milestone 1: the dink game

- **Serve:** the server presses dink (soft, high serve) or drive (hard, flat serve), holding left/right to aim. Serves always land in the diagonal box.
- **Hitting:** press a shot button as the ball arrives. The swing happens the moment the ball is in reach (your reach ring on the ground lights up yellow). A press up to 0.16s early is remembered and fires when the ball arrives.
- **Timing:** each hit is judged against the ideal contact moment (when the ball is closest to your sweet spot: waist high, or overhead for a smash). The label shows `PERFECT`, `GOOD`, `EARLY` or `LATE`. A well-timed dink skims the net into the kitchen; a mistimed one floats higher **and deeper**, where it can be attacked.
- **Drives** are fast, and fast balls shrink the receiver's timing window. Driving a ball that's below net height means lifting it, so it's less accurate and floats more. Drives also carry a little built-in risk even when perfectly timed.
- **Scramble:** if a ball has bounced on your side and is about to get past you, you automatically block it back, but badly (a floater). Volleys never happen automatically, so you can always let an out ball go.
- **Faults:** kitchen volley, net, out, double bounce, short serve or wrong service box. Rally scoring to 7, win by 2. The two-bounce rule is in `src/config.ts` (off).

### Milestone 2: pressure and the attack

- **Pressure meters** (top left): every dink in a row fills both meters by 10%. Pressure narrows each player's timing window (down to 40% of normal at full pressure), so the longer the dink rally, the more likely someone pops one up. Any drive, smash or scramble resets both meters.
- **Smash opportunity:** a shot that pops up high (apex 2m or more) makes the ball pulse and glow, plays a cue, and shows `SMASH IT!` over the player who can attack. While that ball is high on their side, the game drops into slight slow motion.
- **Smash:** a fast, downward overhead (about 19 m/s, landing ~3.4m past the net). Smashing a high ball is reliable; smashing a low ball sprays wide or finds the net. A smash from deep slows down to clear the net, so it's less deadly than one from the kitchen line.
- **Juice:** smashes trigger a short freeze-frame (hit-stop), screen shake and a thump. Every hit, bounce, net cord and point has a small synthesized sound (no audio files yet).
- The game-over screen shows **points won by attacks vs unforced errors**, which is the Milestone 2 "done when" measure.

## Tuning

Every gameplay number is in [`src/config.ts`](src/config.ts). The main levers:

- `timing.perfectWindow` / `timing.window`: how forgiving swing timing is.
- `pressure.perDink` / `pressure.maxWindowShrink`: how fast tension builds and how much it bites.
- `shots.dink.float` / `shots.dink.floatDepth`: how high and deep a mistimed dink sails, i.e. how punishable a pop-up is.
- `smash.opportunityApex`: how high a ball must pop up to glow.
- `smash.speed`, `smash.lowContactHeight`, `smash.slowMoScale`, `smash.hitStop`: smash power, risk and feel.
- `timing.fastBallSpeed` / `timing.fastBallMinScale`: how much harder fast balls are to time.
- `player.reach`, `player.moveSpeed`.

`test/sim.test.ts` plays bot-vs-bot games (bot in `test/bot.ts`, with roughly human timing noise) and checks that games finish, dink rallies of 5+ happen, the pressure meters behave, and attacks end more points than unforced errors. Rerun it after tuning.

## Layout

```
src/
  main.ts          Phaser game setup (1280x800, scaled to fit)
  config.ts        all tunable numbers
  scenes/          Boot, Menu, Match (Phaser only: input, rendering, HUD, slow-mo, shake)
  entities/        Ball, Player, Paddle (reach and timing)
  systems/         physics, shots, rules, scoring, match flow, pressure (no Phaser imports)
  input/           action bindings and the keyboard/gamepad InputManager
  render/          court projection and shape drawing
  audio/           synthesized sound effects
test/              vitest: rules, physics, scoring, match, smash, bot simulations
```

Game logic in `systems/` and `entities/` never imports Phaser, so it carries over if the engine changes.

## Moving to its own repository

This folder is self-contained: its own `package.json` and lockfile, `tsconfig.json`, Prettier config, `.gitignore`, `.node-version`, and a CI workflow in `.github/workflows/ci.yml`. That workflow is inert while the game lives inside `idea-to-launch`, and runs as-is once the folder is a repo root. Nothing in it references files outside the folder.

To split it out with its history:

```bash
# from the idea-to-launch repo root
git subtree split --prefix arcade-pickleball -b arcade-pickleball-only
# create an empty arcade-pickleball repo on GitHub, then:
git push git@github.com:<you>/arcade-pickleball.git arcade-pickleball-only:main
```

Afterwards, delete the folder from `idea-to-launch`, and remove the `arcade-pickleball` entries from its root `tsconfig.json` (`exclude`), `.prettierignore` and `README.md`.
