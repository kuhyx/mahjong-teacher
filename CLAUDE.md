# mahjong-teacher

Browser Riichi mahjong game that teaches by letting the player mark anything on
the table and ask Claude (on kuhy's plan, via `claude -p`, never an API key).
Stack: TypeScript + Vite (pnpm), vitest, playwright-core over the system Chromium.
Skills: build-game, build-web-ui, build-backend.

Layout: `src/engine` pure rules (seeded, no `Math.random`), `src/ai` easy AIs and
the autodrive bot, `src/log` play-through log, `src/web` the page, `services/bridge`
loopback `claude -p` bridge, `services/relay` Firebase RTDB worker for the phone.

## Commands

- run: `./run.sh` (bridge + vite dev on http://127.0.0.1:8791/)
- test: `~/.claude/scripts/capped.sh pnpm test`
- lint: `pnpm lint`
- e2e: `~/.claude/scripts/capped.sh pnpm e2e` (done check, headless Chromium, muted, < 60 s)

## Rules

- Write the failing check first, then the code. Commit with a `Todo: 6d3ac82c` trailer.
- Add a `- deploy: <command>` line (installs, releases and health-checks the change) before the first ship.
