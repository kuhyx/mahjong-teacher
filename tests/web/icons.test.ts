import { describe, expect, it } from 'vitest'
import { offlineIcon, soundIcon } from '../../src/web/icons.ts'

// Android WebView fonts lack ⏻ and draw ♪̸ as a box (Pixel, 2026-11-21), so
// status glyphs are inline SVG, never font symbols.
describe('icons', () => {
  it('are inline SVG in currentColor', () => {
    for (const s of [soundIcon(true), soundIcon(false), offlineIcon()]) {
      expect(s.startsWith('<svg')).toBe(true)
      expect(s).toContain('currentColor')
    }
  })
  it('muted differs from on by a slash', () => {
    expect(soundIcon(false)).not.toEqual(soundIcon(true))
    expect(soundIcon(false)).toContain('<line')
  })
})
