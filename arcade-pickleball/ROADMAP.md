# Roadmap

The full, editable roadmap lives in the "Arcade Pickleball Roadmap" doc (private; ask the owner for the link). This is a summary for anyone working in the code.

## Phases and gates

1. **Playtest (now):** the web prototype, played by the owner and then 5 to 10 outside testers.
   Gate: the dink-then-smash loop is fun.
2. **3D slice (about 2 to 3 months):** move to Unity (if consoles matter) or Godot 4 (Steam/Steam Deck only).
   One court, 2 to 4 characters, toon shading, effects, real audio.
   Gate: it looks great and is still fun.
3. **Steam early access (6 to 12 months in):** 8+ characters, doubles, more courts, couch play, online with friends.
   Gate: a steady player base.
4. **Online and ranked (after launch):** public matchmaking for singles and doubles, then ranked seasons
   (rollback netcode; a team-aware rating such as OpenSkill).

## How to playtest

Use the published web build (or `npm run dev`), about 20 minutes: How to play, then Practice, then a full game
vs Medium CPU, then one game with Timing assist off. Report: tense moments, unfair or confusing points,
whether timing is readable without the ring, whether you could judge ball height, smash feel, CPU fairness,
and whether you wanted to play again.

## Notes for the engine move

- `src/systems/` and `src/entities/` (physics, rules, pressure, CPU AI) have no Phaser imports; port them as-is
  and keep `src/config.ts` as the tuning source of truth.
- The simulation is deterministic (fixed 120 Hz step, seeded RNG), which rollback netcode needs. Keep it that way.
- The bot-vs-bot simulation tests (`test/sim.test.ts`) are the balance regression suite; port them too.
