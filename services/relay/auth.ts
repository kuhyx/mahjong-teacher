import { readFileSync, writeFileSync } from 'node:fs'

// Worker credential: ~/.config/mahjong-teacher/firebase_auth.json in the
// crdt-sync format (id_token, refresh_token, expires_at ISO). Refreshed via the
// Secure Token API; a rotated refresh token is written back (0600).

export interface Session {
  id_token: string
  refresh_token: string
  expires_at: string
}

export type TokenSource = () => Promise<string>

export function fileTokenSource(file: string, apiKey: string, fetchImpl: typeof fetch = fetch): TokenSource {
  let cached: Session | null = null
  return async () => {
    cached ??= JSON.parse(readFileSync(file, 'utf8')) as Session
    if (Date.parse(cached.expires_at) - 120_000 > Date.now()) return cached.id_token
    const res = await fetchImpl(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cached.refresh_token }).toString(),
    })
    if (!res.ok) throw new Error(`token refresh failed: ${String(res.status)}`)
    const b = (await res.json()) as { id_token: string; refresh_token: string; expires_in: string }
    cached = { id_token: b.id_token, refresh_token: b.refresh_token, expires_at: new Date(Date.now() + Number(b.expires_in) * 1000).toISOString() }
    writeFileSync(file, JSON.stringify(cached), { mode: 0o600 })
    return cached.id_token
  }
}
