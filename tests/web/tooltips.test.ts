import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Icon buttons carry a one-word hover title (textgate tooltip rule). In mark
// mode the tool strip and the chat drawer share the screen, so two different
// actions there must never share a word: ⌫ (erase marks) once read "Clear"
// next to ✓ ("ok that is clear"), and ✓ looked like erase.
const src = (p: string): string => readFileSync(new URL(`../../src/web/${p}`, import.meta.url), 'utf8')
const titles = (s: string): string[] => [...s.matchAll(/title="([^"]*)"/g)].map((m) => m[1] ?? '')
const markTips = (): string[] => [...src('mark/mount.ts').matchAll(/\['\w+', '[^']*', '[^']*', '([^']*)'\]/g)].map((m) => m[1] ?? '')

describe('tooltips', () => {
  const markScreen = [...markTips(), ...titles(src('chat/panel.ts'))]
  const all = [...markScreen, ...titles(src('main.ts')), ...titles(src('tutorial.ts'))]
  it('every icon button has one', () => {
    expect(markTips()).toHaveLength(9)
    expect(all.length).toBeGreaterThanOrEqual(18)
  })
  it('are one word, at most 20 chars, no punctuation', () => {
    for (const t of all) expect(t).toMatch(/^[A-Za-z]+(-[A-Za-z]+)*$/)
    for (const t of all) expect(t.length).toBeLessThanOrEqual(20)
  })
  it('never repeat within the mark screen', () => {
    expect(new Set(markScreen).size).toBe(markScreen.length)
  })
})
