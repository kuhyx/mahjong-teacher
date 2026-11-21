import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { SCENES } from '../src/tutorial/scenes.ts'
import { harness } from './e2e_lib.ts'

// Tutorial (6662507c C5, C8): 🎓 opens it over a paused game; `?tutorial=1`
// opens it at load. Every tap advances one step through every scene; each step
// shows its demo or table spotlight, a gloss chip exactly where the scene has
// one, and no other visible text. Taps never play a move. The last tap closes
// it and the game resumes. Headless, muted, < 60 s. Needs a fresh `pnpm build`.
// Flags: --touch (412x915 phone), --shots <dir> (one JPEG per step, for docs).
const argv = process.argv.slice(2)
const touch = argv.includes('--touch')
const s = argv.indexOf('--shots')
const shots = s >= 0 ? argv[s + 1] : undefined
if (shots) mkdirSync(shots, { recursive: true })
const t0 = Date.now()
const h = await harness(touch ? { width: 412, height: 915 } : { width: 1280, height: 800 }, touch)
const { page } = h
const fail = (why: string): never => {
  throw new Error(why)
}
const tapAt = async (x: number, y: number): Promise<void> => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))
try {
  // 🎓 from a running game, ✕ closes it again.
  await page.goto(`${h.base}/?agent=1&len=east&seed=1&delay=300`)
  await page.waitForSelector('[data-entity^="hand:0:"]')
  await (touch ? page.tap('#t-tutorial') : page.click('#t-tutorial'))
  await page.waitForSelector('#tutorial')
  if (!(await page.evaluate(() => window.__mj.game()?.isPaused()))) fail('game not paused under the tutorial')
  await (touch ? page.tap('#tut-close') : page.click('#tut-close'))
  await page.waitForSelector('#tutorial', { state: 'detached' })

  await page.goto(`${h.base}/?agent=1&len=east&seed=1&delay=300&tutorial=1`)
  await page.waitForSelector('#tutorial')
  const discards0 = await page.evaluate(() => window.__mj.game()?.round.players.map((p) => p.discards.length).join())
  const vw = touch ? 412 : 1280
  const vh = touch ? 915 : 800
  let n = 0
  for (const scene of SCENES) {
    for (const [i, step] of scene.steps.entries()) {
      const at = await page.locator('#tutorial').evaluate((el) => `${el.getAttribute('data-scene') ?? ''}:${el.getAttribute('data-step') ?? ''}`)
      if (at !== `${scene.id}:${String(i)}`) fail(`expected ${scene.id}:${String(i)}, at ${at}`)
      const tiles = await page.locator('#tutorial .demo-strip [data-entity^="demo:"]').count()
      const spots = await page.locator('#tutorial .spot').count()
      if (tiles !== step.tiles.length) fail(`${at}: ${String(tiles)} demo tiles, want ${String(step.tiles.length)}`)
      if ((step.focus?.length ?? 0) > 0 && spots === 0) fail(`${at}: no spotlight`)
      const chip = await page.locator('#tutorial .gloss-chip').count()
      if (chip !== (step.gloss ? 1 : 0)) fail(`${at}: gloss chip count ${String(chip)}`)
      // No sentences: only the gloss chip may hold letters outside the SVGs.
      const stray = await page.locator('#tutorial').evaluate((el) => {
        const c = el.cloneNode(true) as HTMLElement
        for (const x of c.querySelectorAll('svg, .gloss-chip')) x.remove()
        return (c.textContent ?? '').replace(/[\s✕]/g, '')
      })
      if (stray) fail(`${at}: stray text "${stray}"`)
      if (shots) await page.screenshot({ path: join(shots, `${scene.id}-${String(i + 1)}.jpg`), type: 'jpeg', quality: 70 })
      await tapAt(vw / 2, vh / 2)
      n++
    }
  }
  await page.waitForSelector('#tutorial', { state: 'detached', timeout: 5000 })
  const discards1 = await page.evaluate(() => window.__mj.game()?.round.players.map((p) => p.discards.length).join())
  if (discards0 !== discards1) fail(`a tutorial tap played a move: ${String(discards0)} -> ${String(discards1)}`)
  if (await page.evaluate(() => window.__mj.game()?.isPaused())) fail('game still paused after the tutorial')
  const ms = Date.now() - t0
  if (ms > 60_000) fail(`took ${String(ms)} ms`)
  process.stdout.write(`PASS tutorial ${touch ? 'phone' : 'desk'}: ${String(SCENES.length)} scenes, ${String(n)} steps in ${String(ms)} ms\n`)
} finally {
  await h.close()
}
