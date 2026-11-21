import { isComplete, waitsOf } from './decompose.ts'
import { Rng } from './rng.ts'
import type { ActAction, ActOptions, PlayerState, RoundParams, RoundState } from './round_types.ts'
import { scoreWin } from './score.ts'
import { settleDraw, settleWin } from './settle.ts'
import { COPIES, KINDS, sortKinds } from './tiles.ts'
import type { WinInput } from './types.ts'

export { applyClaims, claimOptions } from './claims.ts'

const emptyPlayer = (): PlayerState => ({
  hand: [], melds: [], discards: [], riichi: false, doubleRiichi: false, ippatsu: false, permFuriten: false, tempFuriten: false,
})

/** Shuffle a fresh 136-tile wall from the seed, deal 13 each and let the dealer draw. */
export function newRound(p: RoundParams): RoundState {
  const rng = new Rng(p.seed)
  const tiles = rng.shuffle(Array.from({ length: KINDS * COPIES }, (_, i) => Math.floor(i / COPIES)))
  const dead = tiles.splice(tiles.length - 14, 14)
  const s: RoundState = {
    ...p, scores: [...p.scores], wall: tiles, dead, doraCount: 1, rinshanUsed: 0,
    players: [0, 1, 2, 3].map(emptyPlayer), turn: p.dealer, phase: 'act', drawn: null, lastDiscard: null,
    afterKan: false, firstGoAround: true, discardCount: 0, kuikae: [], pendingRiichi: false, result: null, events: [],
  }
  for (let i = 0; i < 13; i++) for (let k = 0; k < 4; k++) s.players[(p.dealer + k) % 4]?.hand.push(s.wall.pop() ?? 0)
  for (const pl of s.players) sortKinds(pl.hand)
  drawTile(s)
  return s
}

export const seatWindOf = (s: RoundState, seat: number): number => 27 + ((seat - s.dealer + 4) % 4)
export const doraIndicators = (s: RoundState): number[] => s.dead.slice(0, s.doraCount)
export const player = (s: RoundState, seat: number): PlayerState => {
  const pl = s.players[seat]
  if (!pl) throw new Error(`no seat ${String(seat)}`)
  return pl
}

export function drawTile(s: RoundState): void {
  const pl = player(s, s.turn)
  const rinshan = s.afterKan
  const tile = rinshan ? s.dead[10 + s.rinshanUsed++] : s.wall.pop()
  if (tile === undefined) throw new Error('draw from empty wall')
  pl.hand.push(tile)
  sortKinds(pl.hand)
  s.drawn = tile
  s.phase = 'act'
  s.events.push({ t: 'draw', seat: s.turn, rinshan })
}

export const isClosed = (pl: PlayerState): boolean => pl.melds.every((m) => m.kind === 'ankan')

/** Engine view of a would-be win, shared by tsumo, ron and the question context. */
export function winInput(s: RoundState, seat: number, winTile: number, tsumo: boolean): WinInput {
  const pl = player(s, seat)
  const concealed = tsumo ? [...pl.hand] : sortKinds([...pl.hand, winTile])
  const noCalls = s.firstGoAround && pl.discards.length === 0
  return {
    concealed, melds: pl.melds, winTile, tsumo, seatWind: seatWindOf(s, seat), roundWind: s.roundWind,
    dealer: seat === s.dealer, riichi: pl.riichi, doubleRiichi: pl.doubleRiichi, ippatsu: pl.ippatsu,
    haitei: tsumo && s.wall.length === 0 && !s.afterKan, houtei: !tsumo && s.wall.length === 0,
    rinshan: tsumo && s.afterKan, chankan: false,
    tenhou: tsumo && noCalls && seat === s.dealer, chiihou: tsumo && noCalls && seat !== s.dealer,
    doraIndicators: doraIndicators(s), uraIndicators: s.dead.slice(5, 5 + s.doraCount),
  }
}

/** Kinds that keep a 14-tile closed hand tenpai when discarded. */
export function tenpaiDiscards(pl: PlayerState): number[] {
  const out = new Set<number>()
  for (const k of new Set(pl.hand)) {
    const rest = [...pl.hand]
    rest.splice(rest.indexOf(k), 1)
    if (waitsOf(rest, pl.melds.length).length > 0) out.add(k)
  }
  return [...out]
}

const totalKans = (s: RoundState): number =>
  s.players.reduce((a, p) => a + p.melds.filter((m) => m.kind.endsWith('kan')).length, 0)

