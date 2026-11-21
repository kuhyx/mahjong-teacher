import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Explain } from '../../src/engine/explain.ts'
import { parseLog, SAFE_ID, serializeLog, type Mark } from '../../src/log/log.ts'
import { ask, type AskResult } from './ask.ts'

// Request handlers shared by the loopback bridge (HTTP) and the relay worker
// (Firebase). Every input is validated here; a bad request is an error result
// and never reaches `claude`.

export interface StoreConfig {
  dataDir: string
  claudeBin: string
  env?: Record<string, string>
}

export interface AskBody {
  logId: string
  itemId: string
  turn: number
  question: string
  state: Explain
  entities: { entity: string; label: string }[]
  marks: Mark[]
  sessionId: string | null
  jpegBase64: string | null
  mode: 'ask' | 'propose'
  lang: string
}

export class BadRequest extends Error {}

const logsDir = (c: StoreConfig): string => join(c.dataDir, 'logs')

export function validAsk(b: unknown): b is AskBody {
  const o = b as Partial<AskBody> | null
  return !!o && typeof o === 'object' && typeof o.logId === 'string' && SAFE_ID.test(o.logId) &&
    typeof o.itemId === 'string' && SAFE_ID.test(o.itemId) && typeof o.question === 'string' &&
    o.question.length > 0 && o.question.length <= 4000 && typeof o.state === 'object' && o.state !== null &&
    Array.isArray(o.entities) && Array.isArray(o.marks) && (o.sessionId === null || typeof o.sessionId === 'string') &&
    (o.jpegBase64 === null || typeof o.jpegBase64 === 'string') && (o.mode === 'ask' || o.mode === 'propose') &&
    typeof o.lang === 'string' && /^[a-z]{2}$/.test(o.lang)
}

/** Firebase drops empty arrays and nulls; restore them before validating. */
export function normalizeAsk(b: unknown): unknown {
  if (!b || typeof b !== 'object') return b
  const o = b as Record<string, unknown>
  return { ...o, entities: o['entities'] ?? [], marks: o['marks'] ?? [], sessionId: o['sessionId'] ?? null, jpegBase64: o['jpegBase64'] ?? null, mode: o['mode'] ?? 'ask', lang: o['lang'] ?? 'en' }
}

export async function handleAsk(raw: unknown, c: StoreConfig): Promise<AskResult> {
  const b = normalizeAsk(raw)
  if (!validAsk(b)) throw new BadRequest('bad ask request')
  const shots = join(c.dataDir, 'shots')
  mkdirSync(shots, { recursive: true })
  let shotPath: string | null = null
  if (b.jpegBase64) {
    shotPath = join(shots, `${b.logId}-${b.itemId}-${String(Number(b.turn) || 0)}.jpg`)
    writeFileSync(shotPath, Buffer.from(b.jpegBase64, 'base64'))
  }
  return ask(
    { question: b.question, mode: b.mode, lang: b.lang, state: b.state, entities: b.entities, marks: b.marks, shotPath, sessionId: b.sessionId },
    { claudeBin: c.claudeBin, workDir: shots, env: c.env ?? {} },
  )
}

export function saveLog(id: string, text: string, c: StoreConfig): void {
  if (!SAFE_ID.test(id)) throw new BadRequest('bad id')
  const log = parseLog(text)
  if (log.id !== id) throw new BadRequest('id mismatch')
  mkdirSync(logsDir(c), { recursive: true })
  writeFileSync(join(logsDir(c), `play-${id}.json`), serializeLog(log))
}

export function loadLog(id: string, c: StoreConfig): string | null {
  if (!SAFE_ID.test(id)) throw new BadRequest('bad id')
  const file = join(logsDir(c), `play-${id}.json`)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

export function saveShot(name: string, pngBase64: unknown, c: StoreConfig): string {
  if (!SAFE_ID.test(name) || typeof pngBase64 !== 'string') throw new BadRequest('bad shot')
  mkdirSync(logsDir(c), { recursive: true })
  writeFileSync(join(logsDir(c), `${name}.png`), Buffer.from(pngBase64, 'base64'))
  return `${name}.png`
}
