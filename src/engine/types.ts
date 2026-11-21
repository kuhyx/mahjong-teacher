/** Shared engine types. Kinds are 0..33 (see tiles.ts). Seats 0..3, 0 = the human. */

export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'

export interface Meld {
  kind: MeldKind
  /** Sorted kinds; 3 for chi/pon, 4 for kans. */
  tiles: number[]
  /** Seat the called tile came from (own seat for ankan). */
  from: number
  /** The claimed kind, when called from a discard. */
  called?: number
}

export interface WinInput {
  /** Concealed tiles including the winning tile. */
  concealed: number[]
  melds: Meld[]
  winTile: number
  tsumo: boolean
  /** Kinds 27..30. */
  seatWind: number
  roundWind: number
  dealer: boolean
  riichi: boolean
  doubleRiichi: boolean
  ippatsu: boolean
  haitei: boolean
  houtei: boolean
  rinshan: boolean
  chankan: boolean
  tenhou: boolean
  chiihou: boolean
  doraIndicators: number[]
  uraIndicators: number[]
}

export interface YakuHit {
  id: string
  /** English gloss + Japanese name, e.g. "Riichi (ready declaration)". */
  name: string
  han: number
  /** Yakuman multiplier; 0 for normal yaku. */
  yakuman: number
}

export type Limit = 'none' | 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'yakuman'

export interface FuPart {
  why: string
  fu: number
}

export interface WinScore {
  yaku: YakuHit[]
  han: number
  fu: number
  fuParts: FuPart[]
  dora: number
  ura: number
  limit: Limit
  /** Basic points before multiplication (capped by limit). */
  base: number
  /** Total paid on ron (before honba/riichi sticks). */
  ron: number
  /** Tsumo payments: dealer pays `dealer`, every other loser `other`. */
  payments: { dealer: number; other: number }
  wait: string
}
