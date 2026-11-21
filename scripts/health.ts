import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileTokenSource } from '../services/relay/auth.ts'
import { rtdb } from '../services/relay/rtdb.ts'
import { ROOT } from '../services/relay/worker.ts'

// Deploy health = capability: the live bridge serves the built page and its
// API, and the live relay answers a queued `ping` through Firebase (no model call).
const port = process.env['MJ_PORT'] ?? '8797'
const fail = (why: string): never => {
  process.stderr.write(`HEALTH FAIL: ${why}\n`)
  process.exit(1)
}
const page = await fetch(`http://127.0.0.1:${port}/`).catch(() => null)
if (!page?.ok || !(await page.text()).includes('Mahjong Teacher')) fail('bridge does not serve the page')
const api = (await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()) as { ok: boolean; claude: boolean }
if (!api.ok || !api.claude) fail(`bridge api: ${JSON.stringify(api)}`)

if (process.env['MJ_HEALTH_LOCAL'] === '1') {
  process.stdout.write('HEALTH OK (local only): page, api\n')
  process.exit(0)
}
const fb = JSON.parse(readFileSync(join(homedir(), '.config/crdt-sync/firebase.json'), 'utf8')) as { apiKey: string; databaseUrl: string }
const db = rtdb(fb.databaseUrl, fileTokenSource(join(homedir(), '.config/mahjong-teacher/firebase_auth.json'), fb.apiKey))
const rid = `health${Date.now().toString(36)}`
await db.put(`${ROOT}/requests/${rid}`, { kind: 'ping', at: { '.sv': 'timestamp' }, body: {} })
const ctl = new AbortController()
const timer = setTimeout(() => ctl.abort(), 30_000)
let res: { ok?: boolean } | null = null
const path = `${ROOT}/results/${rid}`
// Event wait, not polling: each stream event re-reads the result; stop once it exists.
await db.listen(path, () => void db.get(path).then((v) => v !== null && ctl.abort()), ctl.signal).catch(() => undefined)
clearTimeout(timer)
res = await db.get<{ ok?: boolean }>(`${ROOT}/results/${rid}`)
await db.del(`${ROOT}/results/${rid}`)
if (res?.ok !== true) {
  await db.del(`${ROOT}/requests/${rid}`)
  fail('relay did not answer the ping within 30 s')
}
process.stdout.write('HEALTH OK: page, api, relay ping\n')
