import { join } from 'node:path'
import { harness, SHOTS } from './e2e_lib.ts'

// Menu screen (kuhy 2026-11-21): ✎ must work before a game starts. Freeze the
// menu, pick the East button, ask about it (stub claude), get an answer; the
// mode buttons must also carry a non-text cue (pips for 4 and 8 rounds).
const h = await harness({ width: 1280, height: 800 })
const { page } = h
try {
  await page.goto(`${h.base}/`)
  await page.waitForSelector('button.mode')
  await page.click('#t-mark')
  await page.waitForSelector('#mark-tools', { timeout: 3000 })
  const btn = await page.locator('[data-entity="button:east"]').boundingBox()
  if (!btn) throw new Error('no east button')
  await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2)
  const chip = await page.locator('#chips .chip').first().textContent()
  if (!chip?.includes('East')) throw new Error(`picked label missing: ${String(chip)}`)
  await page.fill('#q', 'What is this button?')
  await page.click('#send')
  await page.waitForSelector('#thread .turn.assistant:not(.waiting)', { timeout: 15_000 })
  const pips = await page.locator('button.mode .pips i').evaluateAll((els) => els.length)
  if (pips !== 12) throw new Error(`expected 4+8 pips, got ${String(pips)}`)
  await page.screenshot({ path: join(SHOTS, 'menu-mark.png') })
  process.stdout.write('PASS menu marking\n')
} finally {
  await h.close()
}
