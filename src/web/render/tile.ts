import { rankOf, suitOf, tileCode } from '../../engine/tiles.ts'
import { P } from './palette.ts'

// Code-drawn traditional faces in a 60x80 box, pure SVG so they stay sharp at
// any size (4K, phone). A corner index ("5p") tells dots from bamboo at a glance.

export const TW = 60
export const TH = 80
const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const HONORS = ['東', '南', '西', '北', '', '發', '中']
const FONT = `font-family="'Noto Serif CJK JP','WenQuanYi Zen Hei',serif"`

let showIndex = true
export function setIndexLabels(on: boolean): void {
  showIndex = on
}

// Dot centres per rank on a 60x80 face (traditional pin layouts).
const PIN: Record<number, [number, number][]> = {
  1: [[30, 40]],
  2: [[30, 22], [30, 58]],
  3: [[16, 18], [30, 40], [44, 62]],
  4: [[18, 22], [42, 22], [18, 58], [42, 58]],
  5: [[18, 20], [42, 20], [30, 40], [18, 60], [42, 60]],
  6: [[20, 16], [40, 16], [20, 44], [40, 44], [20, 66], [40, 66]],
  7: [[14, 14], [30, 22], [46, 30], [20, 48], [40, 48], [20, 66], [40, 66]],
  8: [[20, 12], [40, 12], [20, 30], [40, 30], [20, 50], [40, 50], [20, 68], [40, 68]],
  9: [[14, 16], [30, 16], [46, 16], [14, 40], [30, 40], [46, 40], [14, 64], [30, 64], [46, 64]],
}

function pinColor(rank: number, i: number): string {
  if (rank === 1 || (rank === 5 && i === 2) || (rank === 3 && i === 1)) return P.red
  if (rank === 7 && i < 3) return P.green
  if (rank === 6 && i >= 2) return P.red
  if (rank === 9 && i >= 3 && i < 6) return P.red
  return i % 2 === 0 ? P.blue : P.green
}

function pinFace(rank: number): string {
  const pts = PIN[rank] ?? []
  const r = rank === 1 ? 17 : rank >= 7 ? 7 : rank >= 4 ? 8.5 : 9.5
  return pts
    .map(([x, y], i) => {
      const c = pinColor(rank, i)
      return `<circle cx="${String(x)}" cy="${String(y)}" r="${String(r)}" fill="none" stroke="${c}" stroke-width="${String(r / 3)}"/>` +
        `<circle cx="${String(x)}" cy="${String(y)}" r="${String(r / 3)}" fill="${c}"/>`
    })
    .join('')
}

// Bamboo stick centres; each stick is a capsule with a node line.
const SOU: Record<number, [number, number, boolean][]> = {
  2: [[30, 22, false], [30, 58, false]],
  3: [[30, 22, false], [18, 58, false], [42, 58, false]],
  4: [[18, 22, false], [42, 22, false], [18, 58, false], [42, 58, false]],
  5: [[16, 22, false], [44, 22, false], [30, 40, true], [16, 58, false], [44, 58, false]],
  6: [[14, 22, false], [30, 22, false], [46, 22, false], [14, 58, false], [30, 58, false], [46, 58, false]],
  7: [[30, 14, true], [14, 40, false], [30, 40, false], [46, 40, false], [14, 64, false], [30, 64, false], [46, 64, false]],
  8: [[12, 22, false], [24, 22, false], [36, 22, false], [48, 22, false], [12, 58, false], [24, 58, false], [36, 58, false], [48, 58, false]],
  9: [[14, 14, true], [30, 14, false], [46, 14, true], [14, 40, true], [30, 40, false], [46, 40, true], [14, 66, true], [30, 66, false], [46, 66, true]],
}

function stick(x: number, y: number, red: boolean, h: number): string {
  const c = red ? P.red : P.green
  return `<rect x="${String(x - 4)}" y="${String(y - h / 2)}" width="8" height="${String(h)}" rx="4" fill="${c}"/>` +
    `<line x1="${String(x - 4)}" y1="${String(y)}" x2="${String(x + 4)}" y2="${String(y)}" stroke="${P.ivory}" stroke-width="1.5"/>`
}

