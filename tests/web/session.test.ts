import { describe, expect, it } from 'vitest'
import { explain } from '../../src/engine/explain.ts'
import { newMatch } from '../../src/engine/match.ts'
import { PROPOSE_PHRASE, REJECT_PHRASE } from '../../src/log/clear.ts'
import { briefMarkdown } from '../../src/log/brief.ts'
import type { AskRequest, Transport } from '../../src/web/chat/transport.ts'
import { PlaySession } from '../../src/web/chat/session.ts'

function fake(): { t: Transport; asks: AskRequest[] } {
  const asks: AskRequest[] = []
  let n = 0
  return {
    asks,
    t: {
      ask: async (r) => {
        asks.push(r)
        n += 1
        return { answer: `p${String(n)}`, sessionId: 's1', flagged: false, corrected: [], demo: { tiles: [n === 1 ? '3m' : '1m'] } }
      },
      saveLog: async () => undefined, saveShot: async () => undefined, loadLog: async () => '',
    },
  }
}

const frame = { entities: [{ entity: 'hand:0:1', label: '3 of characters (man) in your hand' }], marks: [], pngBase64: '', jpegBase64: 'j', snapshot: explain(newMatch(1, 'east')) }

describe('instant proposal session (ae243e36)', () => {
  it('propose opens a thread in propose mode with no typed text; reject re-asks; clear keeps the accepted demo', async () => {
    const { t, asks } = fake()
    const s = new PlaySession(t, 1, 'east')
    s.setFrame(frame)
    const state = explain(newMatch(1, 'east'))
    await s.propose(state)
    expect(asks[0]?.mode).toBe('propose')
    expect(asks[0]?.question).toBe(PROPOSE_PHRASE)
    expect(s.item?.topics).toEqual(['tile'])
    await s.reject(state)
    expect(asks[1]?.mode).toBe('propose')
    expect(asks[1]?.question).toBe(REJECT_PHRASE)
    await s.send('ok that is clear', state)
    const item = s.log.items[0]
    expect(item?.cleared).toBe(true)
    expect(item?.transcript.filter((x) => x.demo).at(-1)?.demo).toEqual({ tiles: ['1m'] })
    const brief = briefMarkdown(s.log)
    expect(brief).not.toContain(PROPOSE_PHRASE)
    expect(brief).toContain('accepted demo')
  })
  it('a typed first question stays a plain ask (done check unchanged)', async () => {
    const { t, asks } = fake()
    const s = new PlaySession(t, 1, 'east')
    s.setFrame(frame)
    await s.send('why?', explain(newMatch(1, 'east')))
    expect(asks[0]?.mode).toBe('ask')
  })
  it('typed follow-ups in a proposal thread stay in propose mode; the next tap uses their language', async () => {
    const { t, asks } = fake()
    const s = new PlaySession(t, 1, 'east')
    s.setFrame(frame)
    const state = explain(newMatch(1, 'east'))
    await s.propose(state)
    await s.send('pokaż to z rozdającym', state)
    expect(asks[1]?.mode).toBe('propose')
    expect(asks[1]?.lang).toBe('') // typed: answered in its own language
    await s.reject(state)
    expect(asks[2]?.lang).toBe('pl')
  })
})

describe('reply language (ae243e36)', () => {
  const state = explain(newMatch(1, 'east'))
  it('English with "to" stays English; Polish is Polish; typed asks send no language', async () => {
    const { t, asks } = fake()
    const s = new PlaySession(t, 1, 'east')
    s.setFrame(frame)
    await s.send('What do I need to win?', state)
    expect(asks[0]?.lang).toBe('')
    await s.send('ok that is clear', state)
    s.setFrame(frame)
    await s.propose(state)
    expect(asks[1]?.lang).toBe('en')
    for (const q of ['Ile to jest han?', 'Po co mi te kafle?']) {
      const f = fake()
      const p = new PlaySession(f.t, 1, 'east')
      p.setFrame(frame)
      await p.send(q, state)
      await p.send('ok that is clear', state)
      p.setFrame(frame)
      await p.propose(state)
      expect(f.asks[1]?.lang).toBe('pl')
    }
  })
})
