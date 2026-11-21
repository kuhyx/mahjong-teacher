import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { harness, SHOTS } from './e2e_lib.ts'

// Done check (C20): the bot plays East-only to the end screen in headless,
// muted Chromium; then marks a tile, asks one question (stub claude answers),
// says "ok that is clear", and the saved log round-trips byte-identically.
// Prints PASS and leaves screenshots in shots/. Needs a fresh `pnpm build`.

const t0 = Date.now()
const fail = (why: string): never => {
  process.stderr.write(`FAIL: ${why}\n`)
  process.exit(1)
}
if (!existsSync(join(import.meta.dirname, '../dist/index.html'))) fail('dist/ missing: run pnpm build')
mkdirSync(SHOTS, { recursive: true })
const h = await harness()
const { page } = h
try {
  await page.goto(`${h.base}/?agent=1&len=east&seed=1`)
  await page.waitForSelector('body[data-screen="end"]', { timeout: 40_000 })
  if (await page.evaluate(() => window.__mj.audioOn())) fail('sound is on in an agent run')
  await page.screenshot({ path: join(SHOTS, 'done-end-screen.png') })

  await page.click('#t-mark')
  await page.waitForSelector('#mark-tools')
  const tile = page.locator('#end-screen [data-entity^="tile:"]').first()
  const box = await tile.boundingBox()
  if (!box) fail('no tile on the end screen to mark')
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const chip = await page.locator('#chips .chip').first().textContent()
  if (!chip?.includes('winning hand')) fail(`picked label missing: ${String(chip)}`)
  await page.click('[data-tool="circle"]')
  await page.mouse.move(200, 200)
  await page.mouse.down()
  await page.mouse.move(320, 300)
  await page.mouse.up()
  await page.fill('#q', 'Why is this tile part of the winning hand?')
  await page.click('#send')
  await page.waitForSelector('#thread .turn.assistant:not(.waiting)', { timeout: 15_000 })
  const answer = await page.locator('#thread .turn.assistant').first().textContent()
  if (!answer?.includes('Shanten')) fail(`unexpected answer: ${String(answer)}`)
  await page.screenshot({ path: join(SHOTS, 'done-answered-chat.png') })

  const logId = await page.evaluate(() => window.__mjLog.id())
  if (!logId) fail('no log id')
  await page.fill('#q', 'ok that is clear')
  await page.click('#send')
  await page.waitForSelector('#chat', { state: 'detached', timeout: 10_000 })

  const file = join(h.cfg.dataDir, 'logs', `play-${String(logId)}.json`)
  const saved = JSON.parse(readFileSync(file, 'utf8')) as { items: { cleared: boolean; topics: string[]; transcript: unknown[]; screenshot: string; sessionId: string }[] }
  const item = saved.items[0]
  if (saved.items.length !== 1 || !item?.cleared) fail('log does not hold one cleared item')
  if (!item || item.transcript.length !== 3 || !item.sessionId || item.topics.length === 0) fail('item incomplete')
  if (!existsSync(join(h.cfg.dataDir, 'logs', item?.screenshot ?? 'x'))) fail('marked PNG not saved beside the log')
  await page.reload()
  await page.waitForFunction(() => typeof window.__mjLog === 'object')
  const rt = await page.evaluate((id) => window.__mjLog.reload(id), String(logId))
  if (!rt.same) fail('log is not byte-identical after reload + save')
  const ms = Date.now() - t0
  if (ms > 60_000) fail(`took ${String(ms)} ms`)
  process.stdout.write(`PASS in ${String(ms)} ms; log ${String(rt.bytes)} bytes; shots: ${SHOTS}/done-end-screen.png, done-answered-chat.png\n`)
} finally {
  await h.close()
}