export function actOptions(s: RoundState): ActOptions {
  const pl = player(s, s.turn)
  const kinds = [...new Set(pl.hand)]
  const canKan = s.drawn !== null && s.wall.length > 0 && totalKans(s) < 4 && !pl.riichi
  const tsumo = s.drawn !== null && isComplete(pl.hand, pl.melds.length) && scoreWin(winInput(s, s.turn, s.drawn, true)) !== null
  if (pl.riichi && s.drawn !== null) return { discards: [s.drawn], riichi: [], tsumo, ankan: [], shouminkan: [] }
  const canRiichi = !pl.riichi && isClosed(pl) && (s.scores[s.turn] ?? 0) >= 1000 && s.wall.length >= 4 && s.drawn !== null
  return {
    discards: kinds.filter((k) => !s.kuikae.includes(k)),
    riichi: canRiichi ? tenpaiDiscards(pl) : [],
    tsumo,
    ankan: canKan ? kinds.filter((k) => pl.hand.filter((t) => t === k).length === 4) : [],
    shouminkan: canKan ? pl.melds.filter((m) => m.kind === 'pon' && pl.hand.includes(m.tiles[0] ?? -1)).map((m) => m.tiles[0] ?? -1) : [],
  }
}

function removeTiles(pl: PlayerState, tile: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const at = pl.hand.indexOf(tile)
    if (at < 0) throw new Error(`tile ${String(tile)} not in hand`)
    pl.hand.splice(at, 1)
  }
}

export function breakIppatsu(s: RoundState): void {
  for (const pl of s.players) pl.ippatsu = false
  s.firstGoAround = false
}

export function kanDone(s: RoundState): void {
  s.doraCount = Math.min(5, s.doraCount + 1)
  s.events.push({ t: 'dora', indicator: s.dead[s.doraCount - 1] ?? 0 })
  s.wall.shift()
  breakIppatsu(s)
  s.afterKan = true
  drawTile(s)
}

/** Apply the turn player's action; throws on an illegal one so bugs surface. */
export function applyAct(s: RoundState, a: ActAction): void {
  if (s.phase !== 'act') throw new Error(`act in phase ${s.phase}`)
  const opts = actOptions(s)
  const pl = player(s, s.turn)
  if (a.type === 'tsumo') {
    if (!opts.tsumo || s.drawn === null) throw new Error('illegal tsumo')
    settleWin(s, s.turn, s.turn, true, winInput(s, s.turn, s.drawn, true))
    return
  }
  if (a.type === 'ankan') {
    if (!opts.ankan.includes(a.tile)) throw new Error('illegal ankan')
    removeTiles(pl, a.tile, 4)
    pl.melds.push({ kind: 'ankan', tiles: [a.tile, a.tile, a.tile, a.tile], from: s.turn })
    s.events.push({ t: 'call', seat: s.turn, kind: 'ankan', tile: a.tile, from: s.turn })
    kanDone(s)
    return
  }
  if (a.type === 'shouminkan') {
    const meld = pl.melds.find((m) => m.kind === 'pon' && m.tiles[0] === a.tile)
    if (!opts.shouminkan.includes(a.tile) || !meld) throw new Error('illegal shouminkan')
    removeTiles(pl, a.tile, 1)
    meld.kind = 'shouminkan'
    meld.tiles.push(a.tile)
    s.events.push({ t: 'call', seat: s.turn, kind: 'shouminkan', tile: a.tile, from: meld.from })
    kanDone(s)
    return
  }
  const riichi = a.riichi === true
  if (riichi ? !opts.riichi.includes(a.tile) : !opts.discards.includes(a.tile)) throw new Error(`illegal discard ${String(a.tile)}`)
  removeTiles(pl, a.tile, 1)
  if (riichi) {
    pl.riichi = true
    pl.doubleRiichi = s.firstGoAround && pl.discards.length === 0
    s.pendingRiichi = true
  } else if (pl.ippatsu) pl.ippatsu = false
  pl.tempFuriten = false
  pl.discards.push({ tile: a.tile, riichi, called: false, tsumogiri: a.tile === s.drawn })
  s.events.push({ t: 'discard', seat: s.turn, tile: a.tile, riichi })
  s.lastDiscard = { seat: s.turn, tile: a.tile }
  s.discardCount++
  if (s.discardCount > 4) s.firstGoAround = false
  s.drawn = null
  s.kuikae = []
  s.afterKan = false
  s.phase = 'claim'
}

export function endByExhaustion(s: RoundState): void {
  settleDraw(s)
}
