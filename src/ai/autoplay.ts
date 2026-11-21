import { newMatch, nextRound, type MatchLength, type MatchState } from '../engine/match.ts'
import { applyAct, applyClaims } from '../engine/round.ts'
import type { ClaimAction } from '../engine/round_types.ts'
import { EasyAi } from './easy.ts'

/** Seat AIs for a match: seat 0 is the bot that stands in for the human in agent runs. */
export function makeAis(seed: number): EasyAi[] {
  return [0, 1, 2, 3].map((seat) => new EasyAi((seed * 31 + seat * 7919) >>> 0))
}

/** Advance the current round by one decision point using the AIs. */
export function stepWithAis(m: MatchState, ais: EasyAi[]): void {
  const s = m.round
  if (s.phase === 'over') {
    nextRound(m)
    return
  }
  if (s.phase === 'act') {
    applyAct(s, ais[s.turn]?.act(s) ?? { type: 'tsumo' })
    return
  }
  const decisions: Partial<Record<number, ClaimAction>> = {}
  for (let seat = 0; seat < 4; seat++) if (seat !== s.lastDiscard?.seat) decisions[seat] = ais[seat]?.claim(s, seat) ?? { type: 'pass' }
  applyClaims(s, decisions)
}

export function playMatch(seed: number, length: MatchLength, maxSteps = 200000): MatchState {
  const m = newMatch(seed, length)
  const ais = makeAis(seed)
  let steps = 0
  while (!m.over) {
    if (steps++ > maxSteps) throw new Error('match did not finish')
    stepWithAis(m, ais)
  }
  return m
}

/** FNV-1a over the match history and scores, for replay checks. */
export function stateHash(m: MatchState): string {
  const text = JSON.stringify({ scores: m.scores, history: m.history })
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16)
}
