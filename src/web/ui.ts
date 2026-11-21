import { placements } from '../engine/match.ts'
import { actOptions } from '../engine/round.ts'
import type { RoundResult } from '../engine/round_types.ts'
import type { Game } from './game.ts'
import { tileSvg } from './render/tile.ts'
import { SEAT_GLYPH, TERMS } from './strings.ts'

// HTML chrome around the SVG table: action buttons, round result, end screen.
// Buttons show the game's own terms (Pon, Riichi...) or a glyph; every one has
// an aria-label and a data-entity so the marking tool can pick it.

const mini = (k: number, scale = 0.5): string =>
  `<svg class="mini" viewBox="0 0 ${String(62 * scale)} ${String(84 * scale)}">${tileSvg(k, { x: 1, y: 1, scale })}</svg>`

function button(id: string, face: string, aria: string): string {
  return `<button class="act" data-act="${id}" data-entity="button:${id}" data-label="${aria} button" aria-label="${aria}">${face}</button>`
}

/** Buttons for whatever the human may do now; illegal actions are never shown. */
export function actionBar(g: Game): string {
  const p = g.prompt()
  if (!p || g.opts.autodrive) return ''
  const out: string[] = []
  if (p.kind === 'act') {
    const o = actOptions(g.round)
    if (o.tsumo) out.push(button('tsumo', TERMS.tsumo, 'Tsumo: declare a self-drawn win'))
    if (o.riichi.length > 0) out.push(button('riichi', TERMS.riichi, 'Riichi: declare ready, then pick the discard'))
    for (const k of o.ankan) out.push(button(`ankan:${String(k)}`, `${TERMS.kan}${mini(k)}`, 'Kan: closed quad'))
    for (const k of o.shouminkan) out.push(button(`shouminkan:${String(k)}`, `${TERMS.kan}${mini(k)}`, 'Kan: add to your pon'))
  } else {
    const o = p.options
    if (o.ron) out.push(button('ron', TERMS.ron, 'Ron: win on this discard'))
    if (o.minkan) out.push(button('minkan', TERMS.kan, 'Kan: call an open quad'))
    if (o.pon) out.push(button('pon', TERMS.pon, 'Pon: call a triplet'))
    for (const [a, b] of o.chi) out.push(button(`chi:${String(a)}:${String(b)}`, `${TERMS.chi}${mini(a)}${mini(b)}`, 'Chi: call a sequence'))
    out.push(button('pass', '✕', 'Pass'))
  }
  return out.join('')
}

function resultBody(r: RoundResult): string {
  if (r.type === 'draw') {
    const marks = r.tenpai.map((t, seat) => `<div class="seatres">${SEAT_GLYPH[seat] ?? ''} ${t ? '◎' : '✕'} <b>${signed(r.deltas[seat] ?? 0)}</b></div>`)
    return `<div class="big">${TERMS.ryuukyoku}</div><div class="seats">${marks.join('')}</div>`
  }
  const sc = r.score
  const hand = r.hand.map((k) => mini(k, 0.7)).join('')
  const yaku = (sc?.yaku ?? []).map((y) => `<li>${y.name}<span>${y.yakuman > 0 ? '★' : String(y.han)}</span></li>`)
  if (sc && sc.dora > 0) yaku.push(`<li>${TERMS.dora}<span>${String(sc.dora)}</span></li>`)
  if (sc && sc.ura > 0) yaku.push(`<li>${TERMS.ura}<span>${String(sc.ura)}</span></li>`)
  const seats = r.deltas.map((d, seat) => `<div class="seatres">${SEAT_GLYPH[seat] ?? ''} <b>${signed(d)}</b></div>`)
  return `<div class="big">${SEAT_GLYPH[r.winner] ?? ''} ${r.type === 'tsumo' ? TERMS.tsumo : TERMS.ron}</div>` +
    `<div class="hand">${hand}</div><ul class="yaku">${yaku.join('')}</ul>` +
    `<div class="hanfu" data-entity="hanfu" data-label="han and fu of this win">${String(sc?.han ?? 0)} han · ${String(sc?.fu ?? 0)} fu${sc && sc.limit !== 'none' ? ` · ${sc.limit}` : ''}</div>` +
    `<div class="seats">${seats.join('')}</div>`
}

const signed = (n: number): string => (n > 0 ? `+${String(n)}` : String(n))

export function roundResult(g: Game): string {
  const r = g.round.result
  if (!r) return ''
  return `<div class="panel" data-entity="result" data-label="result of this hand">${resultBody(r)}` +
    `${g.opts.autodrive ? '' : button('next', '▶', 'Next hand')}</div>`
}

export function endScreen(g: Game): string {
  const m = g.match
  const order = placements(m.scores)
  const rows = order.map((seat, i) => `<div class="place p${String(i + 1)}"><span>${String(i + 1)}</span>${SEAT_GLYPH[seat] ?? ''}<b>${String(m.scores[seat] ?? 0)}</b></div>`)
  const wins = m.history.map((h) => {
    const r = h.result
    if (r.type === 'draw') return `<li>${h.label}: ${TERMS.ryuukyoku}</li>`
    const yaku = (r.score?.yaku ?? []).map((y) => y.name.split(' (')[0]).join(', ')
    return `<li>${h.label}: ${SEAT_GLYPH[r.winner] ?? ''} ${r.type === 'tsumo' ? TERMS.tsumo : TERMS.ron} — ${yaku} · ${String(r.score?.han ?? 0)} han ${String(r.score?.fu ?? 0)} fu</li>`
  })
  return `<div class="panel end" id="end-screen" data-entity="end" data-label="final results">` +
    `<div class="places">${rows.join('')}</div><ul class="history">${wins.join('')}</ul>${button('again', '↻', 'New game')}</div>`
}
