import type { MatchState } from '../../engine/match.ts'
import { doraIndicators, seatWindOf } from '../../engine/round.ts'
import type { PlayerState, RoundState } from '../../engine/round_types.ts'
import { tileName } from '../../engine/tiles.ts'
import type { Meld } from '../../engine/types.ts'
import { P } from './palette.ts'
import { TH, TW, backSvg, tileSvg } from './tile.ts'

// The whole table is one 1000x1000 SVG. Every seat is drawn in the "bottom"
// frame and rotated, so seat 1 (right), 2 (top) and 3 (left) reuse one layout.
// Every pickable thing carries data-entity + data-label for the marking tool.

export const VIEW = 1000
const WINDS = ['東', '南', '西', '北']
const SEAT_NAMES = ['you', 'right player (shimocha)', 'opposite player (toimen)', 'left player (kamicha)']

export interface ViewHints {
  /** Hand kinds the human may discard now. */
  playable: number[]
  /** Hand kinds that keep tenpai for riichi (while choosing a riichi discard). */
  riichiChoices: number[] | null
}

const text = (x: number, y: number, s: string, size: number, fill: string, extra = ''): string =>
  `<text x="${String(x)}" y="${String(y)}" font-size="${String(size)}" fill="${fill}" text-anchor="middle" font-family="'Noto Serif CJK JP','WenQuanYi Zen Hei',serif" ${extra}>${s}</text>`

function pond(pl: PlayerState, seat: number, s: RoundState): string {
  const sc = 0.6
  const out: string[] = []
  pl.discards.forEach((d, i) => {
    const row = Math.min(3, Math.floor(i / 6))
    const col = row === 3 ? i - 18 : i % 6
    const x = 389 + col * (TW * sc + 1)
    const y = 640 + row * (TH * sc + 4)
    const last = s.lastDiscard?.seat === seat && i === pl.discards.length - 1
    out.push(tileSvg(d.tile, {
      x: d.riichi ? x + 6 : x, y, scale: sc, rotate: d.riichi ? 90 : 0,
      entity: `discard:${String(seat)}:${String(i)}`,
      label: `${tileName(d.tile)}, discard #${String(i + 1)} of ${SEAT_NAMES[seat] ?? ''}${d.riichi ? ' (riichi declaration tile)' : ''}${d.called ? ' (called by another player)' : ''}`,
      extraClass: `${d.called ? 'called' : ''}${last ? ' last' : ''}`,
    }))
  })
  return out.join('')
}

function meldSvg(m: Meld, x: number, y: number, sc: number, seat: number, i: number): { svg: string; w: number } {
  const parts: string[] = []
  let cx = 0
  m.tiles.forEach((t, j) => {
    const face = m.kind === 'ankan' && (j === 0 || j === 3)
    parts.push(face ? backSvg({ x: x + cx, y, scale: sc }) : tileSvg(t, { x: x + cx, y, scale: sc }))
    cx += TW * sc + 1
  })
  const names = m.tiles.map(tileName).join(', ')
  return {
    svg: `<g data-entity="meld:${String(seat)}:${String(i)}" data-label="${m.kind} meld of ${SEAT_NAMES[seat] ?? ''}: ${names}">${parts.join('')}</g>`,
    w: cx + 8,
  }
}

function humanRow(pl: PlayerState, s: RoundState, hints: ViewHints): string {
  const sc = 0.95
  const out: string[] = []
  const drawn = s.turn === 0 && s.phase === 'act' ? s.drawn : null
  const hand = [...pl.hand]
  if (drawn !== null) hand.splice(hand.indexOf(drawn), 1)
  const tiles = drawn === null ? hand : [...hand, drawn]
  tiles.forEach((k, i) => {
    const gap = drawn !== null && i === tiles.length - 1 ? 14 : 0
    const ok = hints.riichiChoices ? hints.riichiChoices.includes(k) : hints.playable.includes(k)
    out.push(tileSvg(k, {
      x: 16 + i * (TW * sc + 2) + gap, y: 900, scale: sc,
      entity: `hand:0:${String(i)}`, label: `${tileName(k)} in your hand${gap > 0 ? ' (just drawn)' : ''}`,
      extraClass: `hand${ok ? ' playable' : ''}${hints.riichiChoices && ok ? ' riichi-ok' : ''}`,
    }).replace('<g ', `<g data-kind="${String(k)}" `))
  })
  let mx = 984
  pl.melds.forEach((m, i) => {
    const r = meldSvg(m, 0, 0, 0.6, 0, i)
    mx -= r.w
    out.push(meldSvg(m, mx, 836, 0.6, 0, i).svg)
  })
  return out.join('')
}

