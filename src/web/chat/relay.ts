import type { PlayLog } from '../../log/log.ts'
import { serializeLog } from '../../log/log.ts'
import { nativeSignIn, type ShellWindow } from './native_signin.ts'
import type { AskReply, AskRequest, Transport } from './transport.ts'

// Public-site transport: the page (phone or PC browser) signs in with Google
// through Firebase Auth and queues requests in the RTDB node mahjong/v1; the
// PC worker answers. The database rules admit only kuhy's uid, so any other
// account (or none) gets 401 and sees the sign-in glyph; nothing reaches claude.

export class SignInNeeded extends Error {}

const ENV = import.meta.env
const CFG = {
  apiKey: String(ENV['VITE_FB_API_KEY'] ?? ''),
  authDomain: String(ENV['VITE_FB_AUTH_DOMAIN'] ?? ''),
  databaseURL: String(ENV['VITE_FB_DB_URL'] ?? ''),
  projectId: String(ENV['VITE_FB_PROJECT'] ?? ''),
}
const ROOT = 'mahjong/v1'
export const relayConfigured = (): boolean => CFG.apiKey !== '' && CFG.databaseURL !== ''

type AuthMod = typeof import('firebase/auth')
let authMod: Promise<{ mod: AuthMod; auth: ReturnType<AuthMod['getAuth']> }> | null = null

function auth(): Promise<{ mod: AuthMod; auth: ReturnType<AuthMod['getAuth']> }> {
  authMod ??= (async () => {
    const { initializeApp } = await import('firebase/app')
    const mod = await import('firebase/auth')
    const a = mod.getAuth(initializeApp(CFG))
    await a.authStateReady()
    return { mod, auth: a }
  })()
  return authMod
}

export async function signIn(): Promise<void> {
  const { mod, auth: a } = await auth()
  await nativeSignIn<ReturnType<AuthMod['GoogleAuthProvider']['credential']>>(globalThis as unknown as ShellWindow, {
    popup: () => mod.signInWithPopup(a, new mod.GoogleAuthProvider()),
    withCred: (c) => mod.signInWithCredential(a, c),
    credential: (t) => mod.GoogleAuthProvider.credential(t),
  })
}

export async function signedIn(): Promise<boolean> {
  return relayConfigured() && (await auth()).auth.currentUser !== null
}

async function token(): Promise<string> {
  const user = (await auth()).auth.currentUser
  if (!user) throw new SignInNeeded('sign in first')
  return user.getIdToken()
}

async function rest(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${CFG.databaseURL}/${path}.json?auth=${encodeURIComponent(await token())}`, init)
  if (res.status === 401 || res.status === 403) throw new SignInNeeded('not allowed')
  if (!res.ok) throw new Error(`rtdb ${String(res.status)}`)
  return res.json()
}

const rid = (): string => Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')

/** Seconds since the PC worker's last heartbeat (Infinity when never seen). */
export async function workerAge(): Promise<number> {
  const w = (await rest(`${ROOT}/worker`)) as { at?: number } | null
  return w?.at ? (Date.now() - w.at) / 1000 : Infinity
}

/** Queue a request and wait (event stream, no polling) for the worker's result. */
async function request(kind: string, body: unknown): Promise<unknown> {
  const id = rid()
  await rest(`${ROOT}/requests/${id}`, { method: 'PUT', body: JSON.stringify({ kind, at: { '.sv': 'timestamp' }, body }) })
  const url = `${CFG.databaseURL}/${ROOT}/results/${id}.json?auth=${encodeURIComponent(await token())}`
  const result = await new Promise<{ ok: boolean; reply?: unknown; error?: string }>((resolve, reject) => {
    const es = new EventSource(url)
    es.addEventListener('put', (e) => {
      const d = (JSON.parse((e as MessageEvent<string>).data) as { data: unknown }).data as { ok: boolean } | null
      if (d && typeof d.ok === 'boolean') {
        es.close()
        resolve(d)
      }
    })
    es.addEventListener('auth_revoked', () => {
      es.close()
      reject(new SignInNeeded('session expired'))
    })
  })
  void rest(`${ROOT}/results/${id}`, { method: 'DELETE' }).catch(() => undefined)
  if (!result.ok) throw new Error(result.error ?? 'worker error')
  return result.reply
}

export const relayTransport: Transport = {
  ask: async (r: AskRequest) => (await request('ask', r)) as AskReply,
  saveLog: async (log: PlayLog) => {
    await request('log', { id: log.id, text: serializeLog(log) })
  },
  saveShot: async (name, pngBase64) => {
    await request('shot', { name, pngBase64 })
  },
  loadLog: () => Promise.reject(new Error('logs live on the PC; open the loopback page to reload them')),
}
