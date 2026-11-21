import { BadRequest, handleAsk, normalizeAsk, validAsk, saveLog, saveShot, type StoreConfig } from '../bridge/handlers.ts'
import type { Rtdb } from './rtdb.ts'

// Phone/PC browsers write `mahjong/v1/requests/{rid}`; this worker (one per PC)
// claims each with an ETag-guarded write, runs it and writes
// `mahjong/v1/results/{rid}`. A heartbeat at `mahjong/v1/worker` lets the page
// show the worker-offline glyph. Queued requests are served when it starts.

export const ROOT = 'mahjong/v1'
const LEASE_MS = 300_000
const RID = /^[A-Za-z0-9_-]{8,64}$/

export interface RelayRequest {
  kind: 'ask' | 'log' | 'shot' | 'ping'
  at: number
  body: unknown
  claim?: { by: string; at: number }
}

export class RelayWorker {
  private readonly inFlight = new Set<string>()
  spawned = 0

  private readonly db: Rtdb
  private readonly store: StoreConfig
  private readonly device: string
  private readonly now: () => number

  constructor(db: Rtdb, store: StoreConfig, device: string, now: () => number = Date.now) {
    this.db = db
    this.store = store
    this.device = device
    this.now = now
  }

  async heartbeat(): Promise<void> {
    await this.db.put(`${ROOT}/worker`, { at: { '.sv': 'timestamp' }, device: this.device })
  }

  /** Serve every unclaimed request; called on each stream event and on a timer. */
  async scan(): Promise<void> {
    const ids = Object.keys((await this.db.get<Record<string, true>>(`${ROOT}/requests`, true)) ?? {})
    await Promise.all(ids.map((rid) => this.serve(rid)))
  }

  private async claim(rid: string): Promise<boolean> {
    const { etag, value } = await this.db.etag(`${ROOT}/requests/${rid}/claim`)
    const c = value as RelayRequest['claim'] | null
    const mine = c?.by === this.device
    if (c && !mine && this.now() - c.at < LEASE_MS) return false
    return this.db.putIf(`${ROOT}/requests/${rid}/claim`, { by: this.device, at: this.now() }, etag)
  }

  async serve(rid: string): Promise<void> {
    if (this.inFlight.has(rid)) return
    if (!RID.test(rid)) {
      await this.db.del(`${ROOT}/requests/${rid}`)
      return
    }
    this.inFlight.add(rid)
    try {
      if (!(await this.claim(rid))) return
      const req = await this.db.get<RelayRequest>(`${ROOT}/requests/${rid}`)
      if (!req) return
      let result: Record<string, unknown>
      try {
        result = { ok: true, reply: await this.run(req) }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        result = { ok: false, error: e instanceof BadRequest || e instanceof SyntaxError ? `bad request: ${msg}` : msg }
      }
      await this.db.put(`${ROOT}/results/${rid}`, { ...result, at: { '.sv': 'timestamp' } })
      await this.db.del(`${ROOT}/requests/${rid}`)
    } finally {
      this.inFlight.delete(rid)
    }
  }

  private async run(req: RelayRequest): Promise<unknown> {
    const b = req.body as Record<string, unknown> | null
    if (req.kind === 'ping') return { pong: true, device: this.device }
    if (req.kind === 'ask') {
      if (!validAsk(normalizeAsk(b))) throw new BadRequest('bad ask request')
      this.spawned++
      return handleAsk(b, this.store)
    }
    if (req.kind === 'log' && b && typeof b['id'] === 'string' && typeof b['text'] === 'string') {
      saveLog(b['id'], b['text'], this.store)
      return { saved: b['id'] }
    }
    if (req.kind === 'shot' && b && typeof b['name'] === 'string') return { file: saveShot(b['name'], b['pngBase64'], this.store) }
    throw new BadRequest(`unknown request kind ${String(req.kind)}`)
  }
}
