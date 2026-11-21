import { describe, expect, it } from 'vitest'
import { briefMarkdown } from '../../src/log/brief.ts'
import { emptyLog, type ConfusionItem } from '../../src/log/log.ts'

const item = (id: string, topics: ConfusionItem['topics'], cleared: boolean, q: string, a: string): ConfusionItem => ({
  id, createdAt: '2026-11-21T10:00:00.000Z', topics, entities: [{ entity: 'hand:0:1', label: '5 of dots in your hand' }],
  marks: [], screenshot: `${id}.png`, snapshot: {}, sessionId: 's', cleared, clearedAt: cleared ? '2026-11-21T10:01:00.000Z' : null, flagged: false,
  transcript: [
    { role: 'user', text: q, at: '2026-11-21T10:00:00.000Z', corrected: [] },
    { role: 'assistant', text: a, at: '2026-11-21T10:00:30.000Z', corrected: [] },
  ],
})

describe('tutorial brief (C13)', () => {
  it('groups items by topic with questions and final answers, open items flagged', () => {
    const log = { ...emptyLog('b1', 3, 'east', '2026-11-21T09:00:00.000Z'), items: [
      item('i1', ['tile'], true, 'Is this dots or bamboo?', 'Dots (pinzu).'),
      item('i2', ['yaku', 'scoring'], false, 'Why 30 fu?', 'Closed ron adds 10.'),
    ] }
    const md = briefMarkdown(log)
    expect(md.indexOf('## tile')).toBeLessThan(md.indexOf('## yaku'))
    expect(md.indexOf('## yaku')).toBeLessThan(md.indexOf('## scoring'))
    expect(md).toContain('Is this dots or bamboo?')
    expect(md).toContain('Dots (pinzu).')
    expect(md).toMatch(/Why 30 fu\?[\s\S]*still open/)
    expect(md).toContain('i1.png')
    expect(md).not.toContain('## flow')
  })

  it('an empty log says there was nothing unclear', () => {
    expect(briefMarkdown(emptyLog('b2', 1, 'east', '2026-11-21T09:00:00.000Z'))).toContain('No confusion items')
  })
})

describe('clear phrase', () => {
  it('accepts English and Polish variants only', async () => {
    const { isClearPhrase } = await import('../../src/log/clear.ts')
    for (const ok of ['ok that is clear', 'OK, that\'s clear!', 'ok to jasne', 'Ok, to jest jasne.']) expect(isClearPhrase(ok)).toBe(true)
    for (const no of ['is that clear?', 'ok', 'that is not clear']) expect(isClearPhrase(no)).toBe(false)
  })
})
