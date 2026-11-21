import { describe, expect, it } from 'vitest'
import { askReplyFromRtdb } from '../../src/web/chat/relay_codec.ts'

describe('askReplyFromRtdb', () => {
  it('restores the empty corrected list Firebase drops', () => {
    expect(askReplyFromRtdb({ answer: 'a', sessionId: 's', flagged: false })).toEqual({ answer: 'a', sessionId: 's', flagged: false, corrected: [], demo: null })
  })
  it('keeps corrections that survived', () => {
    const c = [{ field: 'waits', model: '1m', engine: '4m' }]
    expect(askReplyFromRtdb({ answer: 'a', sessionId: 's', flagged: true, corrected: c }).corrected).toEqual(c)
  })
  it('defaults a dropped flag and session id', () => {
    expect(askReplyFromRtdb({ answer: 'a' })).toEqual({ answer: 'a', sessionId: null, flagged: false, corrected: [], demo: null })
  })
  it('rejects a reply with no answer', () => {
    expect(() => askReplyFromRtdb(null)).toThrow()
    expect(() => askReplyFromRtdb({ sessionId: 's' })).toThrow()
  })
})

describe('askReplyFromRtdb demo', () => {
  it('keeps the demo and restores arrays Firebase dropped inside it', () => {
    const r = askReplyFromRtdb({ answer: 'a', demo: { tiles: ['3m'] } })
    expect(r.demo).toEqual({ tiles: ['3m'] })
  })
  it('no demo stays null', () => {
    expect(askReplyFromRtdb({ answer: 'a' }).demo).toBeNull()
  })
})
