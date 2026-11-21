// A demo is one picture step: a strip of tiles, some highlighted, an optional
// arrow between two of them, real-table entities to spotlight, a kanji+romaji
// gloss chip and han pips. The model's proposals and the tutorial scenes both
// use it, so one renderer draws both. It holds no numbers the engine did not
// make: scores and seats are spotlighted on the table, never redrawn.

export interface Gloss {
  jp: string
  romaji: string
}

export interface Demo {
  tiles: string[]
  highlight?: number[]
  arrow?: [number, number]
  focus?: string[]
  gloss?: Gloss
  pips?: number
}

const TILE = /^([1-9][mps]|[1-7]z)$/
const ENTITY = /^[a-z]+(:[A-Za-z0-9 ]+)*(:[0-9]+)*$/
const FENCE = /```demo\s*([\s\S]*?)```/

const idx = (v: unknown, n: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n
const shortStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** Validate a model-made or hand-made demo; drops anything malformed, never throws. */
export function parseDemo(raw: unknown): Demo | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const tiles = Array.isArray(o['tiles']) ? o['tiles'].filter((t): t is string => typeof t === 'string' && TILE.test(t)).slice(0, 14) : []
  const focus = Array.isArray(o['focus']) ? o['focus'].filter((f): f is string => typeof f === 'string' && f.length <= 64 && ENTITY.test(f)).slice(0, 8) : []
  if (tiles.length === 0 && focus.length === 0) return null
  const d: Demo = { tiles }
  if (Array.isArray(o['highlight'])) {
    const h = o['highlight'].filter((i) => idx(i, tiles.length))
    if (h.length > 0) d.highlight = h
  }
  const a = o['arrow']
  if (Array.isArray(a) && a.length === 2 && idx(a[0], tiles.length) && idx(a[1], tiles.length)) d.arrow = [a[0], a[1]]
  if (focus.length > 0) d.focus = focus
  const g = o['gloss'] as Record<string, unknown> | undefined
  if (g && typeof g === 'object' && shortStr(g['jp'], 12) && shortStr(g['romaji'], 24)) d.gloss = { jp: g['jp'], romaji: g['romaji'] }
  const p = o['pips']
  if (Number.isInteger(p) && (p as number) > 0 && (p as number) <= 13) d.pips = p as number
  return d
}

/** Pull the ```demo {json}``` block out of an answer. */
export function splitDemo(text: string): { body: string; demo: Demo | null } {
  const m = FENCE.exec(text)
  if (!m) return { body: text.trim(), demo: null }
  let demo: Demo | null = null
  try {
    demo = parseDemo(JSON.parse(m[1] ?? ''))
  } catch {
    demo = null
  }
  return { body: text.replace(FENCE, '').replace(/\n{3,}/g, '\n\n').trim(), demo }
}