function souFace(rank: number): string {
  if (rank === 1) {
    // Stylised bird (the traditional 1-sou peacock): body, wing, tail fan.
    return `<ellipse cx="30" cy="44" rx="11" ry="15" fill="${P.green}"/>` +
      `<circle cx="30" cy="24" r="7" fill="${P.red}"/><path d="M30 18 l4 -6 l-8 0 z" fill="${P.red}"/>` +
      `<path d="M19 50 Q8 66 14 72 Q22 62 26 56 Z M41 50 Q52 66 46 72 Q38 62 34 56 Z" fill="${P.blue}"/>` +
      `<circle cx="28" cy="23" r="1.6" fill="${P.ink}"/>`
  }
  const h = rank >= 7 ? 20 : 26
  return (SOU[rank] ?? []).map(([x, y, red]) => stick(x, y, red, h)).join('')
}

function glyph(ch: string, color: string, y: number, size: number): string {
  return `<text x="30" y="${String(y)}" text-anchor="middle" ${FONT} font-size="${String(size)}" font-weight="700" fill="${color}">${ch}</text>`
}

function manFace(rank: number): string {
  return glyph(NUMERALS[rank - 1] ?? '', P.ink, 34, 26) + glyph('萬', P.red, 70, 30)
}

function honorFace(rank: number): string {
  if (rank === 5) return `<rect x="14" y="16" width="32" height="48" rx="3" fill="none" stroke="${P.blue}" stroke-width="3"/>`
  const color = rank === 6 ? P.green : rank === 7 ? P.red : P.ink
  return glyph(HONORS[rank - 1] ?? '', color, 56, 40)
}

/** Inner face drawing for a kind, in the 60x80 tile box. */
export function faceSvg(kind: number): string {
  const rank = rankOf(kind)
  switch (suitOf(kind)) {
    case 'm': return manFace(rank)
    case 'p': return pinFace(rank)
    case 's': return souFace(rank)
    case 'z': return honorFace(rank)
  }
}

const INDEX = ['E', 'S', 'W', 'N', 'Wh', 'G', 'R']
export function indexLabel(kind: number): string {
  return kind >= 27 ? (INDEX[kind - 27] ?? '') : tileCode(kind)
}

export interface TileOpts {
  x: number
  y: number
  scale?: number
  rotate?: number
  entity?: string
  label?: string
  extraClass?: string
}

function wrap(o: TileOpts, inner: string): string {
  const s = o.scale ?? 1
  const rot = o.rotate ? ` rotate(${String(o.rotate)} ${String(TW / 2)} ${String(TH / 2)})` : ''
  const ent = o.entity ? ` data-entity="${o.entity}" data-label="${o.label ?? ''}"` : ''
  const cls = o.extraClass ? ` class="${o.extraClass}"` : ''
  return `<g transform="translate(${String(o.x)} ${String(o.y)}) scale(${String(s)})${rot}"${ent}${cls}>${inner}</g>`
}

/** A face-up tile. */
export function tileSvg(kind: number, o: TileOpts): string {
  const body = `<rect x="0" y="3" width="${String(TW)}" height="${String(TH)}" rx="6" fill="${P.ivoryEdge}"/>` +
    `<rect x="0" y="0" width="${String(TW)}" height="${String(TH)}" rx="6" fill="${P.ivory}" stroke="${P.ivoryEdge}"/>`
  const idx = showIndex
    ? `<text x="3" y="11" font-family="sans-serif" font-size="10" font-weight="700" fill="${P.ink}" opacity="0.75">${indexLabel(kind)}</text>`
    : ''
  return wrap(o, body + faceSvg(kind) + idx)
}

/** A face-down tile (opponents' hands, dead wall). */
export function backSvg(o: TileOpts): string {
  return wrap(o, `<rect x="0" y="3" width="${String(TW)}" height="${String(TH)}" rx="6" fill="${P.backEdge}"/>` +
    `<rect x="0" y="0" width="${String(TW)}" height="${String(TH)}" rx="6" fill="${P.back}"/>`)
}
