import { describe, expect, it } from 'vitest'
import { tutorialMarkdown } from '../../src/tutorial/doc.ts'
import { SCENES } from '../../src/tutorial/scenes.ts'

describe('DOCS-tutorial.md (6662507c C7)', () => {
  const md = tutorialMarkdown(SCENES, 'docs/tutorial')
  it('has every step image of every scene', () => {
    for (const s of SCENES) for (let i = 1; i <= s.steps.length; i++) expect(md).toContain(`](docs/tutorial/${s.id}-${String(i)}.jpg)`)
  })
  it('has one glossary line per Japanese term', () => {
    for (const s of SCENES) for (const st of s.steps) if (st.gloss) expect(md).toMatch(new RegExp(`^- \\*\\*${st.gloss.jp}\\*\\* \\(${st.gloss.romaji}\\): `, 'm'))
  })
})

describe('glossary meanings', () => {
  it('no term lacks a meaning', () => {
    expect(tutorialMarkdown(SCENES, 'x')).not.toContain('MISSING MEANING')
  })
})
