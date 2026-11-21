import { mkdtempSync, writeFileSync } from 'node:fs'
import { request, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startBridge, type BridgeConfig } from '../../services/bridge/server.ts'
import { emptyLog, serializeLog } from '../../src/log/log.ts'

let server: Server
let base = ''
const dist = mkdtempSync(join(tmpdir(), 'mj-dist-'))
writeFileSync(join(dist, 'index.html'), '<p>hi</p>')
const cfg: BridgeConfig = { port: 0, root: '/srv/mj', dataDir: mkdtempSync(join(tmpdir(), 'mj-data-')), distDir: dist, claudeBin: '/bin/false', publicHosts: ['mj.example'] }

beforeAll(async () => {
  server = await startBridge(cfg)
  base = `http://127.0.0.1:${String(cfg.port)}`
})
afterAll(() => server.close())

const json = { 'content-type': 'application/json' }

/** fetch() cannot set Host, so raw http for the public-host case. */
function getAs(host: string, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: cfg.port, path, headers: { host } }, (res) => {
      let body = ''
      res.on('data', (c: Buffer) => (body += c.toString()))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('bridge server', () => {
  it('stores a log and returns the same bytes', async () => {
    const body = serializeLog(emptyLog('t1', 1, 'east', '2026-11-21T00:00:00.000Z'))
    expect((await fetch(`${base}/api/log/t1`, { method: 'PUT', headers: json, body })).status).toBe(200)
    expect(await (await fetch(`${base}/api/log/t1`)).text()).toBe(body)
  })

  it('refuses a foreign Origin, non-JSON writes and path tricks', async () => {
    const foreign = await fetch(`${base}/api/ask`, { method: 'POST', headers: { ...json, origin: 'https://evil.example' }, body: '{}' })
    expect(foreign.status).toBe(403)
    expect((await fetch(`${base}/api/ask`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status).toBe(415)
    expect((await fetch(`${base}/api/log/..%2Fetc`)).status).toBe(400)
  })

  it('serves the static site to the public host but never the API', async () => {
    expect((await getAs('mj.example', '/')).body).toContain('hi')
    expect((await getAs('mj.example', '/api/health')).status).toBe(403)
    expect((await getAs('evil.example', '/')).status).toBe(403)
  })

  it('health names the checkout it serves and whether the page exists', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true, claude: true, page: true, root: '/srv/mj' })
    // A unit left pointing at a deleted checkout: the process lives, dist is gone.
    const gone: BridgeConfig = { ...cfg, port: 0, distDir: mkdtempSync(join(tmpdir(), 'mj-gone-')) }
    const s2 = await startBridge(gone)
    try {
      expect(await (await fetch(`http://127.0.0.1:${String(gone.port)}/api/health`)).json()).toMatchObject({ ok: false, page: false })
    } finally {
      s2.close()
    }
  })
})
