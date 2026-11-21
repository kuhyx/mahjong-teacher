import { shapeTiles, type HGroup, type Shape } from './shape.ts'
import { isDragon, isHonor, isSimple, isTerminal, isYaochu, suitOf, toCounts } from './tiles.ts'
import type { WinInput, YakuHit } from './types.ts'

// Han values follow the WRC/EMA-style Riichi reference (DOCS-design.md, Y1).
// [id, English gloss (Japanese), closed han, open han (0 = closed only)]
const TABLE: Record<string, [string, number, number]> = {
  riichi: ['Riichi (ready declaration)', 1, 0],
  double_riichi: ['Double riichi (riichi on the first turn)', 2, 0],
  ippatsu: ['Ippatsu (win within one turn of riichi)', 1, 0],
  menzen_tsumo: ['Menzen tsumo (self-draw with a closed hand)', 1, 0],
  pinfu: ['Pinfu (all sequences, no-fu hand)', 1, 0],
  tanyao: ['Tanyao (all simples 2-8)', 1, 1],
  iipeikou: ['Iipeikou (two identical sequences)', 1, 0],
  haku: ['Yakuhai: Haku (white dragon triplet)', 1, 1],
  hatsu: ['Yakuhai: Hatsu (green dragon triplet)', 1, 1],
  chun: ['Yakuhai: Chun (red dragon triplet)', 1, 1],
  seat_wind: ['Yakuhai: seat wind triplet', 1, 1],
  round_wind: ['Yakuhai: round wind triplet', 1, 1],
  haitei: ['Haitei (win on the last wall tile)', 1, 1],
  houtei: ['Houtei (win on the last discard)', 1, 1],
  rinshan: ['Rinshan kaihou (win on the kan replacement tile)', 1, 1],
  chankan: ['Chankan (robbing a kan)', 1, 1],
  chiitoitsu: ['Chiitoitsu (seven pairs)', 2, 0],
  sanshoku: ['Sanshoku doujun (same sequence in three suits)', 2, 1],
  ittsu: ['Ittsu (straight 1-9 in one suit)', 2, 1],
  chanta: ['Chanta (terminal or honour in every group)', 2, 1],
  junchan: ['Junchan (terminal in every group)', 3, 2],
  toitoi: ['Toitoi (all triplets)', 2, 2],
  sanankou: ['Sanankou (three concealed triplets)', 2, 2],
  sanshoku_doukou: ['Sanshoku doukou (same triplet in three suits)', 2, 2],
  sankantsu: ['Sankantsu (three kans)', 2, 2],
  honroutou: ['Honroutou (only terminals and honours)', 2, 2],
  shousangen: ['Shousangen (little three dragons)', 2, 2],
  honitsu: ['Honitsu (one suit plus honours)', 3, 2],
  ryanpeikou: ['Ryanpeikou (two pairs of identical sequences)', 3, 0],
  chinitsu: ['Chinitsu (one suit only)', 6, 5],
}

const YAKUMAN: Record<string, string> = {
  kokushi: 'Kokushi musou (thirteen orphans)',
  suuankou: 'Suuankou (four concealed triplets)',
  daisangen: 'Daisangen (big three dragons)',
  shousuushii: 'Shousuushii (little four winds)',
  daisuushii: 'Daisuushii (big four winds)',
  tsuuiisou: 'Tsuuiisou (all honours)',
  chinroutou: 'Chinroutou (all terminals)',
  ryuuiisou: 'Ryuuiisou (all green)',
  chuuren: 'Chuuren poutou (nine gates)',
  suukantsu: 'Suukantsu (four kans)',
  tenhou: 'Tenhou (dealer wins on the deal)',
  chiihou: 'Chiihou (non-dealer wins on the first draw)',
}

export function yakuName(id: string): string {
  return TABLE[id]?.[0] ?? YAKUMAN[id] ?? id
}

const GREEN = new Set([19, 20, 21, 23, 25, 32])
const groupTiles = (g: HGroup): number[] => (g.type === 'seq' ? [g.start, g.start + 1, g.start + 2] : [g.start])
const isTripLike = (g: HGroup): boolean => g.type !== 'seq'

