// Visible-string ledger (textgate). Only mahjong terms kuhy asked to learn and
// glyphs; everything else on screen is an icon with an aria-label.

export const TERMS = {
  tsumo: 'Tsumo',
  ron: 'Ron',
  riichi: 'Riichi',
  pon: 'Pon',
  chi: 'Chi',
  kan: 'Kan',
  dora: 'Dora',
  ura: 'Ura dora',
  ryuukyoku: '流局',
} as const

/** Seat glyphs: you at the bottom, then counter-clockwise by turn order. */
export const SEAT_GLYPH = ['▼', '▶', '▲', '◀']

/** The exact phrase that closes a question thread. */
export const CLEAR_PHRASE = 'ok that is clear'
