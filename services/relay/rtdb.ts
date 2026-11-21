import type { TokenSource } from './auth.ts'

// Minimal Firebase RTDB REST client: JSON get/put/delete, ETag-guarded writes
// (claims) and the streaming (SSE) listener. `?auth=` is never logged.

export interface Rtdb {
  get: <T>(path: string, shallow?: boolean) => Promise<T | null>
  put: (path: string, value: unknown) => Promise<void>
  del: (path: string) => Promise<void>
  /** Write only if the node still has `etag`; false when someone else won. */
  putIf: (path: string, value: unknown, etag: string) => Promise<boolean>
  etag: (path: string) => Promise<{ etag: string; value: unknown }>
  listen: (path: string, onChange: () => void, signal: AbortSignal) => Promise<void>
}

export function rtdb(base: string, token: TokenSource, fetchImpl: typeof fetch = fetch): Rtdb {
  const url = async (path: string, extra = ''): Promise<string> =>
    `${base.replace(/\/$/, '')}/${path}.json?auth=${encodeURIComponent(await token())}${extra}`
  const check = async (res: Response, what: string): Promise<Response> => {
    if (!res.ok) throw new Error(`rtdb ${what}: ${String(res.status)}`)
    return res
  }
  return {
    get: async <T>(path: string, shallow = false) =>
      (await (await check(await fetchImpl(await url(path, shallow ? '&shallow=true' : '')), `get ${path}`)).json()) as T | null,
    put: async (path, value) => {
      await check(await fetchImpl(await url(path), { method: 'PUT', body: JSON.stringify(value) }), `put ${path}`)
    },
    del: async (path) => {
      await check(await fetchImpl(await url(path), { method: 'DELETE' }), `delete ${path}`)
    },
    etag: async (path) => {
      const res = await check(await fetchImpl(await url(path), { headers: { 'X-Firebase-ETag': 'true' } }), `etag ${path}`)
      return { etag: res.headers.get('etag') ?? '', value: (await res.json()) as unknown }
    },
    putIf: async (path, value, etag) => {
      const res = await fetchImpl(await url(path), { method: 'PUT', headers: { 'if-match': etag }, body: JSON.stringify(value) })
      if (res.status === 412) return false
      await check(res, `putIf ${path}`)
      return true
    },
    listen: async (path, onChange, signal) => {
      const res = await check(await fetchImpl(await url(path), { headers: { accept: 'text/event-stream' }, signal }), `listen ${path}`)
      const reader = res.body?.getReader()
      if (!reader) return
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        buf += dec.decode(value, { stream: true })
        let at: number
        while ((at = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, at)
          buf = buf.slice(at + 2)
          if (/^event: (put|patch)/m.test(ev)) onChange()
          if (/^event: (auth_revoked|cancel)/m.test(ev)) return
        }
      }
    },
  }
}
