# Design sources

Ruleset: Riichi (Japanese), no red fives. Sources: European Mahjong Association
"Riichi Competition Rules" (EMA RCR, 2016) and the World Riichi Championship
rules (WRC 2022); score table cross-checked with the standard non-dealer /
dealer tables (e.g. riichi.wiki "Scoring").

| ID | Constant / rule | Value | Source |
|---|---|---|---|
| Y1 | Yaku and han (closed/open) | `src/engine/yaku.ts` TABLE | EMA RCR §8, WRC 2022 yaku list |
| F1 | Base fu | 20 | EMA RCR §9 |
| F2 | Closed ron / tsumo fu | +10 / +2 (not pinfu) | EMA RCR §9 |
| F3 | Triplet fu | 2 open simple, x2 terminal/honour, x2 concealed, x4 kan | EMA RCR §9 |
| F4 | Value pair, single-wait fu | +2 each (double wind pair +4) | EMA RCR §9 (double wind: WRC) |
| F5 | Chiitoitsu / pinfu tsumo | 25 / 20 fixed | EMA RCR §9 |
| F6 | Open hand with 20 fu | rounded to 30 | EMA RCR §9 |
| P1 | Basic points | fu x 2^(han+2), mangan cap 2000; 6-7 han 3000, 8-10 4000, 11-12 6000, 13+ 8000 | EMA RCR §10 |
| P2 | Honba | +300 per ron, +100 per payer on tsumo | EMA RCR §11 |
| P3 | Riichi deposit | 1000, to the next winner; carried over on draws | EMA RCR §6 |
| P4 | Exhaustive draw | 3000 from noten to tenpai players | EMA RCR §11 |
| M1 | Start points | 25000 each | EMA RCR §3 |
| M2 | Renchan | dealer win or dealer tenpai at a draw | EMA RCR §12 |
| M3 | Match end | after East 4 (East-only) / South 4 (hanchan), or any score below 0 | EMA RCR §12; tobi: WRC |
| A1 | Easy AI | genbutsu fold, value-honour pons, always riichi when tenpai | [design guess] for a learner |
| U1 | AI step delay | 450 ms | [design guess] |
| U2 | Music tempo, scale | 72 bpm, C major pentatonic | [design guess], kuhy's reference: calm menu loop |

Deferred rules (not implemented, listed so the tutorial does not claim them):
West-round extension, agari-yame, abortive draws (kyuushu, four winds, four
riichi, four kans), double/triple ron (head bump is used), nagashi mangan,
chankan, red fives, pao. real activity: Riichi mahjong itself (rules above).
