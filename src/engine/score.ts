import { shapesOf, shapeTiles, type Shape } from './shape.ts'
import { doraFromIndicator, isDragon, isYaochu } from './tiles.ts'
import type { FuPart, Limit, WinInput, WinScore } from './types.ts'
import { yakuOf } from './yaku.ts'

// Fu and point rules: DOCS-design.md rows F1-F8 and P1-P4.

const ceil100 = (n: number): number => Math.ceil(n / 100) * 100

function fuOf(s: Shape, input: WinInput, pinfu: boolean): FuPart[] {
  if (s.form === 'chiitoi') return [{ why: 'chiitoitsu (fixed)', fu: 25 }]
  if (s.form === 'kokushi') return [{ why: 'yakuman (fu unused)', fu: 30 }]
  if (pinfu) return input.tsumo ? [{ why: 'pinfu tsumo (fixed)', fu: 20 }] : [{ why: 'base', fu: 20 }, { why: 'closed ron', fu: 10 }]
  const parts: FuPart[] = [{ why: 'base', fu: 20 }]
  if (s.closed && !input.tsumo) parts.push({ why: 'closed ron', fu: 10 })
  if (input.tsumo) parts.push({ why: 'tsumo', fu: 2 })
  for (const g of s.groups) {
    if (g.type === 'seq') continue
    let fu = 2
    if (isYaochu(g.start)) fu *= 2
    if (!g.open) fu *= 2
    if (g.type === 'kan') fu *= 4
    const label = `${g.open ? 'open' : 'concealed'} ${g.type === 'kan' ? 'kan' : 'triplet'}${isYaochu(g.start) ? ' (terminal/honour)' : ''}`
    parts.push({ why: label, fu })
  }
  let pairFu = 0
  if (isDragon(s.pair)) pairFu += 2
  if (s.pair === input.seatWind) pairFu += 2
  if (s.pair === input.roundWind) pairFu += 2
  if (pairFu > 0) parts.push({ why: 'value pair', fu: pairFu })
  if (s.wait === 'kanchan' || s.wait === 'penchan' || s.wait === 'tanki') parts.push({ why: `${s.wait} wait`, fu: 2 })
  return parts
}

function roundFu(parts: FuPart[], s: Shape): number {
  const raw = parts.reduce((a, p) => a + p.fu, 0)
  if (s.form === 'chiitoi') return 25
  const fu = Math.ceil(raw / 10) * 10
  return !s.closed && fu === 20 ? 30 : fu
}

export function limitOf(han: number, fu: number, yakuman: number): { limit: Limit; base: number } {
  if (yakuman > 0) return { limit: 'yakuman', base: 8000 * yakuman }
  if (han >= 13) return { limit: 'yakuman', base: 8000 }
  if (han >= 11) return { limit: 'sanbaiman', base: 6000 }
  if (han >= 8) return { limit: 'baiman', base: 4000 }
  if (han >= 6) return { limit: 'haneman', base: 3000 }
  const base = fu * 2 ** (han + 2)
  if (han >= 5 || base >= 2000) return { limit: 'mangan', base: 2000 }
  return { limit: 'none', base }
}

function countDora(tiles: number[], indicators: number[]): number {
  const dora = indicators.map(doraFromIndicator)
  return tiles.reduce((a, t) => a + dora.filter((d) => d === t).length, 0)
}

function scoreShape(s: Shape, input: WinInput): WinScore | null {
  const yaku = yakuOf(s, input)
  if (yaku.length === 0) return null
  const yakuman = yaku.reduce((a, y) => a + y.yakuman, 0)
  const tiles = shapeTiles(s, input)
  const dora = yakuman > 0 ? 0 : countDora(tiles, input.doraIndicators)
  const ura = yakuman > 0 || !input.riichi ? 0 : countDora(tiles, input.uraIndicators)
  const han = yaku.reduce((a, y) => a + y.han, 0) + dora + ura
  const parts = fuOf(s, input, yaku.some((y) => y.id === 'pinfu'))
  const fu = roundFu(parts, s)
  const { limit, base } = limitOf(han, fu, yakuman)
  const ron = ceil100(base * (input.dealer ? 6 : 4))
  const payments = input.dealer
    ? { dealer: ceil100(base * 2), other: ceil100(base * 2) }
    : { dealer: ceil100(base * 2), other: ceil100(base) }
  return { yaku, han, fu, fuParts: parts, dora, ura, limit, base, ron, payments, wait: s.wait }
}

/** Best-scoring legal reading of a win, or null when no reading has a yaku. */
export function scoreWin(input: WinInput): WinScore | null {
  let best: WinScore | null = null
  for (const s of shapesOf(input)) {
    const r = scoreShape(s, input)
    if (r && (!best || r.base > best.base || (r.base === best.base && r.han > best.han))) best = r
  }
  return best
}
