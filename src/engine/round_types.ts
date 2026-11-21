import type { Meld, WinScore } from './types.ts'

export interface Discard {
  tile: number
  riichi: boolean
  /** Taken by another player's call (still counts for furiten). */
  called: boolean
  tsumogiri: boolean
}

export interface PlayerState {
  hand: number[]
  melds: Meld[]
  discards: Discard[]
  riichi: boolean
  doubleRiichi: boolean
  ippatsu: boolean
  /** Passed a winning tile while in riichi: furiten for the rest of the hand. */
  permFuriten: boolean
  /** Passed a winning tile: furiten until this player's next discard. */
  tempFuriten: boolean
}

export interface RoundParams {
  seed: number
  roundWind: number
  /** Seat of the dealer (oya); also the round number within the wind. */
  dealer: number
  honba: number
  sticks: number
  scores: number[]
}

export type RoundEvent =
  | { t: 'draw'; seat: number; rinshan: boolean }
  | { t: 'discard'; seat: number; tile: number; riichi: boolean }
  | { t: 'call'; seat: number; kind: Meld['kind']; tile: number; from: number }
  | { t: 'dora'; indicator: number }
  | { t: 'win'; seat: number; from: number; tsumo: boolean }
  | { t: 'draw_game' }

export interface RoundResult {
  type: 'ron' | 'tsumo' | 'draw'
  winner: number
  loser: number
  score: WinScore | null
  /** Final hand of the winner (concealed, winning tile included). */
  hand: number[]
  deltas: number[]
  tenpai: boolean[]
}

export interface RoundState extends RoundParams {
  wall: number[]
  /** 14-tile dead wall: [0..4] dora indicators, [5..9] ura, [10..13] kan replacements. */
  dead: number[]
  doraCount: number
  rinshanUsed: number
  players: PlayerState[]
  turn: number
  phase: 'act' | 'claim' | 'over'
  /** Tile the turn player just drew (null after a call). */
  drawn: number | null
  lastDiscard: { seat: number; tile: number } | null
  /** Next draw is a kan replacement tile. */
  afterKan: boolean
  /** No call yet and nobody has discarded twice: tenhou/chiihou/double riichi window. */
  firstGoAround: boolean
  discardCount: number
  /** Kinds the turn player may not discard right after a call (kuikae). */
  kuikae: number[]
  /** Riichi declared on the discard now in the claim window. */
  pendingRiichi: boolean
  result: RoundResult | null
  events: RoundEvent[]
}

export type ActAction =
  | { type: 'discard'; tile: number; riichi?: boolean }
  | { type: 'tsumo' }
  | { type: 'ankan'; tile: number }
  | { type: 'shouminkan'; tile: number }

export type ClaimAction =
  | { type: 'pass' }
  | { type: 'ron' }
  | { type: 'pon' }
  | { type: 'minkan' }
  | { type: 'chi'; tiles: [number, number] }

export interface ActOptions {
  discards: number[]
  /** Discards that keep the hand tenpai, when riichi is allowed. */
  riichi: number[]
  tsumo: boolean
  ankan: number[]
  shouminkan: number[]
}

export interface ClaimOptions {
  ron: boolean
  pon: boolean
  minkan: boolean
  chi: [number, number][]
}
