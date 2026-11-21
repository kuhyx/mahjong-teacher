import { describe, expect, it } from 'vitest'
import { coverage } from '../../src/tutorial/coverage.ts'
import { parseDemo } from '../../src/tutorial/demo.ts'
import { SCENES, tutorialMatch } from '../../src/tutorial/scenes.ts'
import { emptyLog, type ConfusionItem, type PlayLog } from '../../src/log/log.ts'
import { tableSvg } from '../../src/web/render/table.ts'

const item = (id: string, entities: [string, string][], q = 'what?'): ConfusionItem => ({
  id, createdAt: '', topics: ['tile'], entities: entities.map(([entity, label]) => ({ entity, label })), marks: [], screenshot: '',
  transcript: [{ role: 'user', text: q, at: '', corrected: [] }], snapshot: null, sessionId: null, cleared: false, clearedAt: null, flagged: false,
})
const log = (items: ConfusionItem[]): PlayLog => ({ ...emptyLog('fx', 1, 'hanchan', ''), items })

// Every marked item kuhy's real logs hold (2026-11-21), as fixtures.
const REAL = log([
  item('i1', [['button:east', 'East-only game (tonpuusen)'], ['button:hanchan', 'full game, East and South rounds (hanchan)']]),
  item('i2', [['tile:winning hand of East 1:2', '3 of characters (man) (winning hand of East 1)']]),
  item('i3', [['dora', 'dora indicators: 1 of characters (man) (the dora is the next tile in order)']]),
  item('i4', [['hand:0:11', 'Chun (Red dragon) in your hand']], 'Ile to jest han?'),
  item('i5', [['hand:0:7', '3 of bamboo (sou) in your hand'], ['hand:0:5', '2 of bamboo (sou) in your hand']]),
  item('i6', [['score:0', 'score and seat wind of you: 25000 points, East seat (dealer)'], ['round', 'round 東1, 0 honba, 0 riichi sticks on the table']]),
])

describe('tutorial scenes (6662507c)', () => {
  it('every step is a valid demo whose table spotlights exist on the tutorial table', () => {
    const svg = tableSvg(tutorialMatch(), { playable: [], riichiChoices: null })
    for (const s of SCENES) {
      expect(s.steps.length).toBeGreaterThan(0)
      for (const st of s.steps) {
        expect(parseDemo(st)).toEqual(st)
        for (const f of st.focus ?? []) expect(svg).toContain(`data-entity="${f}"`)
      }
    }
  })
  it('the first step that uses a term shows its gloss chip; terms are glossed once', () => {
    const seen = new Set<string>()
    for (const s of SCENES) for (const st of s.steps) if (st.gloss) {
      expect(seen.has(st.gloss.jp)).toBe(false)
      seen.add(st.gloss.jp)
    }
    expect(seen.size).toBeGreaterThanOrEqual(8)
  })
  it('the dora scene uses the tutorial table real dora indicator', () => {
    const dora = SCENES.find((s) => s.id === 'dora')
    expect(dora?.steps[0]?.focus).toContain('dora')
  })
})

describe('tutorial coverage (6662507c C6)', () => {
  it('every item in the real logs is explained by a scene', () => {
    const r = coverage([REAL], SCENES)
    expect(r.missing).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.rows.find((x) => x.item === 'i4')?.scenes).toContain('honors')
  })
  it('removing a scene makes it fail', () => {
    const r = coverage([REAL], SCENES.filter((s) => s.id !== 'dora'))
    expect(r.ok).toBe(false)
    expect(r.missing.map((m) => m.item)).toEqual(['i3'])
  })
  it('an item nothing explains fails; no topic fallback', () => {
    const r = coverage([log([item('i9', [['wall', 'tiles left in the live wall: 69']])])], SCENES)
    expect(r.ok).toBe(false)
  })
  it('an item with no picked entity is matched by its question words', () => {
    expect(coverage([log([item('i8', [], 'what is dora?')])], SCENES).ok).toBe(true)
    expect(coverage([log([item('i8', [], 'show me')])], SCENES).ok).toBe(false)
  })
})
