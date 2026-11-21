import type { Explain } from '../../engine/explain.ts'
import type { Correction, Mark, PlayLog } from '../../log/log.ts'
import { serializeLog } from '../../log/log.ts'

// How the page reaches Claude and the log store. On the PC (loopback page) that
// is the bridge's /api; on the public site it is the Firebase relay (relay.ts).

export interface AskRequest {
  logId: string
  itemId: string
  turn: number
  question: string
  state: Explain
  entities: { entity: string; label: string }[]
  marks: Mark[]
  sessionId: string | null
  jpegBase64: string | null
}

export interface AskReply {
  answer: string
  sessionId: string
  flagged: boolean
  corrected: Correction[]
}

export interface Transport {
  ask: (r: AskRequest) => Promise<AskReply>
  saveLog: (log: PlayLog) => Promise<void>
  saveShot: (name: string, pngBase64: string) => Promise<void>
  loadLog: (id: string) => Promise<string>
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(`${path}: ${String(res.status)} ${await res.text()}`)
  return res
}

export const bridgeTransport: Transport = {
  ask: async (r) => (await (await call('api/ask', { method: 'POST', body: JSON.stringify(r) })).json()) as AskReply,
  saveLog: async (log) => {
    await call(`api/log/${log.id}`, { method: 'PUT', body: serializeLog(log) })
  },
  saveShot: async (name, pngBase64) => {
    await call(`api/shot/${name}`, { method: 'PUT', body: JSON.stringify({ pngBase64 }) })
  },
  loadLog: async (id) => (await call(`api/log/${id}`)).text(),
}
