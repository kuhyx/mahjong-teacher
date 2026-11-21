import { roundSeed } from './rng.ts'
import { newRound } from './round.ts'
import type { RoundResult, RoundState } from './round_types.ts'

// Match flow: DOCS-design.md rows M1-M5 (25000 start, renchan, honba, tobi end).
// Deferred (logged in DOCS-design.md): West-round extension, agari-yame,
// abortive draws, double ron (head bump is used), nagashi mangan.

export type MatchLength = 'east' | 'hanchan'
export const START_POINTS = 25000

export interface HandRecord {
  label: string
  result: RoundResult
}

export interface MatchState {
  seed: number
  length: MatchLength
  roundWind: number
  dealer: number
  honba: number
  sticks: number
  handNumber: number
  scores: number[]
  round: RoundState
  history: HandRecord[]
  over: boolean
}

export function roundLabel(roundWind: number, dealer: number, honba: number): string {
  return `${roundWind === 27 ? 'East' : 'South'} ${String(dealer + 1)}${honba > 0 ? ` (${String(honba)} honba)` : ''}`
}

function startRound(m: Omit<MatchState, 'round'> & { round?: RoundState }): RoundState {
  return newRound({
    seed: roundSeed(m.seed, m.handNumber), roundWind: m.roundWind, dealer: m.dealer,
    honba: m.honba, sticks: m.sticks, scores: m.scores,
  })
}

export function newMatch(seed: number, length: MatchLength): MatchState {
  const base = {
    seed, length, roundWind: 27, dealer: 0, honba: 0, sticks: 0, handNumber: 0,
    scores: [START_POINTS, START_POINTS, START_POINTS, START_POINTS], history: [], over: false,
  }
  return { ...base, round: startRound(base) }
}

/** Book-keep a finished hand and deal the next one, or end the match. */
export function nextRound(m: MatchState): void {
  const r = m.round
  if (r.phase !== 'over' || !r.result || m.over) throw new Error('round not over')
  m.history.push({ label: roundLabel(m.roundWind, m.dealer, m.honba), result: r.result })
  m.scores = [...r.scores]
  m.sticks = r.sticks
  const res = r.result
  const renchan = res.type === 'draw' ? res.tenpai[m.dealer] === true : res.winner === m.dealer
  m.honba = renchan || res.type === 'draw' ? m.honba + 1 : 0
  const lastWind = m.length === 'east' ? 27 : 28
  if (m.scores.some((s) => s < 0)) {
    m.over = true
    return
  }
  if (!renchan) {
    if (m.dealer === 3) {
      if (m.roundWind === lastWind) {
        m.over = true
        return
      }
      m.roundWind++
      m.dealer = 0
    } else m.dealer++
  }
  m.handNumber++
  m.round = startRound(m)
}

/** Final order: higher score first, ties to the seat closer to the first dealer (seat 0). */
export function placements(scores: number[]): number[] {
  return [0, 1, 2, 3].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a - b)
}
