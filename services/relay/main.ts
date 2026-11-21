import { existsSync, readFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { fileTokenSource } from './auth.ts'
import { rtdb } from './rtdb.ts'
import { ROOT, RelayWorker } from './worker.ts'

// Entry for the `mahjong-relay` systemd --user unit. Streams the requests node
// (SSE) and rescans every 60 s; heartbeat every 30 s. No inbound port.

const home = homedir()
const fb = JSON.parse(readFileSync(join(home, '.config/crdt-sync/firebase.json'), 'utf8')) as { apiKey: string; databaseUrl: string }
const authFile = process.env['MJ_AUTH'] ?? join(home, '.config/mahjong-teacher/firebase_auth.json')
if (!existsSync(authFile)) {
  process.stderr.write(`no session at ${authFile}; see DOCS-relay.md (seed it once)\n`)
  process.exit(3)
}
const db = rtdb(fb.databaseUrl, fileTokenSource(authFile, fb.apiKey))
const worker = new RelayWorker(db, {
  dataDir: process.env['MJ_DATA'] ?? join(home, 'data/mahjong-teacher'),
  claudeBin: process.env['CLAUDE_BIN'] ?? join(home, '.local/bin/claude'),
}, `pc-${hostname()}`)

const log = (m: string): void => {
  process.stdout.write(`${new Date().toISOString()} ${m}\n`)
}
const safe = (what: string, p: Promise<void>): void => {
  p.catch((e: unknown) => log(`${what} failed: ${e instanceof Error ? e.message : String(e)}`))
}

async function stream(): Promise<void> {
  for (let backoff = 1000; ; backoff = Math.min(backoff * 2, 30_000)) {
    const ctl = new AbortController()
    try {
      log('listening')
      await db.listen(`${ROOT}/requests`, () => safe('scan', worker.scan()), ctl.signal)
      backoff = 1000
    } catch (e) {
      log(`stream ended: ${e instanceof Error ? e.message : String(e)}`)
    }
    await new Promise((r) => setTimeout(r, backoff))
  }
}

safe('heartbeat', worker.heartbeat())
safe('scan', worker.scan())
setInterval(() => safe('heartbeat', worker.heartbeat()), 30_000)
setInterval(() => safe('scan', worker.scan()), 60_000)
void stream()
