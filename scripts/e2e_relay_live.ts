// Live relay check: the public site in headless Chromium at phone size, signed
// in with the relay worker's own Firebase session (kuhy's uid), asks one real
// question through RTDB -> mahjong-relay -> claude -p. Spends plan usage, so it
// is a manual check: `node scripts/e2e_relay_live.ts`. Exits 1 without an answer.
// `--propose`: tap ➤ with nothing typed; needs a proposal with its demo drawn
// (ae243e36 C4). MJ_SITE=http://127.0.0.1:8797/ runs the same on the PC bridge.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const home = homedir()
const fb = JSON.parse(readFileSync(join(home, '.config/crdt-sync/firebase.json'), 'utf8')) as { apiKey: string; uid: string }
const sess = JSON.parse(readFileSync(join(home, '.config/mahjong-teacher/firebase_auth.json'), 'utf8')) as { id_token: string; refresh_token: string }
const propose = process.argv.includes('--propose')
const site = process.env['MJ_SITE'] ?? 'https://mahjong.kuhy.duckdns.org/'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--mute-audio', '--headless=new'] })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
const t0 = Date.now()
const ts = (): string => `${String(Date.now() - t0).padStart(6)}ms`
page.on('console', (m) => process.stdout.write(`${ts()} console.${m.type()}: ${m.text().slice(0, 300)}\n`))
page.on('pageerror', (e) => process.stdout.write(`${ts()} pageerror: ${e.message}\n`))
page.on('request', (r) => { if (r.url().includes('firebasedatabase')) process.stdout.write(`${ts()} req ${r.method()} ${r.url().split('?')[0]?.split('/mahjong/')[1] ?? ''}\n`) })
try {
  await page.goto(`${site}?len=east&seed=1&agent=1`)
  await page.evaluate(async ({ apiKey, uid, idt, rt }) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const o = indexedDB.open('firebaseLocalStorageDb', 1)
      o.onupgradeneeded = () => o.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' })
      o.onsuccess = () => res(o.result)
      o.onerror = () => rej(o.error)
    })
    const key = `firebase:authUser:${apiKey}:[DEFAULT]`
    const value = { uid, emailVerified: true, isAnonymous: false, providerData: [], apiKey, appName: '[DEFAULT]',
      stsTokenManager: { refreshToken: rt, accessToken: idt, expirationTime: 0 }, createdAt: '0', lastLoginAt: '0' }
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('firebaseLocalStorage', 'readwrite')
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value })
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
  }, { apiKey: fb.apiKey, uid: fb.uid, idt: sess.id_token, rt: sess.refresh_token })
  await page.reload()
  await page.waitForTimeout(1500)
  await page.click('#t-mark')
  await page.waitForTimeout(2000)
  process.stdout.write(`${ts()} status: ${await page.locator('#status').innerHTML()}\n`)
  const tile = page.locator('[data-entity^="tile:"]').first()
  await tile.tap({ force: true })
  if (!propose) await page.fill('#q', 'Co to za kafel? Jedno zdanie.')
  await page.click('#send')
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(2000)
    const th = await page.locator('#thread').innerText()
    process.stdout.write(`${ts()} thread: ${th.replace(/\n/g, ' | ').slice(0, 200)}\n`)
    if (!th.includes('…')) break
  }
  await page.screenshot({ path: process.env['MJ_SHOT'] ?? '/tmp/mj-relay-live.png' })
  if ((await page.locator('#thread .turn.assistant:not(.waiting)').count()) === 0) throw new Error('no answer arrived')
  if (propose && (await page.locator('#thread .turn.assistant.proposal .demo-strip, #thread .turn.assistant.proposal .gloss-chip').count()) === 0) throw new Error('answer has no demo')
  process.stdout.write(`PASS relay live in ${ts()}\n`)
} finally {
  await browser.close()
}
