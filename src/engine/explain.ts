import { isFuriten } from './claims.ts'
import { shanten, waitsOf } from './decompose.ts'
import type { MatchState } from './match.ts'
import { doraIndicators, seatWindOf } from './round.ts'
import { doraFromIndicator, tileCode } from './tiles.ts'

// Engine facts handed to the model with every question. The bridge checks the
// model's stated facts against these and the engine wins (C10).

export interface Explain {
  round: string
  turn: number
  phase: string
  wallLeft: number
  seatWind: string
  roundWind: string
  dealer: boolean
  scores: number[]
  hand: string[]
  melds: { kind: string; tiles: string[] }[]
  discards: string[][]
  riichi: boolean[]
  doraIndicators: string[]
  dora: string[]
  shanten: number
  tenpai: boolean
  waits: string[]
  furiten: boolean
  lastResult: null | {
    type: string
    winner: number
    yaku: { name: string; han: number }[]
    han: number
    fu: number
    fuParts: { why: string; fu: number }[]
    limit: string
    deltas: number[]
  }
}

const WIND = ['East', 'South', 'West', 'North']

/** Facts about seat 0 (the player) and the table, all in "5m" tile codes. */
export function explain(m: MatchState): Explain {
  const s = m.round
  const pl = s.players[0]
  const hand = pl?.hand ?? []
  const melds = pl?.melds ?? []
  const handForWaits = hand.length % 3 === 1 ? hand : null
  const waits = handForWaits ? waitsOf(handForWaits, melds.length) : []
  const r = s.result
  return {
    round: `${WIND[s.roundWind - 27] ?? ''} ${String(s.dealer + 1)}, ${String(s.honba)} honba, ${String(s.sticks)} riichi sticks`,
    turn: s.turn,
    phase: s.phase,
    wallLeft: s.wall.length,
    seatWind: WIND[seatWindOf(s, 0) - 27] ?? '',
    roundWind: WIND[s.roundWind - 27] ?? '',
    dealer: s.dealer === 0,
    scores: [...s.scores],
    hand: hand.map(tileCode),
    melds: melds.map((x) => ({ kind: x.kind, tiles: x.tiles.map(tileCode) })),
    discards: s.players.map((p) => p.discards.map((d) => tileCode(d.tile))),
    riichi: s.players.map((p) => p.riichi),
    doraIndicators: doraIndicators(s).map(tileCode),
    dora: doraIndicators(s).map((k) => tileCode(doraFromIndicator(k))),
    shanten: shanten(hand, melds.length),
    tenpai: waits.length > 0,
    waits: waits.map(tileCode),
    furiten: waits.length > 0 && isFuriten(s, 0),
    lastResult: r && r.score
      ? {
          type: r.type, winner: r.winner, yaku: r.score.yaku.map((y) => ({ name: y.name, han: y.han })),
          han: r.score.han, fu: r.score.fu, fuParts: r.score.fuParts, limit: r.score.limit, deltas: r.deltas,
        }
      : null,
  }
}