function opponentRow(pl: PlayerState, seat: number): string {
  const sc = 0.45
  const w = TW * sc + 1
  const meldW = pl.melds.reduce((a, m) => a + m.tiles.length * w + 8, 0)
  let x = 500 - (pl.hand.length * w + 10 + meldW) / 2
  const out: string[] = [`<g data-entity="hand:${String(seat)}" data-label="concealed hand of ${SEAT_NAMES[seat] ?? ''} (${String(pl.hand.length)} tiles)">`]
  for (let i = 0; i < pl.hand.length; i++) out.push(backSvg({ x: x + i * w, y: 930, scale: sc }))
  out.push('</g>')
  x += pl.hand.length * w + 10
  pl.melds.forEach((m, i) => {
    const r = meldSvg(m, x, 930, sc, seat, i)
    out.push(r.svg)
    x += r.w
  })
  return out.join('')
}

function seatInfo(s: RoundState, seat: number): string {
  const pl = s.players[seat]
  const wind = seatWindOf(s, seat) - 27
  const dealer = seat === s.dealer
  const stick = pl?.riichi
    ? `<g data-entity="riichi:${String(seat)}" data-label="riichi stick of ${SEAT_NAMES[seat] ?? ''}"><rect x="440" y="574" width="120" height="9" rx="4" fill="${P.ivory}"/><circle cx="500" cy="578.5" r="3.5" fill="${P.red}"/></g>`
    : ''
  return `<g data-entity="score:${String(seat)}" data-label="score and seat wind of ${SEAT_NAMES[seat] ?? ''}: ${String(s.scores[seat] ?? 0)} points, ${['East', 'South', 'West', 'North'][wind] ?? ''} seat${dealer ? ' (dealer)' : ''}">` +
    text(430, 612, WINDS[wind] ?? '', 22, dealer ? P.gold : P.text) +
    text(520, 612, String(s.scores[seat] ?? 0), 20, s.turn === seat ? P.gold : P.text, 'font-family="sans-serif"') +
    `</g>${stick}`
}

function center(m: MatchState): string {
  const s = m.round
  const ind = doraIndicators(s)
  const dora: string[] = []
  for (let i = 0; i < 5; i++) {
    const k = ind[i]
    dora.push(k === undefined ? backSvg({ x: 425 + i * 31, y: 470, scale: 0.5 }) : tileSvg(k, { x: 425 + i * 31, y: 470, scale: 0.5 }))
  }
  return `<rect x="385" y="385" width="230" height="230" rx="14" fill="${P.feltDark}"/>` +
    `<g data-entity="round" data-label="round ${WINDS[s.roundWind - 27] ?? ''}${String(s.dealer + 1)}, ${String(s.honba)} honba, ${String(s.sticks)} riichi sticks on the table">` +
    text(500, 440, `${WINDS[s.roundWind - 27] ?? ''}${String(s.dealer + 1)}`, 36, P.text) +
    text(500, 462, `${'▮'.repeat(Math.min(s.honba, 5))}${s.sticks > 0 ? ` ${'●'.repeat(Math.min(s.sticks, 5))}` : ''}`, 12, P.muted) + `</g>` +
    `<g data-entity="dora" data-label="dora indicators: ${ind.map(tileName).join(', ')} (the dora is the next tile in order)">${dora.join('')}</g>` +
    `<g data-entity="wall" data-label="tiles left in the live wall: ${String(s.wall.length)}">` +
    text(500, 538, String(s.wall.length), 22, P.gold, 'font-family="sans-serif"') + `</g>`
}

/** Full table markup for the current match state. */
export function tableSvg(m: MatchState, hints: ViewHints): string {
  const s = m.round
  const seats = [0, 1, 2, 3].map((seat) => {
    const pl = s.players[seat]
    if (!pl) return ''
    const body = pond(pl, seat, s) + seatInfo(s, seat) + (seat === 0 ? humanRow(pl, s, hints) : opponentRow(pl, seat))
    const rot = [0, -90, 180, 90][seat] ?? 0
    return `<g transform="rotate(${String(rot)} 500 500)">${body}</g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" id="table" viewBox="0 0 ${String(VIEW)} ${String(VIEW)}" preserveAspectRatio="xMidYMid meet">` +
    `<rect width="${String(VIEW)}" height="${String(VIEW)}" fill="${P.felt}"/>` + center(m) + seats.join('') + `</svg>`
}
