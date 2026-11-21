import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { harness, SHOTS } from './e2e_lib.ts'

// Instant proposal (ae243e36 C1-C4 UI): ✎, pick one tile, tap ➤ with nothing
// typed -> a proposal with a demo appears; ✗ -> a different demo in the same
// thread; ✓ closes and the log keeps the accepted demo. Then a circle on the
// score area + ➤: the stub states a wrong score and the engine strikes it.
// `--touch` runs it on a 412x915 portrait phone. Needs a fresh `pnpm build`.
const touch = process.argv.includes('--touch')
const t0 = Date.now()
const h = await harness(touch ? { width: 412, height: 915 } : { width: 1280, height: 800 }, touch)
const { page } = h
const tag = touch ? 'phone' : 'desk'
const fail = (why: string): never => {
  throw new Error(why)
}
const tap = async (sel: string): Promise<void> => (touch ? page.tap(sel) : page.click(sel))
const at = async (x: number, y: number): Promise<void> => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))
try {
  await page.goto(`${h.base}/?agent=1&len=east&seed=1&delay=400`)
  await page.waitForSelector('[data-entity^="hand:0:"]')
  await tap('#t-mark')
  await page.waitForSelector('#mark-tools')
  const tile = await page.locator('[data-entity^="hand:0:"]').first().boundingBox()
  if (!tile) fail('no hand tile')
  else await at(tile.x + tile.width / 2, tile.y + tile.height / 2)
  if (!(await page.locator('#send.go').count())) fail('➤ does not pulse after a pick')
  await tap('#send')
  await page.waitForSelector('#thread .turn.assistant.proposal', { timeout: 15_000 })
  const first = await page.locator('#thread .turn.assistant.proposal .demo-strip').last().innerHTML()
  if (!(await page.locator('#thread .turn.user.trigger').count())) fail('trigger turn not drawn as an icon')
  if (await page.locator('#thread').getByText('show me').count()) fail('trigger phrase shown as text')
  if (!(await page.locator('.spot').count())) fail('no table spotlight from demo.focus')
  await page.screenshot({ path: join(SHOTS, `propose-${tag}-1.png`) })
  await tap('#reject')
  await page.waitForFunction(() => document.querySelectorAll('#thread .turn.assistant.proposal').length === 2, null, { timeout: 15_000 })
  const second = await page.locator('#thread .turn.assistant.proposal .demo-strip').last().innerHTML()
  if (second === first) fail('✗ did not bring a different demo')
  await page.screenshot({ path: join(SHOTS, `propose-${tag}-2.png`) })
  const logId = await page.evaluate(() => window.__mjLog.id())
  await tap('#clear')
  await page.waitForSelector('#chat', { state: 'detached', timeout: 10_000 })
  const saved = JSON.parse(readFileSync(join(h.cfg.dataDir, 'logs', `play-${String(logId)}.json`), 'utf8')) as { items: { cleared: boolean; transcript: { demo?: { tiles: string[] } }[] }[] }
  const item = saved.items[0]
  const accepted = item?.transcript.filter((t) => t.demo).at(-1)?.demo
  if (!item?.cleared || accepted?.tiles.join() !== '1m,2m,3m') fail(`log lacks the accepted demo: ${JSON.stringify(accepted)}`)

  // C2: circle around my score, ➤ with nothing typed.
  await tap('#t-mark')
  await page.waitForSelector('#mark-tools')
  await tap('[data-tool="circle"]')
  const score = await page.locator('[data-entity="score:0"]').boundingBox()
  if (!score) fail('no score box')
  else {
    await page.mouse.move(score.x - 10, score.y - 10)
    await page.mouse.down()
    await page.mouse.move(score.x + score.width + 10, score.y + score.height + 10)
    await page.mouse.up()
  }
  if (!(await page.locator('#send.go').count())) fail('➤ does not pulse after a circle')
  await tap('#send')
  await page.waitForSelector('#thread .turn.assistant.proposal', { timeout: 15_000 })
  const fix = await page.locator('#thread .fix[data-entity="correction:scores"]').textContent()
  if (!fix?.includes('25000 25000 25000 25000') || !fix.includes('24000')) fail(`wrong score not struck: ${String(fix)}`)
  await page.screenshot({ path: join(SHOTS, `propose-${tag}-score.png`) })
  const ms = Date.now() - t0
  process.stdout.write(`PASS propose ${tag} in ${String(ms)} ms; shots: ${SHOTS}/propose-${tag}-{1,2,score}.png\n`)
} finally {
  await h.close()
}
