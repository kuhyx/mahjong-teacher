import type { Explain } from '../../src/engine/explain.ts'
import type { Correction } from '../../src/log/log.ts'

// The model ends answers with a ```facts {json}``` block. Every stated fact is
// checked against the engine; the engine value wins and the answer is flagged.

const FENCE = /```facts\s*([\s\S]*?)```/

export function splitFacts(text: string): { body: string; facts: Record<string, unknown> | null } {
  const m = FENCE.exec(text)
  if (!m) return { body: text.trim(), facts: null }
  let facts: Record<string, unknown> | null = null
  try {
    const parsed: unknown = JSON.parse(m[1] ?? '')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) facts = parsed as Record<string, unknown>
  } catch {
    facts = null
  }
  return { body: text.replace(FENCE, '').trim(), facts }
}

const asSet = (v: unknown): string => (Array.isArray(v) ? v.map(String).sort().join(' ') : String(v))

export function checkFacts(facts: Record<string, unknown> | null, e: Explain): Correction[] {
  if (!facts) return []
  const out: Correction[] = []
  if ('waits' in facts) {
    const engine = [...e.waits].sort().join(' ')
    const model = asSet(facts['waits'])
    if (model !== engine) out.push({ field: 'waits', engine: engine || 'none', model: model || 'none' })
  }
  if ('shanten' in facts && Number(facts['shanten']) !== e.shanten) {
    out.push({ field: 'shanten', engine: String(e.shanten), model: String(facts['shanten']) })
  }
  if ('scores' in facts) {
    const model = Array.isArray(facts['scores']) ? facts['scores'].map(Number).join(' ') : String(facts['scores'])
    if (model !== e.scores.join(' ')) out.push({ field: 'scores', engine: e.scores.join(' '), model })
  }
  if ('seatWind' in facts && String(facts['seatWind']).toLowerCase() !== e.seatWind.toLowerCase()) {
    out.push({ field: 'seatWind', engine: e.seatWind, model: String(facts['seatWind']) })
  }
  if ('dealer' in facts && Boolean(facts['dealer']) !== e.dealer) out.push({ field: 'dealer', engine: String(e.dealer), model: String(facts['dealer']) })
  const r = e.lastResult
  for (const key of ['han', 'fu'] as const) {
    if (key in facts && r && Number(facts[key]) !== r[key]) out.push({ field: key, engine: String(r[key]), model: String(facts[key]) })
  }
  return out
}
