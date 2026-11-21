import { describe, expect, it } from 'vitest'
import { parseTiles } from '../../src/engine/tiles.ts'
import { scoreWin } from '../../src/engine/score.ts'
import type { WinInput } from '../../src/engine/types.ts'

// Expected values are the standard Riichi score table (DOCS-design.md, source
// rows S1-S8): base = fu * 2^(han+2), non-dealer ron = 4 * base rounded up to 100.
function win(hand: string, winTile: string, extra: Partial<WinInput> = {}): ReturnType<typeof scoreWin> {
  return scoreWin({
    concealed: parseTiles(hand),
    melds: [],
    winTile: parseTiles(winTile)[0] ?? -1,
    tsumo: false,
    seatWind: 28,
    roundWind: 27,
    dealer: false,
    riichi: false,
    doubleRiichi: false,
    ippatsu: false,
    haitei: false,
    houtei: false,
    rinshan: false,
    chankan: false,
    tenhou: false,
    chiihou: false,
    doraIndicators: [],
    uraIndicators: [],
    ...extra,
  })
}

describe('scoreWin', () => {
  it('S1 riichi tsumo pinfu tanyao, non-dealer: 4 han 20 fu = 1300/2600', () => {
    const r = win('234m567m234p678s55s', '4m', { tsumo: true, riichi: true })
    expect(r?.han).toBe(4)
    expect(r?.fu).toBe(20)
    expect(r?.payments).toEqual({ dealer: 2600, other: 1300 })
    expect(r?.yaku.map((y) => y.id).sort()).toEqual(['menzen_tsumo', 'pinfu', 'riichi', 'tanyao'])
  })

  it('S2 chiitoitsu tanyao ron: 3 han 25 fu = 3200', () => {
    const r = win('22m44m66m33p55p77s88s', '8s')
    expect(r?.han).toBe(3)
    expect(r?.fu).toBe(25)
    expect(r?.ron).toBe(3200)
  })

  it('S3 riichi ron, kanchan + closed terminal triplet: 1 han 40 fu = 1300', () => {
    const r = win('123m456m789p999s22p', '5m', { riichi: true })
    expect(r?.fu).toBe(40)
    expect(r?.han).toBe(1)
    expect(r?.ron).toBe(1300)
  })

  it('S4 open tanyao ron with no fu is rounded to 30 fu: 1000', () => {
    const r = win('234m567p66s888s', '8s', {
      melds: [{ kind: 'chi', tiles: parseTiles('345s'), from: 3 }],
    })
    expect(r?.han).toBe(1)
    expect(r?.fu).toBe(30)
    expect(r?.ron).toBe(1000)
  })

  it('S5 dealer 30 fu 4 han ron = 11600', () => {
    // pinfu 1 + tanyao 1 + sanshoku (closed) 2 = 4 han; pinfu ron = 30 fu
    const r = win('234m234p234s678s55m', '8s', { dealer: true, seatWind: 27 })
    expect(r?.han).toBe(4)
    expect(r?.fu).toBe(30)
    expect(r?.ron).toBe(11600)
  })

  it('S6 kokushi musou is yakuman: 32000', () => {
    const r = win('19m19p19s1234567z1m', '7z')
    expect(r?.limit).toBe('yakuman')
    expect(r?.ron).toBe(32000)
  })

  it('S7 no yaku is not a win', () => {
    expect(win('123m456m789p999s22p', '5m')).toBeNull()
  })

  it('S8 haku pon + honitsu open: mangan cap at 5 han', () => {
    const r = win('123m456m789m11m', '1m', {
      melds: [{ kind: 'pon', tiles: parseTiles('555z'), from: 1 }],
      doraIndicators: parseTiles('8m'),
    })
    // honitsu open 2 + ittsu open 1 + haku 1 + dora(9m) 1 = 5 han -> mangan 8000
    expect(r?.han).toBe(5)
    expect(r?.limit).toBe('mangan')
    expect(r?.ron).toBe(8000)
  })
})
