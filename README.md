# mahjong-teacher

A browser Riichi mahjong game you learn by playing. Play East-only or a full
hanchan against three easy, seeded opponents. At any moment press ✎ (or F12)
to freeze the table, mark anything (rectangle, arrow, circle, pen, text, or tap
a tile/meld/discard/score/dora to pick it) and ask a question in English or
Polish. Claude answers from your own plan via `claude -p` (no API key); the
engine's facts win over the model's. Each thread stays open until you say
"ok that is clear", and the whole play-through is logged for a tutorial.

Mark something and tap ➤ without typing: Claude answers at once with what it
means, a small picture (tiles, a spotlight on the table, the Japanese term) and
what it would teach next. Tap ✗ for another way, type to steer it, ✓ when it is
clear. 🎓 plays the tutorial built from everything marked so far (also
`?tutorial=1`); `DOCS-tutorial.md` is the same tutorial as pictures.

- Play on the PC: `./run.sh`, or the installed service at http://127.0.0.1:8797/
- Phone: https://mahjong.kuhy.duckdns.org (Google sign-in; answers come from the
  PC worker through Firebase, no inbound port).
- Tutorial brief from a log: `pnpm tutorial-brief ~/data/mahjong-teacher/logs/play-<id>.json`
- Does the tutorial explain every marked item? `pnpm tutorial-coverage` (OK or the items with no scene)

Docs: `DOCS-features.md` (flows and checks), `DOCS-design.md` (rules sources),
`DOCS-relay.md` (phone relay, credential, units). Commands: `CLAUDE.md`.
