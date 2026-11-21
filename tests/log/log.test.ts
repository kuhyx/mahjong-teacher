import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { emptyLog, parseLog, serializeLog, type PlayLog } from '../../src/log/log.ts'
import { topicsFor } from '../../src/log/topics.ts'

const turn = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  text: fc.string(),
  at: fc.constant('2026-11-21T10:00:00.000Z'),
  corrected: fc.array(fc.record({ field: fc.string(), engine: fc.string(), model: fc.string() }), { maxLength: 2 }),
})
const item = fc.record({
  id: fc.string({ minLength: 1 }),
  createdAt: fc.constant('2026-11-21T10:00:00.000Z'),
  topics: fc.subarray(['tile', 'yaku', 'scoring', 'flow'] as const),
  entities: fc.array(fc.record({ entity: fc.string(), label: fc.string() }), { maxLength: 3 }),
  marks: fc.array(fc.record({
    tool: fc.constantFrom('rect' as const, 'arrow' as const, 'circle' as const, 'pen' as const, 'text' as const),
    points: fc.array(fc.tuple(fc.integer({ min: 0, max: 4000 }), fc.integer({ min: 0, max: 4000 })), { maxLength: 5 }),
    text: fc.string(),
  }), { maxLength: 4 }),
  screenshot: fc.string(),
  transcript: fc.array(turn, { maxLength: 4 }),
  snapshot: fc.jsonValue(),
  sessionId: fc.option(fc.string(), { nil: null }),
  cleared: fc.boolean(),
  clearedAt: fc.option(fc.constant('2026-11-21T10:05:00.000Z'), { nil: null }),
  flagged: fc.boolean(),
})

describe('play-through log', () => {
  it('save -> load -> save is byte-identical (C12)', () => {
    fc.assert(fc.property(fc.array(item, { maxLength: 3 }), (items) => {
      const log: PlayLog = { ...emptyLog('p1', 4, 'east', '2026-11-21T09:00:00.000Z'), items }
      const once = serializeLog(log)
      expect(serializeLog(parseLog(once))).toBe(once)
    }), { numRuns: 60 })
  })

  it('an empty play-through has no confusion items (C11)', () => {
    const log = emptyLog('p2', 1, 'east', '2026-11-21T09:00:00.000Z')
    expect(parseLog(serializeLog(log)).items).toEqual([])
  })

  it('rejects malformed input', () => {
    expect(() => parseLog('{"version":2}')).toThrow()
    expect(() => parseLog('not json')).toThrow()
  })

  it('tags topics from the picked entity and the question', () => {
    expect(topicsFor(['hand:0:3'], 'why can I not discard this?')).toEqual(['tile'])
    expect(topicsFor(['hanfu'], 'how is fu counted')).toEqual(['scoring'])
    expect(topicsFor([], 'what yaku do I have')).toEqual(['yaku'])
    expect(topicsFor(['round'], 'whose turn is it')).toEqual(['flow'])
  })
})
