import { isClearPhrase, isTriggerPhrase } from '../log/clear.ts'
import type { ConfusionItem, PlayLog } from '../log/log.ts'
import type { Scene } from './scenes.ts'

// Which tutorial scene explains each marked item. An item is covered only when
// every picked entity matches a scene (or, with nothing picked, its question
// words do). There is no topic fallback: a new kind of mark must get a scene.

export interface Row {
  log: string
  item: string
  what: string
  scenes: string[]
}

export interface Report {
  ok: boolean
  rows: Row[]
  missing: Row[]
}

const matches = (s: Scene, e: { entity: string; label: string }): boolean =>
  s.covers.some((c) => c.entity.test(e.entity) && (!c.label || c.label.test(e.label)))

function cover(it: ConfusionItem, scenes: Scene[]): string[] | null {
  if (it.entities.length > 0) {
    const ids = new Set<string>()
    for (const e of it.entities) {
      const hit = scenes.filter((s) => matches(s, e))
      if (hit.length === 0) return null
      for (const s of hit) ids.add(s.id)
    }
    return [...ids]
  }
  const words = it.transcript.filter((t) => t.role === 'user' && !isTriggerPhrase(t.text) && !isClearPhrase(t.text)).map((t) => t.text).join(' ')
  const hit = scenes.filter((s) => s.words.test(words)).map((s) => s.id)
  return hit.length > 0 ? hit : null
}

export function coverage(logs: PlayLog[], scenes: Scene[]): Report {
  const rows: Row[] = []
  const missing: Row[] = []
  for (const l of logs) for (const it of l.items) {
    const hit = cover(it, scenes)
    const what = it.entities.map((e) => e.label).join('; ') || (it.transcript[0]?.text ?? 'free mark')
    const row = { log: l.id, item: it.id, what, scenes: hit ?? [] }
    rows.push(row)
    if (!hit) missing.push(row)
  }
  return { ok: missing.length === 0, rows, missing }
}
