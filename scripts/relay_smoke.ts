import { mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileTokenSource } from '../services/relay/auth.ts'
import { rtdb } from '../services/relay/rtdb.ts'
import { ROOT, RelayWorker } from '../services/relay/worker.ts'
import { explain } from '../src/engine/explain.ts'
import { newMatch } from '../src/engine/match.ts'
import { askReplyFromRtdb } from '../src/web/chat/relay_codec.ts'

// Real-Firebase smoke for the relay (C15/C16) with the STUB claude: queue an
// ask, let a worker serve it, read the result; then prove an unauthenticated
// write is refused by the database rules. The ask is an instant proposal
// (ae243e36 C4): the demo must survive the RTDB round trip. Usage: node scripts/relay_smoke.ts
const home = homedir()
const fb = JSON.parse(readFileSync(join(home, '.config/crdt-sync/firebase.json'), 'utf8')) as { apiKey: string; databaseUrl: string }
const db = rtdb(fb.databaseUrl, fileTokenSource(join(home, '.config/mahjong-teacher/firebase_auth.json'), fb.apiKey))
const rid = `smoke${Date.now().toString(36)}`
const body = { logId: 'smoke-1', itemId: 'i1', turn: 1, question: 'show me', mode: 'propose', lang: 'pl', state: explain(newMatch(1, 'east')), entities: [], marks: [], sessionId: null, jpegBase64: null }
// Pre-claimed for this smoke worker so the live PC worker (older code, real
// claude) leaves it alone.
await db.put(`${ROOT}/requests/${rid}`, { kind: 'ask', at: { '.sv': 'timestamp' }, body, claim: { by: 'smoke', at: Date.now() } })
const w = new RelayWorker(db, { dataDir: mkdtempSync(join(tmpdir(), 'mj-smoke-')), claudeBin: join(import.meta.dirname, '../tests/stub/claude') }, 'smoke')
await w.scan()
const r = await db.get<{ ok: boolean; reply?: { answer: string } }>(`${ROOT}/results/${rid}`)
const demo = r?.reply ? askReplyFromRtdb(r.reply).demo : null
await db.del(`${ROOT}/results/${rid}`)
const anon = await fetch(`${fb.databaseUrl}/${ROOT}/requests/anon${rid}.json`, { method: 'PUT', body: '{"kind":"ask"}' })
const ok = r?.ok === true && (r.reply?.answer.length ?? 0) > 0 && (demo?.tiles.length ?? 0) > 0 && anon.status === 401
process.stdout.write(`${ok ? 'PASS' : 'FAIL'}: worker answered=${String(r?.ok)} demo=${JSON.stringify(demo)} ${ok ? '' : JSON.stringify(r)}; unauthenticated write -> ${String(anon.status)}\n`)
process.exit(ok ? 0 : 1)
