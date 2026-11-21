import { describe, expect, it } from 'vitest'
import { parseDemo, splitDemo } from '../../src/tutorial/demo.ts'

describe('demo block', () => {
  it('splits a fenced demo block out of the answer', () => {
    const r = splitDemo('Meaning.\n\n```demo\n{"tiles":["3m"],"highlight":[0]}\n```\nNext: dora.')
    expect(r.body).toBe('Meaning.\n\nNext: dora.')
    expect(r.demo).toEqual({ tiles: ['3m'], highlight: [0] })
  })
  it('drops bad tile codes, out-of-range highlights and unknown fields', () => {
    expect(parseDemo({ tiles: ['3m', 'xx', '8z', '7z'], highlight: [0, 5, 2], focus: ['score:0', 'bad id!'], evil: 1 }))
      .toEqual({ tiles: ['3m', '7z'], highlight: [0], focus: ['score:0'] })
  })
  it('keeps a gloss, an arrow and pips when well-formed', () => {
    expect(parseDemo({ tiles: ['1m', '2m'], arrow: [0, 1], gloss: { jp: 'ドラ', romaji: 'Dora' }, pips: 2 }))
      .toEqual({ tiles: ['1m', '2m'], arrow: [0, 1], gloss: { jp: 'ドラ', romaji: 'Dora' }, pips: 2 })
  })
  it('returns null on bad JSON or an empty demo, never throws', () => {
    expect(splitDemo('x ```demo\n{nope\n```').demo).toBeNull()
    expect(parseDemo({})).toBeNull()
    expect(parseDemo('str')).toBeNull()
    expect(splitDemo('no block').demo).toBeNull()
  })
})
