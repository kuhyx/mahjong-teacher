# Features and end-to-end flows

| # | Flow | Check (each < 60 s, muted, headless Chromium) |
|---|---|---|
| F1 | Bot plays East-only to the end screen; mark a tile, ask (stub claude), "ok that is clear", log round-trips byte-identically | `pnpm build && node scripts/e2e_done_check.ts` |
| F2 | Human input: discard by click, every call button (chi/pon/kan/riichi/tsumo/ron/pass) is legal | `node scripts/e2e_human.ts` |
| F3 | Same as F2 with touch taps on a 412x915 portrait phone viewport | `node scripts/e2e_human.ts --touch` |
| F4 | Phone relay on real Firebase with the stub claude; unauthenticated write refused | `node scripts/relay_smoke.ts` |
| F5 | Deployed services: page, API and a relay ping through Firebase | `node scripts/health.ts` |
| F6 | Real `claude -p` answer on kuhy's plan (run once by kuhy) | `node scripts/claude_smoke.ts` |

Unit/property tests (`pnpm test`): scoring table (S1-S8), round flow, headless
matches (determinism, points conserved), log round-trip (fast-check), topic tags,
brief, bridge (stub claude: language, resume, engine-wins correction, no API key),
server (Host/Origin checks, public host gets no API), relay worker (fake RTDB).
