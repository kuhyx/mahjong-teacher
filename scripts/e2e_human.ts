import { join } from 'node:path'
import { harness, SHOTS } from './e2e_lib.ts'

// Plays seat 0 through the real UI (clicks, or taps with --touch): discards via
// the hand, answers calls via the action buttons, advances hand results. Every
// offered button must be legal; the game must reach the end screen.
const touch = process.argv.includes('--touch')
const h = await harness(touch ? { width: 412, height: 915 } : { width: 1280, height: 800 }, touch)
const { page } = h
const t0 = Date.now()
const seen = new Set<string>()
try {
  await page.goto(`${h.base}/?len=east&seed=9&delay=0`)
  while (Date.now() - t0 < 50_000) {
    const screen = await page.evaluate(() => document.body.dataset['screen'])
    if (screen === 'end') break
    const acts = await page.locator('[data-act]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['act'] ?? ''))
    for (const a of acts) seen.add(a.split(':')[0] ?? '')
    const pref = ['tsumo', 'ron', 'next', 'pon', 'riichi'].map((p) => acts.find((a) => a.startsWith(p))).find(Boolean) ?? acts.find((a) => a === 'pass')
    const hint = await page.evaluate(() => window.__mj.game()?.hint() ?? null)
    const kind = hint?.type === 'discard' ? `[data-kind="${String(hint.tile)}"]` : ''
    const riichiPick = page.locator('g.riichi-ok')
    const target = (await riichiPick.count()) > 0 ? riichiPick : pref ? page.locator(`[data-act="${pref}"]`) : page.locator(`g.playable${kind}`).last()
    if ((await target.count()) === 0) {
      await page.waitForTimeout(20)
      continue
    }
    if (touch) await target.first().tap()
    else await target.first().click()
  }
  const end = await page.evaluate(() => document.body.dataset['screen'])
  await page.screenshot({ path: join(SHOTS, `human-end${touch ? '-touch' : ''}.png`) })
  if (end !== 'end') throw new Error('end screen not reached')
  process.stdout.write(`PASS human${touch ? ' touch' : ''} in ${String(Date.now() - t0)} ms; buttons seen: ${[...seen].sort().join(',')}\n`)
} finally {
  await h.close()
}