function yakumanOf(s: Shape, input: WinInput, tiles: number[]): string[] {
  const hits: string[] = []
  if (s.form === 'kokushi') hits.push('kokushi')
  const trips = s.groups.filter(isTripLike)
  const concealedTrips = trips.filter((g) => !g.open).length
  if (s.form === 'standard' && concealedTrips === 4) hits.push('suuankou')
  const dragonTrips = trips.filter((g) => isDragon(g.start)).length
  if (dragonTrips === 3) hits.push('daisangen')
  const windTrips = trips.filter((g) => g.start >= 27 && g.start <= 30).length
  if (windTrips === 4) hits.push('daisuushii')
  else if (windTrips === 3 && s.pair >= 27 && s.pair <= 30) hits.push('shousuushii')
  if (tiles.every(isHonor)) hits.push('tsuuiisou')
  if (tiles.every(isTerminal)) hits.push('chinroutou')
  if (tiles.every((t) => GREEN.has(t))) hits.push('ryuuiisou')
  if (s.groups.filter((g) => g.type === 'kan').length === 4) hits.push('suukantsu')
  if (s.closed && input.melds.length === 0 && tiles.every((t) => suitOf(t) === suitOf(tiles[0] ?? 0)) && !isHonor(tiles[0] ?? 0)) {
    const c = toCounts(tiles.map((t) => t % 9))
    const need = [3, 1, 1, 1, 1, 1, 1, 1, 3]
    if (need.every((n, i) => (c[i] ?? 0) >= n)) hits.push('chuuren')
  }
  if (input.tenhou) hits.push('tenhou')
  if (input.chiihou) hits.push('chiihou')
  return hits
}

function regularOf(s: Shape, input: WinInput, tiles: number[]): string[] {
  const hits: string[] = []
  const seqs = s.groups.filter((g) => g.type === 'seq')
  const trips = s.groups.filter(isTripLike)
  const yakuhaiPair = isDragon(s.pair) || s.pair === input.seatWind || s.pair === input.roundWind
  if (input.doubleRiichi) hits.push('double_riichi')
  else if (input.riichi) hits.push('riichi')
  if (input.ippatsu) hits.push('ippatsu')
  if (s.closed && input.tsumo) hits.push('menzen_tsumo')
  if (s.closed && s.form === 'standard' && seqs.length === 4 && !yakuhaiPair && s.wait === 'ryanmen') hits.push('pinfu')
  if (tiles.every(isSimple)) hits.push('tanyao')
  if (s.form === 'chiitoi') hits.push('chiitoitsu')
  for (const g of trips) {
    if (g.start === 31) hits.push('haku')
    if (g.start === 32) hits.push('hatsu')
    if (g.start === 33) hits.push('chun')
    if (g.start === input.seatWind) hits.push('seat_wind')
    if (g.start === input.roundWind) hits.push('round_wind')
  }
  if (input.haitei) hits.push('haitei')
  if (input.houtei) hits.push('houtei')
  if (input.rinshan) hits.push('rinshan')
  if (input.chankan) hits.push('chankan')
  if (s.form === 'standard') {
    const seqKeys = seqs.map((g) => g.start)
    const dupes = seqKeys.filter((k, i) => seqKeys.indexOf(k) !== i)
    if (s.closed && dupes.length === 2) hits.push('ryanpeikou')
    else if (s.closed && dupes.length >= 1) hits.push('iipeikou')
    const has = (start: number): boolean => seqKeys.includes(start)
    if ([0, 1, 2, 3, 4, 5, 6].some((r) => has(r) && has(r + 9) && has(r + 18))) hits.push('sanshoku')
    if ([0, 9, 18].some((b) => has(b) && has(b + 3) && has(b + 6))) hits.push('ittsu')
    const tripKeys = trips.map((g) => g.start)
    if ([0, 1, 2, 3, 4, 5, 6, 7, 8].some((r) => [r, r + 9, r + 18].every((k) => tripKeys.includes(k)))) hits.push('sanshoku_doukou')
    if (trips.length === 4) hits.push('toitoi')
    if (trips.filter((g) => !g.open).length === 3) hits.push('sanankou')
    if (s.groups.filter((g) => g.type === 'kan').length === 3) hits.push('sankantsu')
    const allOutside = s.groups.every((g) => groupTiles(g).some(isYaochu)) && isYaochu(s.pair)
    const noHonor = tiles.every((t) => !isHonor(t))
    if (allOutside && seqs.length > 0) hits.push(noHonor ? 'junchan' : 'chanta')
    const dragonTrips = trips.filter((g) => isDragon(g.start)).length
    if (dragonTrips === 2 && isDragon(s.pair)) hits.push('shousangen')
  }
  if (tiles.every(isYaochu) && !tiles.every(isHonor)) hits.push('honroutou')
  const suits = new Set(tiles.filter((t) => !isHonor(t)).map(suitOf))
  if (suits.size === 1) hits.push(tiles.some(isHonor) ? 'honitsu' : 'chinitsu')
  return hits
}

/** Yaku of one shape. Yakuman, when present, replace every regular yaku. */
export function yakuOf(s: Shape, input: WinInput): YakuHit[] {
  const tiles = shapeTiles(s, input)
  const ym = yakumanOf(s, input, tiles)
  if (ym.length > 0) return ym.map((id) => ({ id, name: YAKUMAN[id] ?? id, han: 0, yakuman: 1 }))
  const out: YakuHit[] = []
  for (const id of regularOf(s, input, tiles)) {
    const row = TABLE[id]
    if (!row) continue
    const han = s.closed ? row[1] : row[2]
    if (han > 0) out.push({ id, name: row[0], han, yakuman: 0 })
  }
  return out
}
