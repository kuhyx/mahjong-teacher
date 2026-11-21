import { harness } from './e2e_lib.ts'

// Opening the page starts a full hanchan straight away: no menu, no mode
// buttons (kuhy 2026-11-21). `?len=east` stays as the short test mode.
const h = await harness({ width: 1280, height: 800 })
const { page } = h
try {
  await page.goto(`${h.base}/?seed=5`)
  await page.waitForSelector('g.playable', { timeout: 5000 })
  if ((await page.locator('button.mode').count()) > 0) throw new Error('menu buttons still present')
  const len = await page.evaluate(() => window.__mj.game()?.opts.length)
  if (len !== 'hanchan') throw new Error(`length is ${String(len)}, want hanchan`)
  await page.goto(`${h.base}/?seed=5&len=east`)
  await page.waitForSelector('g.playable', { timeout: 5000 })
  const east = await page.evaluate(() => window.__mj.game()?.opts.length)
  if (east !== 'east') throw new Error('?len=east lost')
  process.stdout.write('PASS straight into hanchan\n')
} finally {
  await h.close()
}
