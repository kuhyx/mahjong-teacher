import { join } from 'node:path'
import { harness, SHOTS } from './e2e_lib.ts'

// Portrait phone (412x915, touch): in marking mode every hand tile must stay
// visible above the question drawer, and the tool strip must not overlap the
// top-right game buttons. Found on the Pixel 2026-11-21: the drawer hid the
// hand and the strip's T sat on top of ✎ and the mute toggle.
const h = await harness({ width: 412, height: 915 }, true)
const { page } = h
type Box = { x: number; y: number; width: number; height: number }
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
try {
  await page.goto(`${h.base}/?agent=1&len=east&seed=1`)
  await page.waitForSelector('[data-entity^="tile:"]')
  await page.tap('#t-mark')
  await page.waitForSelector('#chat')
  const chat = await page.locator('#chat').boundingBox()
  const hand = await page.locator('#hand-wrap').boundingBox()
  if (!chat || !hand) throw new Error('no chat or hand box')
  const problems: string[] = []
  if (hand.y + hand.height > chat.y + 1) problems.push(`hand bottom ${String(Math.round(hand.y + hand.height))} below drawer top ${String(Math.round(chat.y))}`)
  const tools = await page.locator('#mark-tools button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box))
  const game = await page.locator('#tools button').evaluateAll((els) =>
    els.filter((e) => getComputedStyle(e).visibility !== 'hidden' && (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().toJSON() as Box))
  if (tools.some((t) => game.some((g) => overlaps(t, g)))) problems.push('tool strip overlaps the game buttons')
  if (tools.some((t) => t.x + t.width > 412 || t.y < 0)) problems.push('tool strip off screen')
  await page.screenshot({ path: join(SHOTS, 'phone-mark.png') })
  if (problems.length > 0) throw new Error(problems.join('; '))
  process.stdout.write('PASS phone marking layout\n')
} finally {
  await h.close()
}
