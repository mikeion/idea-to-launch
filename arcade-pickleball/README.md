# Arcade Pickleball

An arcade pickleball game built around the tension of the dink exchange and the sudden attack. See [PLAN.md](PLAN.md) for the full milestone plan.

**Status: Milestone 1 (the dink prototype) is built and waiting for a human playtest.**

## Run it

```bash
cd arcade-pickleball
npm install
npm run dev        # open the printed URL
npm test           # rules, physics, scoring, and a bot-vs-bot simulation
npm run build      # static site in dist/
```

## Controls

|              | Player 1 (near, blue)          | Player 2 (far, orange) | Gamepad            |
| ------------ | ------------------------------ | ---------------------- | ------------------ |
| Move         | W A S D                        | I J K L                | Left stick / D-pad |
| Dink (soft)  | Q                              | U                      | Ⓐ                  |
| Drive (hard) | E                              | O                      | Ⓑ                  |
| Pause        | Esc                            |                        | Start              |
| Quit to menu | Backspace (paused / game over) |                        | Select             |

Gamepad 1 controls player 1 and gamepad 2 controls player 2. The keyboard always works for both players. On-screen prompts switch to the device each player last used.

## How Milestone 1 plays

- **Serve:** the server presses dink (soft, high serve) or drive (hard, flat serve), holding left/right to aim. Serves always land in the diagonal box.
- **Hitting:** press dink or drive as the ball arrives. The swing happens the moment the ball is in reach (your reach ring on the ground lights up yellow). A press up to 0.16s early is remembered and fires when the ball arrives.
- **Timing:** each hit is judged against the ideal contact moment (when the ball is closest to your waist-high sweet spot). The label shows `PERFECT`, `GOOD`, `EARLY` or `LATE`. A well-timed dink skims the net into the kitchen; a mistimed one floats higher **and deeper**, where the opponent can volley it from the kitchen line.
- **Drives** are fast, and fast balls shrink the receiver's timing window. Driving a ball that's below net height means lifting it, so it's less accurate and floats more.
- **Scramble:** if a ball has bounced on your side and is about to get past you, you automatically block it back, but badly (a floater). Volleys never happen automatically, so you can always let an out ball go.
- **Faults:** kitchen volley, net, out, double bounce, short serve or wrong service box. Rally scoring to 7, win by 2. The two-bounce rule is in `src/config.ts` (off).

## Tuning

Every gameplay number is in [`src/config.ts`](src/config.ts). The main levers for the dink game:

- `timing.perfectWindow` / `timing.window`: how forgiving swing timing is.
- `shots.dink.float` / `shots.dink.floatDepth`: how high and deep a mistimed dink sails, i.e. how punishable a pop-up is.
- `timing.fastBallSpeed` / `timing.fastBallMinScale`: how much harder it is to time a fast ball.
- `shots.drive.baseScatter`: the built-in risk of hitting hard.
- `player.reach`, `player.moveSpeed`.

`test/sim.test.ts` plays bot-vs-bot games (bot in `test/bot.ts`, with roughly human timing noise) and checks that games finish and dink rallies of 5+ happen. Rerun it after tuning.

## Layout

```
src/
  main.ts          Phaser game setup (1280x800, scaled to fit)
  config.ts        all tunable numbers
  scenes/          Boot, Menu, Match (Phaser only: input, rendering, HUD)
  entities/        Ball, Player, Paddle (reach and timing)
  systems/         physics, shots, rules, scoring, match flow (no Phaser imports)
  input/           action bindings and the keyboard/gamepad InputManager
  render/          court projection and shape drawing
test/              vitest: rules, physics, scoring, match, bot simulation
```

Game logic in `systems/` and `entities/` never imports Phaser, so it carries over if the engine changes after Milestone 2.
