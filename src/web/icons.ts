// Status glyphs as inline SVG: Android WebView fonts lack ⏻ and drew ♪̸ as an
// empty box on the Pixel, so these never rely on a font having the symbol.

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

const NOTE = '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>'

/** Music note; muted adds a slash. */
export const soundIcon = (on: boolean): string => svg(on ? NOTE : `${NOTE}<line x1="3" y1="3" x2="21" y2="21"/>`)

/** Power symbol: the PC worker is offline. */
export const offlineIcon = (): string => svg('<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>')
