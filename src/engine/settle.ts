import { waitsOf } from './decompose.ts'
import type { RoundState } from './round_types.ts'
import { scoreWin } from './score.ts'
import { sortKinds } from './tiles.ts'
import type { WinInput } from './types.ts'

// Payments: DOCS-design.md rows P2 (honba 300 per ron / 100 per payer),
// P3 (riichi sticks to the winner) and P4 (noten penalty 3000 split).

export function isTenpai(s: RoundState, seat: number): boolean {
  const pl = s.players[seat]
  return pl !== undefined && waitsOf(pl.hand, pl.melds.length).length > 0
}

export function settleWin(s: RoundState, winner: number, loser: number, tsumo: boolean, input: WinInput): void {
  const score = scoreWin(input)
  if (!score) throw new Error('settleWin without yaku')
  const deltas = [0, 0, 0, 0]
  if (tsumo) {
    for (let seat = 0; seat < 4; seat++) {
      if (seat === winner) continue
      const pay = (seat === s.dealer ? score.payments.dealer : score.payments.other) + 100 * s.honba
      deltas[seat] = -pay
      deltas[winner] = (deltas[winner] ?? 0) + pay
    }
  } else {
    const pay = score.ron + 300 * s.honba
    deltas[loser] = -pay
    deltas[winner] = pay
  }
  deltas[winner] = (deltas[winner] ?? 0) + 1000 * s.sticks
  s.sticks = 0
  for (let i = 0; i < 4; i++) s.scores[i] = (s.scores[i] ?? 0) + (deltas[i] ?? 0)
  s.phase = 'over'
  s.events.push({ t: 'win', seat: winner, from: loser, tsumo })
  s.result = {
    type: tsumo ? 'tsumo' : 'ron', winner, loser, score, deltas,
    hand: sortKinds([...input.concealed]),
    tenpai: [0, 1, 2, 3].map((i) => i === winner),
  }
}

export function settleDraw(s: RoundState): void {
  const tenpai = [0, 1, 2, 3].map((seat) => isTenpai(s, seat))
  const n = tenpai.filter(Boolean).length
  const deltas = tenpai.map((t) => (n === 0 || n === 4 ? 0 : t ? 3000 / n : -3000 / (4 - n)))
  for (let i = 0; i < 4; i++) s.scores[i] = (s.scores[i] ?? 0) + (deltas[i] ?? 0)
  s.phase = 'over'
  s.events.push({ t: 'draw_game' })
  s.result = { type: 'draw', winner: -1, loser: -1, score: null, deltas, hand: [], tenpai }
}
