import { waitsOf } from './decompose.ts'
import { breakIppatsu, drawTile, kanDone, player, winInput } from './round.ts'
import type { ClaimAction, ClaimOptions, RoundState } from './round_types.ts'
import { scoreWin } from './score.ts'
import { settleDraw, settleWin } from './settle.ts'
import { sortKinds } from './tiles.ts'

const NONE: ClaimOptions = { ron: false, pon: false, minkan: false, chi: [] }

/** True when one of the player's waits sits in their own discards, or they passed a win. */
export function isFuriten(s: RoundState, seat: number): boolean {
  const pl = player(s, seat)
  if (pl.permFuriten || pl.tempFuriten) return true
  const waits = waitsOf(pl.hand, pl.melds.length)
  return pl.discards.some((d) => waits.includes(d.tile))
}

function canRon(s: RoundState, seat: number, tile: number): boolean {
  const pl = player(s, seat)
  if (!waitsOf(pl.hand, pl.melds.length).includes(tile) || isFuriten(s, seat)) return false
  return scoreWin(winInput(s, seat, tile, false)) !== null
}

function chiPairs(hand: number[], tile: number): [number, number][] {
  if (tile >= 27) return []
  const r = tile % 9
  const out: [number, number][] = []
  const has = (k: number): boolean => hand.includes(k)
  if (r >= 2 && has(tile - 2) && has(tile - 1)) out.push([tile - 2, tile - 1])
  if (r >= 1 && r <= 7 && has(tile - 1) && has(tile + 1)) out.push([tile - 1, tile + 1])
  if (r <= 6 && has(tile + 1) && has(tile + 2)) out.push([tile + 1, tile + 2])
  return out
}

export function claimOptions(s: RoundState, seat: number): ClaimOptions {
  const d = s.lastDiscard
  if (s.phase !== 'claim' || !d || d.seat === seat) return NONE
  const pl = player(s, seat)
  const ron = canRon(s, seat, d.tile)
  if (s.wall.length === 0 || pl.riichi) return { ...NONE, ron }
  const n = pl.hand.filter((t) => t === d.tile).length
  const kans = s.players.reduce((a, p) => a + p.melds.filter((m) => m.kind.endsWith('kan')).length, 0)
  return {
    ron,
    pon: n >= 2,
    minkan: n >= 3 && kans < 4,
    chi: seat === (d.seat + 1) % 4 ? chiPairs(pl.hand, d.tile) : [],
  }
}

function takeFrom(s: RoundState, seat: number, tiles: number[]): void {
  const pl = player(s, seat)
  for (const t of tiles) pl.hand.splice(pl.hand.indexOf(t), 1)
}

/** Resolve the claim window: ron (head bump) beats pon/kan, which beat chi. */
export function applyClaims(s: RoundState, decisions: Partial<Record<number, ClaimAction>>): void {
  const d = s.lastDiscard
  if (s.phase !== 'claim' || !d) throw new Error('no claim window')
  const order = [1, 2, 3].map((i) => (d.seat + i) % 4)
  const options = new Map(order.map((seat) => [seat, claimOptions(s, seat)]))
  const ronSeat = order.find((seat) => decisions[seat]?.type === 'ron' && options.get(seat)?.ron)
  if (ronSeat !== undefined) {
    settleWin(s, ronSeat, d.seat, false, winInput(s, ronSeat, d.tile, false))
    return
  }
  for (const seat of order) {
    const pl = player(s, seat)
    if (waitsOf(pl.hand, pl.melds.length).includes(d.tile)) {
      pl.tempFuriten = true
      if (pl.riichi) pl.permFuriten = true
    }
  }
  if (s.pendingRiichi) {
    s.scores[d.seat] = (s.scores[d.seat] ?? 0) - 1000
    s.sticks++
    player(s, d.seat).ippatsu = true
    s.pendingRiichi = false
  }
  const caller = order.find((seat) => {
    const a = decisions[seat]
    const o = options.get(seat)
    return (a?.type === 'pon' && o?.pon) || (a?.type === 'minkan' && o?.minkan)
  }) ?? order.find((seat) => {
    const a = decisions[seat]
    return a?.type === 'chi' && options.get(seat)?.chi.some((c) => c[0] === a.tiles[0] && c[1] === a.tiles[1])
  })
  const action = caller === undefined ? undefined : decisions[caller]
  if (caller === undefined || !action || action.type === 'pass' || action.type === 'ron') {
    if (s.wall.length === 0) settleDraw(s)
    else {
      s.turn = (d.seat + 1) % 4
      drawTile(s)
    }
    return
  }
  const own = action.type === 'chi' ? action.tiles : Array.from({ length: action.type === 'minkan' ? 3 : 2 }, () => d.tile)
  takeFrom(s, caller, own)
  const discarder = player(s, d.seat)
  const last = discarder.discards.at(-1)
  if (last) last.called = true
  player(s, caller).melds.push({ kind: action.type, tiles: sortKinds([...own, d.tile]), from: d.seat, called: d.tile })
  s.events.push({ t: 'call', seat: caller, kind: action.type, tile: d.tile, from: d.seat })
  breakIppatsu(s)
  s.turn = caller
  s.lastDiscard = null
  if (action.type === 'minkan') {
    kanDone(s)
    return
  }
  s.kuikae = [d.tile]
  if (action.type === 'chi') {
    const [a, b] = action.tiles
    if (b - a === 1 && d.tile === a - 1 && b % 9 < 8) s.kuikae.push(b + 1)
    if (b - a === 1 && d.tile === b + 1 && a % 9 > 0) s.kuikae.push(a - 1)
  }
  s.drawn = null
  s.phase = 'act'
}
