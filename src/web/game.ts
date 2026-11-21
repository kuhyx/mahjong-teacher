import { makeAis } from '../ai/autoplay.ts'
import type { EasyAi } from '../ai/easy.ts'
import { newMatch, nextRound, type MatchLength, type MatchState } from '../engine/match.ts'
import { actOptions, applyAct, applyClaims, claimOptions } from '../engine/round.ts'
import type { ActAction, ClaimAction, ClaimOptions } from '../engine/round_types.ts'

// Drives a match: AIs act on a timer, the human (seat 0) acts through the UI,
// or through the bot when autodrive is on. Pausing freezes the timer (marking).

export type Screen = 'play' | 'round_end' | 'end'

export interface GameOptions {
  seed: number
  length: MatchLength
  /** Delay between AI steps in ms; 0 runs as fast as the page allows. */
  delay: number
  autodrive: boolean
}

export type HumanPrompt =
  | { kind: 'act' }
  | { kind: 'claim'; options: ClaimOptions }
  | null

export class Game {
  readonly match: MatchState
  private readonly ais: EasyAi[]
  private timer: ReturnType<typeof setTimeout> | null = null
  private paused = false
  riichiMode = false
  screen: Screen = 'play'
  onChange: () => void = () => undefined
  onDiscard: () => void = () => undefined

  readonly opts: GameOptions

  constructor(opts: GameOptions) {
    this.opts = opts
    this.match = newMatch(opts.seed, opts.length)
    this.ais = makeAis(opts.seed)
  }

  get round(): MatchState['round'] {
    return this.match.round
  }

  /** What the human must decide now, or null while others play. */
  prompt(): HumanPrompt {
    const s = this.round
    if (this.screen !== 'play') return null
    if (s.phase === 'act' && s.turn === 0) return { kind: 'act' }
    if (s.phase === 'claim' && s.lastDiscard?.seat !== 0) {
      const o = claimOptions(s, 0)
      if (o.ron || o.pon || o.minkan || o.chi.length > 0) return { kind: 'claim', options: o }
    }
    return null
  }

  start(): void {
    this.schedule()
  }

  setPaused(p: boolean): void {
    this.paused = p
    if (!p) this.schedule()
  }

  isPaused(): boolean {
    return this.paused
  }

  private schedule(): void {
    if (this.timer !== null || this.paused) return
    if (!this.opts.autodrive && this.prompt() !== null) return
    if (this.screen === 'end' || (this.screen === 'round_end' && !this.opts.autodrive)) return
    const delay = this.screen === 'round_end' ? Math.max(this.opts.delay * 4, 0) : this.opts.delay
    this.timer = setTimeout(() => {
      this.timer = null
      this.burst()
    }, delay)
  }

  /** At delay 0, run many steps per timer tick so a bot game ends in seconds. */
  private burst(): void {
    const steps = this.opts.delay === 0 ? 40 : 1
    for (let i = 0; i < steps && !this.paused; i++) {
      if (!this.tick()) break
    }
    this.onChange()
    this.schedule()
  }

  /** One AI or bot decision. Returns false when it must stop for the human or a screen. */
  private tick(): boolean {
    if (this.screen === 'round_end') {
      if (!this.opts.autodrive) return false
      this.advance()
      return (this.screen as Screen) === 'play'
    }
    if (this.screen === 'end') return false
    const s = this.round
    const p = this.prompt()
    if (p && !this.opts.autodrive) return false
    if (s.phase === 'act') this.doAct(this.ais[s.turn]?.act(s) ?? { type: 'tsumo' })
    else {
      const d: Partial<Record<number, ClaimAction>> = {}
      for (let seat = 0; seat < 4; seat++) if (seat !== s.lastDiscard?.seat) d[seat] = this.ais[seat]?.claim(s, seat) ?? { type: 'pass' }
      applyClaims(s, d)
    }
    if (s.phase === 'over') this.screen = 'round_end'
    return this.opts.delay === 0
  }

  private doAct(a: ActAction): void {
    applyAct(this.round, a)
    if (a.type === 'discard') this.onDiscard()
  }

  /** The easy AI's choice for seat 0 now (test driver; a future hint button). */
  hint(): ActAction | null {
    return this.prompt()?.kind === 'act' ? (this.ais[0]?.act(this.round) ?? null) : null
  }

  /** Human action from the UI; ignores anything not legal right now. */
  humanAct(a: ActAction): void {
    const s = this.round
    if (this.prompt()?.kind !== 'act' || this.paused) return
    const o = actOptions(s)
    const legal =
      (a.type === 'tsumo' && o.tsumo) ||
      (a.type === 'discard' && (a.riichi ? o.riichi : o.discards).includes(a.tile)) ||
      (a.type === 'ankan' && o.ankan.includes(a.tile)) ||
      (a.type === 'shouminkan' && o.shouminkan.includes(a.tile))
    if (!legal) return
    this.riichiMode = false
    this.doAct(a)
    if (s.phase === 'over') this.screen = 'round_end'
    this.onChange()
    this.schedule()
  }

  humanClaim(a: ClaimAction): void {
    const s = this.round
    if (this.prompt()?.kind !== 'claim' || this.paused) return
    const d: Partial<Record<number, ClaimAction>> = { 0: a }
    for (let seat = 1; seat < 4; seat++) if (seat !== s.lastDiscard?.seat) d[seat] = this.ais[seat]?.claim(s, seat) ?? { type: 'pass' }
    applyClaims(s, d)
    if (s.phase === 'over') this.screen = 'round_end'
    this.onChange()
    this.schedule()
  }

  /** Leave the round-result screen: next hand or the end screen. */
  advance(): void {
    if (this.screen !== 'round_end') return
    nextRound(this.match)
    this.screen = this.match.over ? 'end' : 'play'
    this.onChange()
    this.schedule()
  }
}
