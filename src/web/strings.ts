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

/** Tutorial gloss chips (kuhy asked: Japanese terms glossed on first use). */
export const GLOSS = {
  manzu: { jp: '萬子', romaji: 'Manzu' },
  pinzu: { jp: '筒子', romaji: 'Pinzu' },
  souzu: { jp: '索子', romaji: 'Souzu' },
  kazehai: { jp: '風牌', romaji: 'Kazehai' },
  sangenpai: { jp: '三元牌', romaji: 'Sangenpai' },
  yakuhai: { jp: '役牌', romaji: 'Yakuhai' },
  han: { jp: '飜', romaji: 'Han' },
  dorahyojihai: { jp: 'ドラ表示牌', romaji: 'Dora hyōjihai' },
  dora: { jp: 'ドラ', romaji: 'Dora' },
  ton: { jp: '東', romaji: 'Ton' },
  jikaze: { jp: '自風', romaji: 'Jikaze' },
  oya: { jp: '親', romaji: 'Oya' },
  tenbou: { jp: '点棒', romaji: 'Tenbou' },
  tonikkyoku: { jp: '東一局', romaji: 'Ton ikkyoku' },
  tonpuusen: { jp: '東風戦', romaji: 'Tonpuusen' },
  hanchan: { jp: '半荘', romaji: 'Hanchan' },
} as const
