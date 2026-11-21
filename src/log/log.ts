import type { Demo } from '../tutorial/demo.ts'

// Play-through log: one `play-<id>.json` per game. Canonical form (sorted keys,
// 2-space indent, trailing newline) so save -> load -> save is byte-identical.
// Screenshots live beside it as PNG files; the JSON holds only their names.

export type Topic = 'tile' | 'yaku' | 'scoring' | 'flow'
export type MarkTool = 'rect' | 'arrow' | 'circle' | 'pen' | 'text'

export interface Mark {
  tool: MarkTool
  /** Points in screenshot pixels (rect/circle: two corners; arrow: tail, head). */
  points: [number, number][]
  text: string
}

export interface Correction {
  field: string
  engine: string
  model: string
}

export interface Turn {
  role: 'user' | 'assistant'
  text: string
  at: string
  /** Facts where the engine overruled the model's answer (C10). */
  corrected: Correction[]
  /** Proposal picture of an assistant turn (instant-proposal mode). */
  demo?: Demo
}

export interface ConfusionItem {
  id: string
  createdAt: string
  topics: Topic[]
  entities: { entity: string; label: string }[]
  marks: Mark[]
  /** File name of the full-resolution marked PNG next to the log. */
  screenshot: string
  transcript: Turn[]
  /** Engine state at the freeze-frame (explain() output). */
  snapshot: unknown
  sessionId: string | null
  /** Closed by "ok that is clear". */
  cleared: boolean
  clearedAt: string | null
  flagged: boolean
}

export interface PlayLog {
  version: 1
  id: string
  seed: number
  length: 'east' | 'hanchan'
  startedAt: string
  items: ConfusionItem[]
}

export function emptyLog(id: string, seed: number, length: PlayLog['length'], startedAt: string): PlayLog {
  return { version: 1, id, seed, length, startedAt, items: [] }
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([k, x]) => [k, canonical(x)]))
  }
  return v
}

export function serializeLog(log: PlayLog): string {
  return `${JSON.stringify(canonical(log), null, 2)}\n`
}

function need(cond: boolean, what: string): void {
  if (!cond) throw new Error(`invalid play log: ${what}`)
}

/** Parse and shape-check a log; throws on anything that is not a v1 log. */
export function parseLog(text: string): PlayLog {
  const raw: unknown = JSON.parse(text)
  need(raw !== null && typeof raw === 'object', 'not an object')
  const o = raw as Record<string, unknown>
  need(o['version'] === 1, 'version')
  need(typeof o['id'] === 'string' && typeof o['seed'] === 'number', 'id/seed')
  need(o['length'] === 'east' || o['length'] === 'hanchan', 'length')
  need(Array.isArray(o['items']), 'items')
  for (const it of o['items'] as unknown[]) {
    const i = it as Record<string, unknown>
    need(typeof i['id'] === 'string' && Array.isArray(i['transcript']) && Array.isArray(i['marks']), 'item')
    need(typeof i['cleared'] === 'boolean' && Array.isArray(i['topics']), 'item flags')
  }
  return raw as PlayLog
}

/** Valid ids for log files and screenshots: no path tricks. */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
