import { decompose } from './decompose.ts'
import type { Meld, WinInput } from './types.ts'

export type WaitKind = 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon' | 'chiitoi' | 'kokushi'

export interface HGroup {
  type: 'seq' | 'trip' | 'kan'
  start: number
  /** Open for fu and concealed-triplet counting (a ron-completed triplet is open). */
  open: boolean
}

/** One reading of a winning hand: its groups, pair and the wait the winning tile filled. */
export interface Shape {
  form: 'standard' | 'chiitoi' | 'kokushi'
  pair: number
  groups: HGroup[]
  wait: WaitKind
  /** No open melds (ankan keeps a hand closed). */
  closed: boolean
}

function meldGroup(m: Meld): HGroup {
  const start = m.tiles[0] ?? 0
  if (m.kind === 'chi') return { type: 'seq', start, open: true }
  if (m.kind === 'pon') return { type: 'trip', start, open: true }
  return { type: 'kan', start, open: m.kind !== 'ankan' }
}

function seqWait(start: number, tile: number): WaitKind {
  if (tile === start + 1) return 'kanchan'
  if (tile === start) return start % 9 === 6 ? 'penchan' : 'ryanmen'
  return start % 9 === 0 ? 'penchan' : 'ryanmen'
}

/** All shapes of a winning hand, one per decomposition and winning-tile position. */
export function shapesOf(input: WinInput): Shape[] {
  const closed = input.melds.every((m) => m.kind === 'ankan')
  const open = input.melds.map(meldGroup)
  const out: Shape[] = []
  for (const d of decompose(input.concealed, input.melds.length)) {
    if (d.form !== 'standard') {
      out.push({ form: d.form, pair: d.pair, groups: [], wait: d.form, closed })
      continue
    }
    const base: HGroup[] = d.groups.map((g) => ({ type: g.type, start: g.start, open: false }))
    if (d.pair === input.winTile) out.push({ form: 'standard', pair: d.pair, groups: [...base, ...open], wait: 'tanki', closed })
    const seen = new Set<string>()
    base.forEach((g, i) => {
      const inGroup = g.type === 'trip' ? g.start === input.winTile : input.winTile >= g.start && input.winTile <= g.start + 2
      const key = `${g.type}${String(g.start)}`
      if (!inGroup || seen.has(key)) return
      seen.add(key)
      const groups = base.map((x, j) => (j === i && x.type === 'trip' && !input.tsumo ? { ...x, open: true } : x))
      const wait = g.type === 'trip' ? 'shanpon' : seqWait(g.start, input.winTile)
      out.push({ form: 'standard', pair: d.pair, groups: [...groups, ...open], wait, closed })
    })
  }
  return out
}

/** Every tile of the shape, for flushes, terminal checks and dora. */
export function shapeTiles(s: Shape, input: WinInput): number[] {
  if (s.form !== 'standard') return input.concealed
  const tiles = [s.pair, s.pair]
  for (const g of s.groups) {
    if (g.type === 'seq') tiles.push(g.start, g.start + 1, g.start + 2)
    else tiles.push(...Array.from({ length: g.type === 'kan' ? 4 : 3 }, () => g.start))
  }
  return tiles
}
