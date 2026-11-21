# Features and end-to-end flows

| # | Flow | Check (each < 60 s, muted, headless Chromium) |
|---|---|---|
| F1 | Bot plays East-only to the end screen; mark a tile, ask (stub claude), "ok that is clear", log round-trips byte-identically | `pnpm build && node scripts/e2e_done_check.ts` |
| F2 | Human input: discard by click, every call button (chi/pon/kan/riichi/tsumo/ron/pass) is legal | `node scripts/e2e_human.ts` |
| F3 | Same as F2 with touch taps on a 412x915 portrait phone viewport | `node scripts/e2e_human.ts --touch` |
| F4 | Phone relay on real Firebase with the stub claude; unauthenticated write refused | `node scripts/relay_smoke.ts` |
| F5 | Deployed services: page, API and a relay ping through Firebase | `node scripts/health.ts` |
| F6 | Real `claude -p` answer on kuhy's plan, through the live bridge | `curl -X POST -H 'content-type: application/json' --data @ask.json http://127.0.0.1:8797/api/ask` (spends plan usage; done 2026-11-21) |
| F7 | Portrait phone marking: whole hand above the drawer, tool strip clear of the game buttons | `node scripts/e2e_phone_mark.ts` |
| F8 | Public site at phone size, signed in as kuhy, real question through RTDB -> mahjong-relay -> `claude -p` | `node scripts/e2e_relay_live.ts` (spends plan usage) |
| F9 | Android shell `com.kuhy.mahjong` (`app/`): loads the site, one-tap native Google sign-in, answer arrives; off-origin pages get no token | `cd app && flutter test` (bridge logic); device: `phone_deploy.sh <checkout>/app --release --stage ...` then drive it on `phone_vd.sh` |

Unit/property tests (`pnpm test`): scoring table (S1-S8), round flow, headless
matches (determinism, points conserved), log round-trip (fast-check), topic tags,
brief, bridge (stub claude: language, resume, engine-wins correction, no API key),
server (Host/Origin checks, public host gets no API), relay worker (fake RTDB).

The Android app is only a shell around the public site: it stores no data of
its own (logs live on the PC), so it has no sync or export layer. It exists
because the Pixel has no browser and Google blocks sign-in popups inside a
WebView; the app picks the account natively and hands the page an ID token.
