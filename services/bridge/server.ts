import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { BadRequest, handleAsk, loadLog, saveLog, saveShot } from './handlers.ts'

// Loopback bridge: serves the built game, writes play-through logs (a browser
// cannot write files) and answers questions through `claude -p`. Bound to
// 127.0.0.1 only; Host and Origin are checked so another web page open in the
// same browser cannot spend kuhy's plan (DNS rebinding / CSRF).

export interface BridgeConfig {
  port: number
  dataDir: string
  distDir: string
  claudeBin: string
  env?: Record<string, string>
  /** Public host names (Caddy) that may load the static site but never /api. */
  publicHosts?: string[]
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon',
}
const MAX_BODY = 40 * 1024 * 1024

function send(res: ServerResponse, code: number, body: string | Buffer, type = 'application/json'): void {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) req.destroy(new Error('body too large'))
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function hostOk(req: IncomingMessage, cfg: BridgeConfig): boolean {
  const allowed = new Set([`127.0.0.1:${String(cfg.port)}`, `localhost:${String(cfg.port)}`])
  const host = req.headers.host ?? ''
  const origin = req.headers.origin
  if (!allowed.has(host)) return false
  if (origin === undefined) return true
  try {
    return allowed.has(new URL(origin).host)
  } catch {
    return false
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, cfg: BridgeConfig, path: string): Promise<void> {
  if (path === '/api/health') return send(res, 200, JSON.stringify({ ok: true, claude: existsSync(cfg.claudeBin) }))
  const isWrite = req.method === 'POST' || req.method === 'PUT'
  if (isWrite && !(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, '{"error":"json only"}')
  try {
    const logMatch = /^\/api\/log\/([^/]+)$/.exec(path)
    if (logMatch && req.method === 'GET') {
      const text = loadLog(logMatch[1] ?? '', cfg)
      return text === null ? send(res, 404, '{"error":"no log"}') : send(res, 200, text)
    }
    if (logMatch && req.method === 'PUT') {
      saveLog(logMatch[1] ?? '', await readBody(req), cfg)
      return send(res, 200, '{"ok":true}')
    }
    const shotMatch = /^\/api\/shot\/([^/]+)$/.exec(path)
    if (shotMatch && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req)) as { pngBase64?: unknown }
      return send(res, 200, JSON.stringify({ ok: true, file: saveShot(shotMatch[1] ?? '', body.pngBase64, cfg) }))
    }
    if (path === '/api/ask' && req.method === 'POST') {
      return send(res, 200, JSON.stringify(await handleAsk(JSON.parse(await readBody(req)), cfg)))
    }
  } catch (e) {
    if (e instanceof BadRequest || e instanceof SyntaxError) return send(res, 400, JSON.stringify({ error: e.message }))
    throw e
  }
  return send(res, 404, '{"error":"no route"}')
}

function serveStatic(res: ServerResponse, cfg: BridgeConfig, path: string): void {
  const rel = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '')
  let file = join(cfg.distDir, rel)
  if (!file.startsWith(cfg.distDir)) return send(res, 403, 'forbidden', 'text/plain')
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) {
    const notFound = join(cfg.distDir, '404.html')
    return send(res, 404, existsSync(notFound) ? readFileSync(notFound) : 'not found', 'text/html; charset=utf-8')
  }
  const type = file.endsWith('ai-catalog.json') ? 'application/ai-catalog+json' : (TYPES[extname(file)] ?? 'application/octet-stream')
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache', link: '</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json"' })
  createReadStream(file).pipe(res)
}

export function startBridge(cfg: BridgeConfig): Promise<Server> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname
    const isPublic = (cfg.publicHosts ?? []).includes(req.headers.host ?? '')
    if (isPublic && !path.startsWith('/api/') && (req.method === 'GET' || req.method === 'HEAD')) return serveStatic(res, cfg, path)
    if (!hostOk(req, cfg)) return send(res, 403, '{"error":"host"}')
    if (!path.startsWith('/api/')) return serveStatic(res, cfg, path)
    handleApi(req, res, cfg, path).catch((e: unknown) => {
      if (!res.headersSent) send(res, 502, JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
    })
  })
  return new Promise((resolve) => server.listen(cfg.port, '127.0.0.1', () => {
    const addr = server.address()
    if (addr && typeof addr === 'object') cfg.port = addr.port
    resolve(server)
  }))
}
