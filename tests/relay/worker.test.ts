import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, RelayWorker } from '../../services/relay/worker.ts'
import { explain } from '../../src/engine/explain.ts'
import { newMatch } from '../../src/engine/match.ts'
import { emptyLog, serializeLog } from '../../src/log/log.ts'
import { FakeRtdb } from './fake_rtdb.ts'

const store = (): { dataDir: string; claudeBin: string; env: Record<string, string> } => ({
  dataDir: mkdtempSync(join(tmpdir(), 'mj-relay-')), claudeBin: join(import.meta.dirname, '../stub/claude'), env: {},
})
const ask = {
  logId: 'p1-x', itemId: 'i1', turn: 1, question: 'Dlaczego?', state: explain(newMatch(1, 'east')),
  entities: [], marks: [], sessionId: null, jpegBase64: Buffer.from('jpg').toString('base64'),
}

describe('relay worker (C15, C18)', () => {
  it('answers a queued phone question and removes the request', async () => {
    const db = new FakeRtdb()
    await db.put(`${ROOT}/requests/rid00000001`, { kind: 'ask', at: 1, body: ask })
    const w = new RelayWorker(db, store(), 'pc1')
    await w.scan()
    const r = await db.get<{ ok: boolean; reply: { answer: string; sessionId: string } }>(`${ROOT}/results/rid00000001`)
    expect(r?.ok).toBe(true)
    expect(r?.reply.answer).toMatch(/kafelek/)
    expect(await db.get(`${ROOT}/requests/rid00000001`)).toBeNull()
  })

  it('accepts an ask whose empty arrays and nulls Firebase dropped', async () => {
    const db = new FakeRtdb()
    const { entities: _e, marks: _m, sessionId: _s, jpegBase64: _j, ...rest } = ask
    await db.put(`${ROOT}/requests/rid00000005`, { kind: 'ask', at: 1, body: rest })
    await new RelayWorker(db, store(), 'pc1').scan()
    expect((await db.get<{ ok: boolean }>(`${ROOT}/results/rid00000005`))?.ok).toBe(true)
  })

  it('a malformed request gets an error result and never spawns claude (C16)', async () => {
    const db = new FakeRtdb()
    await db.put(`${ROOT}/requests/rid00000002`, { kind: 'ask', at: 1, body: { question: 'x' } })
    const w = new RelayWorker(db, store(), 'pc1')
    await w.scan()
    expect(w.spawned).toBe(0)
    const r = await db.get<{ ok: boolean; error: string }>(`${ROOT}/results/rid00000002`)
    expect(r?.ok).toBe(false)
    expect(r?.error).toMatch(/bad request/)
  })

  it('does not take a request another live worker claimed', async () => {
    const db = new FakeRtdb()
    await db.put(`${ROOT}/requests/rid00000003`, { kind: 'ask', at: 1, body: ask, claim: { by: 'other', at: Date.now() } })
    await new RelayWorker(db, store(), 'pc1').scan()
    expect(await db.get(`${ROOT}/results/rid00000003`)).toBeNull()
  })

  it('stores a log sent from the phone', async () => {
    const db = new FakeRtdb()
    const s = store()
    const text = serializeLog(emptyLog('p9-y', 9, 'east', '2026-11-21T00:00:00.000Z'))
    await db.put(`${ROOT}/requests/rid00000004`, { kind: 'log', at: 1, body: { id: 'p9-y', text } })
    await new RelayWorker(db, s, 'pc1').scan()
    expect(readFileSync(join(s.dataDir, 'logs', 'play-p9-y.json'), 'utf8')).toBe(text)
  })

  it('carries propose mode through and returns the demo (ae243e36 C4)', async () => {
    const db = new FakeRtdb()
    await db.put(`${ROOT}/requests/rid00000009`, { kind: 'ask', at: 1, body: { ...ask, question: 'show me', mode: 'propose', lang: 'pl' } })
    await new RelayWorker(db, store(), 'pc1').scan()
    const r = await db.get<{ ok: boolean; reply: { demo: { tiles: string[] } | null } }>(`${ROOT}/results/rid00000009`)
    expect(r?.ok).toBe(true)
    expect(r?.reply.demo?.tiles.length).toBeGreaterThan(0)
  })
})
