# Phone relay and services

- `mahjong-bridge.service` (systemd --user): serves `dist/` on 127.0.0.1:8797,
  writes play logs to `~/data/mahjong-teacher/logs/` and runs `claude -p` for
  the loopback page. Also the static server behind Caddy
  (`mahjong.kuhy.duckdns.org`): that host gets static files only, never `/api`.
- `mahjong-relay.service`: streams `mahjong/v1/requests` in the shared
  `kuhy-syncs` RTDB, claims each request with an ETag write, answers (`ask`,
  `log`, `shot`, `ping`) and writes `mahjong/v1/results/{rid}`; heartbeat at
  `mahjong/v1/worker` every 30 s. No inbound port.
- Who may ask: the shared database rules admit only kuhy's uid for the whole
  tree (`~/src/utils/firebase/database.rules.json`), so this node needs no
  extra rule; any other account or no sign-in gets 401 and the page shows 🔑.
  No uid or email is in this repo or the bundle.
- Credential: `~/.config/mahjong-teacher/firebase_auth.json` (0600, crdt-sync
  format). Interim (2026-11-21): a copy of the tutor session of the same
  account, as tutor itself did. Its own refresh token: run
  `python3 -m tool.seed_session --app mahjong-teacher ...` in
  `~/src/utils/crdt-sync` once (needs one Google consent and the app name in
  `tool/_seeded_apps.py`).
- Phone sign-in: Firebase Auth popup (`authDomain` kuhy-syncs.firebaseapp.com);
  `mahjong.kuhy.duckdns.org` must be an authorized domain of the project.
- PC off or asleep: requests stay queued in RTDB and the page shows ⏻ (worker
  heartbeat older than 90 s). The worker answers them when the PC wakes;
  `Restart=always` + linger bring it back after a reboot.
- Model calls: `claude -p --safe-mode --tools Read` with every API-key variable
  stripped, so usage comes from the plan login of the CLI.

## Firebase Auth domain

Google sign-in from the public site needs `mahjong.kuhy.duckdns.org` in the
`kuhy-syncs` project's Auth authorized domains (added 2026-11-21 through the
Identity Toolkit admin API, `updateMask=authorizedDomains`).
