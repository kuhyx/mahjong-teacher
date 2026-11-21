import { parseTiles } from '../../engine/tiles.ts'
import type { Demo } from '../../tutorial/demo.ts'
import { P } from './palette.ts'
import { TH, TW, tileSvg } from './tile.ts'

// Draws a Demo: the tile strip (gold ring on highlights, arrow between two
// tiles, gold han pips) and the kanji+romaji gloss chip. Table spotlights
// (demo.focus) are applied by the caller to the live table's data-entity nodes.

const GAP = 8
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

export function demoSvg(d: Demo): string {
  const kinds = d.tiles.map((t) => parseTiles(t)[0] ?? 0)
  const n = Math.max(kinds.length, 1)
  const w = n * (TW + GAP) + GAP
  const top = d.arrow ? 34 : 10
  const h = top + TH + (d.pips ? 34 : 12)
  const x = (i: number): number => GAP + i * (TW + GAP)
  const tiles = kinds.map((k, i) => {
    const on = d.highlight?.includes(i) ?? false
    const ring = on ? `<rect class="demo-ring" x="${String(x(i) - 4)}" y="${String(top - 4)}" width="${String(TW + 8)}" height="${String(TH + 10)}" rx="9" fill="none" stroke="${P.gold}" stroke-width="5"/>` : ''
    return ring + tileSvg(k, { x: x(i), y: top, entity: `demo:${String(i)}`, label: `demo tile ${d.tiles[i] ?? ''}` })
  }).join('')
  let arrow = ''
  if (d.arrow) {
    const [a, b] = d.arrow
    const x1 = x(a) + TW / 2
    const x2 = x(b) + TW / 2
    arrow = `<path class="demo-arrow" d="M${String(x1)} ${String(top - 6)} Q${String((x1 + x2) / 2)} 2 ${String(x2)} ${String(top - 6)}" fill="none" stroke="${P.gold}" stroke-width="4" marker-end="url(#demo-head)"/>`
  }
  const pips = d.pips
    ? Array.from({ length: d.pips }, (_, i) => `<circle class="demo-pip" cx="${String(GAP + 12 + i * 26)}" cy="${String(top + TH + 22)}" r="9" fill="${P.gold}"/>`).join('')
    : ''
  const defs = `<defs><marker id="demo-head" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${P.gold}"/></marker></defs>`
  const svg = kinds.length > 0 || pips ? `<svg class="demo-strip" viewBox="0 0 ${String(w)} ${String(h)}" role="img" aria-label="demo">${defs}${arrow}${tiles}${pips}</svg>` : ''
  const chip = d.gloss ? `<span class="gloss" lang="ja">${esc(d.gloss.jp)}</span><span class="gloss-r">${esc(d.gloss.romaji)}</span>` : ''
  return `<div class="demo">${svg}${chip ? `<div class="gloss-chip">${chip}</div>` : ''}</div>`
}

/** Spotlight table entities named by the demo; returns how many were found. */
export function spotlight(root: ParentNode, d: Demo | null): number {
  for (const el of root.querySelectorAll('.spot')) el.classList.remove('spot')
  let n = 0
  for (const id of d?.focus ?? []) {
    for (const el of root.querySelectorAll(`[data-entity="${CSS.escape(id)}"]`)) {
      el.classList.add('spot')
      n += 1
    }
  }
  return n
}
