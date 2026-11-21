import { describe, expect, it } from 'vitest'
import { actOptions, applyAct, applyClaims, claimOptions, newRound } from '../../src/engine/round.ts'

const fresh = (): ReturnType<typeof newRound> =>
  newRound({ seed: 7, roundWind: 27, dealer: 0, honba: 0, sticks: 0, scores: [25000, 25000, 25000, 25000] })

describe('round flow', () => {
  it('deals 13 tiles each and the dealer draws a 14th', () => {
    const s = fresh()
    expect(s.players.map((p) => p.hand.length)).toEqual([14, 13, 13, 13])
    expect(s.wall.length).toBe(136 - 14 - 53)
    expect(s.phase).toBe('act')
    expect(s.turn).toBe(0)
  })

  it('the same seed deals the same hands', () => {
    expect(fresh().players.map((p) => p.hand)).toEqual(fresh().players.map((p) => p.hand))
  })

  it('a discard opens the claim window and passing moves the turn', () => {
    const s = fresh()
    const tile = actOptions(s).discards[0] ?? -1
    applyAct(s, { type: 'discard', tile })
    expect(s.phase).toBe('claim')
    expect(s.players[0]?.discards.at(-1)?.tile).toBe(tile)
    for (const seat of [1, 2, 3]) expect(claimOptions(s, seat)).toBeDefined()
    applyClaims(s, {})
    expect(s.turn).toBe(1)
    expect(s.players[1]?.hand.length).toBe(14)
  })

  it('exhausting the wall ends in a draw with tenpai payments summing to zero', () => {
    const s = fresh()
    let guard = 0
    while (s.phase !== 'over' && guard++ < 500) {
      if (s.phase === 'act') applyAct(s, { type: 'discard', tile: s.drawn ?? actOptions(s).discards[0] ?? -1 })
      else applyClaims(s, {})
    }
    expect(s.phase).toBe('over')
    expect(s.result?.type).toBe('draw')
    expect(s.result?.deltas.reduce((a, b) => a + b, 0)).toBe(0)
  })
})
