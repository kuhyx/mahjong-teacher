import type { Rtdb } from '../../services/relay/rtdb.ts'

/** In-memory RTDB with ETags; `auth` decides whether a token may write (rules). */
export class FakeRtdb implements Rtdb {
  data: Record<string, unknown> = {}
  private version = 0
  private readonly etags = new Map<string, number>()

  private node(path: string): unknown {
    return path.split('/').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), this.data) ?? null
  }

  private set(path: string, value: unknown): void {
    const keys = path.split('/')
    const last = keys.pop() ?? ''
    let o = this.data
    for (const k of keys) o = (o[k] ??= {}) as Record<string, unknown>
    const v = JSON.parse(JSON.stringify(value, (_k, x: unknown) => (x && typeof x === 'object' && '.sv' in x ? 1_700_000_000_000 : x))) as unknown
    if (v === null) delete o[last]
    else o[last] = v
    this.etags.set(path, ++this.version)
  }

  get = <T>(path: string, shallow = false): Promise<T | null> => {
    const n = this.node(path)
    if (shallow && n && typeof n === 'object') return Promise.resolve(Object.fromEntries(Object.keys(n).map((k) => [k, true])) as T)
    return Promise.resolve(n as T | null)
  }
  put = (path: string, value: unknown): Promise<void> => Promise.resolve(this.set(path, value))
  del = (path: string): Promise<void> => Promise.resolve(this.set(path, null))
  etag = (path: string): Promise<{ etag: string; value: unknown }> =>
    Promise.resolve({ etag: String(this.etags.get(path) ?? 0), value: this.node(path) })
  putIf = (path: string, value: unknown, etag: string): Promise<boolean> => {
    if (String(this.etags.get(path) ?? 0) !== etag) return Promise.resolve(false)
    this.set(path, value)
    return Promise.resolve(true)
  }
  listen = (): Promise<void> => Promise.resolve()
}
