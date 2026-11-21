import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { harness, SHOTS } from './e2e_lib.ts'

// Bot plays a seeded East-only game to the end screen; screenshots on the way.
const len = process.argv[2] === 'hanchan' ? 'hanchan' : 'east'
const t0 = Date.now()
const h = await harness()
mkdirSync(SHOTS, { recursive: true })
await h.page.goto(`${h.base}/?agent=1&len=${len}&seed=1&delay=0`)
await h.page.waitForSelector('#table')
await h.page.waitForTimeout(400)
await h.page.screenshot({ path: join(SHOTS, 'play-midgame.png') })
await h.page.waitForSelector('body[data-screen="end"]', { timeout: 50_000 })
await h.page.screenshot({ path: join(SHOTS, `play-end-${len}.png`) })
process.stdout.write(`end screen reached in ${String(Date.now() - t0)} ms\n`)
await h.close()
