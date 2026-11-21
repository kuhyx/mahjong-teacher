import { describe, expect, it } from 'vitest'
import { playMatch, stateHash } from '../../src/ai/autoplay.ts'
import { placements } from '../../src/engine/match.ts'

describe('headless match', () => {
  it('plays an East-only match to the end with points conserved', () => {
    const m = playMatch(11, 'east')
    expect(m.over).toBe(true)
    expect(m.history.length).toBeGreaterThanOrEqual(4)
    expect(m.scores.reduce((a, b) => a + b, 0) + m.sticks * 1000).toBe(100000)
    expect(placements(m.scores)).toHaveLength(4)
  })

  it('replays identically from the same seed (C3)', () => {
    expect(stateHash(playMatch(5, 'east'))).toBe(stateHash(playMatch(5, 'east')))
    expect(stateHash(playMatch(5, 'east'))).not.toBe(stateHash(playMatch(6, 'east')))
  })

  it('a full hanchan runs South rounds', () => {
    const m = playMatch(3, 'hanchan')
    expect(m.over).toBe(true)
    expect(m.history.some((h) => h.label.startsWith('South')) || m.scores.some((s) => s < 0)).toBe(true)
  })

  it('wins happen and every win has a yaku and positive points', () => {
    const wins = [1, 2, 3, 4].flatMap((seed) => playMatch(seed, 'east').history).filter((h) => h.result.type !== 'draw')
    expect(wins.length).toBeGreaterThan(0)
    for (const w of wins) {
      expect(w.result.score?.yaku.length).toBeGreaterThan(0)
      expect(w.result.deltas[w.result.winner]).toBeGreaterThan(0)
    }
  })
})
