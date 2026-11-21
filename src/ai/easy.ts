import { shanten, waitsOf } from '../engine/decompose.ts'
import { Rng } from '../engine/rng.ts'
import { actOptions, claimOptions, player, seatWindOf } from '../engine/round.ts'
import type { ActAction, ClaimAction, RoundState } from '../engine/round_types.ts'
import { isDragon, isHonor, isTerminal } from '../engine/tiles.ts'

// Easy opponent: [design guess] tuned for a learner, not for strength.
// Takes every win, riichis when tenpai, pons only value honours (so open
// hands keep a yaku), and folds to genbutsu once someone else is in riichi.

/** How useful a tile is to keep: neighbours and copies in the hand. */
function keepValue(hand: number[], k: number): number {
  let v = hand.filter((t) => t === k).length * 2
  if (!isHonor(k)) {
    for (const d of [-2, -1, 1, 2]) {
      const n = k + d
      if (Math.floor(n / 9) === Math.floor(k / 9) && hand.includes(n)) v += Math.abs(d) === 1 ? 2 : 1
    }
    if (!isTerminal(k)) v += 0.5
  }
  return v
}

/** Discards nobody in riichi can ron: their own pond (genbutsu). */
function safety(s: RoundState, seat: number, k: number): number {
  let threat = 0
  for (let o = 0; o < 4; o++) {
    const pl = player(s, o)
    if (o === seat || !pl.riichi) continue
    threat += pl.discards.some((d) => d.tile === k) ? 0 : isHonor(k) ? 1 : 3
  }
  return threat
}

export class EasyAi {
  private readonly rng: Rng

  constructor(seed: number) {
    this.rng = new Rng(seed)
  }

  act(s: RoundState): ActAction {
    const opts = actOptions(s)
    if (opts.tsumo) return { type: 'tsumo' }
    const pl = player(s, s.turn)
    const after = (k: number): number[] => {
      const rest = [...pl.hand]
      rest.splice(rest.indexOf(k), 1)
      return rest
    }
    if (opts.riichi.length > 0) {
      const best = [...opts.riichi].sort((a, b) => waitsOf(after(b), 0).length - waitsOf(after(a), 0).length || a - b)[0]
      if (best !== undefined) return { type: 'discard', tile: best, riichi: true }
    }
    const scored = opts.discards.map((k) => {
      const sh = shanten(after(k), pl.melds.length)
      return { k, sh, keep: keepValue(pl.hand, k), risk: safety(s, s.turn, k), jitter: this.rng.next() }
    })
    const threatened = s.players.some((p, o) => o !== s.turn && p.riichi)
    const minSh = Math.min(...scored.map((x) => x.sh))
    scored.sort((a, b) =>
      (threatened && minSh >= 2 ? a.risk - b.risk : 0) || a.sh - b.sh || a.risk - b.risk || a.keep - b.keep || a.jitter - b.jitter)
    return { type: 'discard', tile: scored[0]?.k ?? opts.discards[0] ?? 0 }
  }

  claim(s: RoundState, seat: number): ClaimAction {
    const o = claimOptions(s, seat)
    if (o.ron) return { type: 'ron' }
    const tile = s.lastDiscard?.tile ?? -1
    const valuable = isDragon(tile) || tile === seatWindOf(s, seat) || tile === s.roundWind
    if (o.pon && valuable) return { type: 'pon' }
    return { type: 'pass' }
  }
}
