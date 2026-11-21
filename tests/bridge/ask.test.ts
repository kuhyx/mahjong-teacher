import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ask } from '../../services/bridge/ask.ts'
import { newMatch } from '../../src/engine/match.ts'
import { explain } from '../../src/engine/explain.ts'

const STUB = join(import.meta.dirname, '../stub/claude')

function setup(): { dir: string; log: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mj-ask-'))
  return { dir, log: join(dir, 'calls.jsonl') }
}

const calls = (log: string): { args: string[]; hasKey: boolean; prompt: string }[] =>
  readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { args: string[]; hasKey: boolean; prompt: string })

describe('bridge ask', () => {
  const state = explain(newMatch(1, 'east'))

  it('answers in Polish for a Polish question, with a session id and no API key in the child env', async () => {
    const { dir, log } = setup()
    process.env['ANTHROPIC_API_KEY'] = 'must-not-leak'
    const r = await ask({ question: 'Dlaczego ten kafelek?', state, entities: [{ entity: 'hand:0:1', label: '2 of dots' }], marks: [], shotPath: null },
      { claudeBin: STUB, workDir: dir, env: { STUB_CLAUDE_LOG: log } })
    delete process.env['ANTHROPIC_API_KEY']
    expect(r.answer).toMatch(/kafelek/)
    expect(r.sessionId).toMatch(/^stub-/)
    const c = calls(log)[0]
    expect(c?.hasKey).toBe(false)
    expect(c?.args).toContain('--safe-mode')
    expect(c?.args).toEqual(expect.arrayContaining(['--tools', 'Read']))
    expect(c?.prompt).toContain('2 of dots')
  })

  it('follow-ups resume the same session', async () => {
    const { dir, log } = setup()
    const r = await ask({ question: 'and why?', state, entities: [], marks: [], shotPath: null, sessionId: 'stub-abc' },
      { claudeBin: STUB, workDir: dir, env: { STUB_CLAUDE_LOG: log } })
    expect(r.sessionId).toBe('stub-abc')
    expect(calls(log)[0]?.args).toEqual(expect.arrayContaining(['--resume', 'stub-abc']))
  })

  it('engine wins when the model states a wrong wait (C10)', async () => {
    const { dir, log } = setup()
    const r = await ask({ question: 'WRONGWAIT what am I waiting on', state, entities: [], marks: [], shotPath: null },
      { claudeBin: STUB, workDir: dir, env: { STUB_CLAUDE_LOG: log } })
    expect(r.flagged).toBe(true)
    expect(r.corrected[0]?.field).toBe('waits')
    expect(r.corrected[0]?.engine).toBe(state.waits.join(' ') || 'none')
    expect(r.answer).not.toMatch(/```facts/)
  })

  it('a failing binary returns an error, not a crash', async () => {
    const { dir } = setup()
    await expect(ask({ question: 'x', state, entities: [], marks: [], shotPath: null }, { claudeBin: '/bin/false', workDir: dir, env: {} }))
      .rejects.toThrow(/claude/)
  })
})

describe('bridge ask: propose mode (ae243e36)', () => {
  const state = explain(newMatch(1, 'east'))
  it('propose mode tells the model to answer with no questions back, in the player language, with a demo', async () => {
    const { dir, log } = setup()
    const r = await ask({ question: 'show me', mode: 'propose', lang: 'pl', state, entities: [{ entity: 'hand:0:1', label: '3 of characters (man) in your hand' }], marks: [], shotPath: null },
      { claudeBin: STUB, workDir: dir, env: { STUB_CLAUDE_LOG: log } })
    const p = calls(log)[0]?.prompt ?? ''
    expect(p).toMatch(/MODE: propose/)
    expect(p).toMatch(/Reply language: pl/)
    expect(r.demo?.tiles.length).toBeGreaterThan(0)
    expect(r.answer).not.toMatch(/```demo/)
    expect(r.answer).toMatch(/kafel/)
  })
  it('a wrong score in the facts block is struck by the engine (C2)', async () => {
    const { dir, log } = setup()
    const r = await ask({ question: 'show me', mode: 'propose', state, entities: [], marks: [{ tool: 'circle', points: [[1, 1], [9, 9]], text: '' }], shotPath: null },
      { claudeBin: STUB, workDir: dir, env: { STUB_CLAUDE_LOG: log } })
    expect(r.flagged).toBe(true)
    expect(r.corrected.find((c) => c.field === 'scores')?.engine).toBe(state.scores.join(' '))
  })
})
