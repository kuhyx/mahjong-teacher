import { newMatch, type MatchState } from '../engine/match.ts'
import { doraIndicators } from '../engine/round.ts'
import { doraFromIndicator, tileCode } from '../engine/tiles.ts'
import { GLOSS } from '../web/strings.ts'
import type { Demo } from './demo.ts'

// Tutorial scenes: one per thing kuhy marked as unclear in his play-through
// logs. Each step is a Demo drawn over a fixed, engine-dealt table (seed
// TUTORIAL_SEED), so spotlights and screenshots never drift. Steps carry no
// sentences: tiles, highlights, arrows, han pips and a kanji+romaji chip the
// first time a term appears. `covers` says which marked items a scene explains
// (scripts/tutorial_coverage.ts fails when a marked item has no scene).

export const TUTORIAL_SEED = 1

export interface Covers {
  /** Picked entity id, e.g. /^score:/. */
  entity: RegExp
  /** Optional extra test on the entity's label (tile identity, dragon...). */
  label?: RegExp
}

export interface Scene {
  id: string
  /** One-line repo-only note for DOCS-tutorial.md (never shown in the game). */
  doc: string
  covers: Covers[]
  /** For items with no picked entity: words in the questions. */
  words: RegExp
  steps: Demo[]
}

export function tutorialMatch(): MatchState {
  return newMatch(TUTORIAL_SEED, 'hanchan')
}

const HAND_LIKE = /^(hand|tile|discard|meld|demo):/
const ALL = (n: number): number[] => Array.from({ length: n }, (_, i) => i)
const run = (suit: string): string[] => ALL(9).map((i) => `${String(i + 1)}${suit}`)

function scenes(m: MatchState): Scene[] {
  const ind = doraIndicators(m.round)[0] ?? 0
  return [
    {
      id: 'suits',
      doc: 'Tile identity: the three numbered suits, 1 to 9.',
      covers: [{ entity: HAND_LIKE, label: /of (characters|dots|bamboo)/ }],
      words: /\b(suit|man|pin|sou|characters|dots|bamboo|kolor|kafel\w*)\b/i,
      steps: [
        { tiles: run('m'), highlight: [2], gloss: { ...GLOSS.manzu } },
        { tiles: run('p'), highlight: [2], gloss: { ...GLOSS.pinzu } },
        { tiles: run('s'), highlight: [2], gloss: { ...GLOSS.souzu } },
        { tiles: ['3m', '3p', '3s'], highlight: [0, 1, 2] },
      ],
    },
    {
      id: 'honors',
      doc: 'Honour tiles: winds and dragons; three of a dragon is yakuhai, 1 han.',
      covers: [{ entity: HAND_LIKE, label: /^(Ton|Nan|Shaa|Pei|Haku|Hatsu|Chun|East|South|West|North|White dragon|Green dragon|Red dragon)\b/ }],
      words: /dragon|smok|yakuhai|honou?r|wind|wiatr|chun|hatsu|haku|\bhan\b/i,
      steps: [
        { tiles: ['1z', '2z', '3z', '4z'], highlight: [0, 1, 2, 3], gloss: { ...GLOSS.kazehai } },
        { tiles: ['5z', '6z', '7z'], highlight: [0, 1, 2], gloss: { ...GLOSS.sangenpai } },
        { tiles: ['7z', '7z', '7z'], highlight: [0, 1, 2], gloss: { ...GLOSS.yakuhai } },
        { tiles: ['7z', '7z', '7z'], highlight: [0, 1, 2], pips: 1, gloss: { ...GLOSS.han } },
        { tiles: ['6z', '6z', '6z', '7z', '7z', '7z'], highlight: [0, 1, 2, 3, 4, 5], pips: 2 },
      ],
    },
    {
      id: 'dora',
      doc: 'Dora: the indicator shows the next tile in order, and each dora adds 1 han.',
      covers: [{ entity: /^dora$/ }, { entity: HAND_LIKE, label: /dora/i }],
      words: /\bdor[ay]\b|indicator|wskaźnik/i,
      steps: [
        { tiles: [tileCode(ind)], highlight: [0], focus: ['dora'], gloss: { ...GLOSS.dorahyojihai } },
        { tiles: [tileCode(ind), tileCode(doraFromIndicator(ind))], highlight: [1], arrow: [0, 1], focus: ['dora'], gloss: { ...GLOSS.dora } },
        { tiles: ['9m', '1m'], highlight: [1], arrow: [0, 1] },
        { tiles: ['4z', '1z'], highlight: [1], arrow: [0, 1] },
        { tiles: ['7z', '5z'], highlight: [1], arrow: [0, 1] },
        { tiles: [tileCode(doraFromIndicator(ind))], highlight: [0], pips: 1 },
      ],
    },
    {
      id: 'seats',
      doc: 'Seat winds, the dealer, the round marker and the 25000 starting points.',
      covers: [{ entity: /^score:\d$/ }, { entity: /^round$/ }],
      words: /seat|dealer|score|points?|25 ?000|wiatr|rozdaj\w*|punkt\w*|runda|round/i,
      steps: [
        { tiles: ['1z'], highlight: [0], focus: ['score:0'], gloss: { ...GLOSS.ton } },
        { tiles: ['1z', '2z', '3z', '4z'], highlight: [0, 1, 2, 3], arrow: [0, 1], focus: ['score:0', 'score:1', 'score:2', 'score:3'], gloss: { ...GLOSS.jikaze } },
        { tiles: ['1z'], highlight: [0], focus: ['score:0'], gloss: { ...GLOSS.oya } },
        { tiles: [], focus: ['score:0', 'score:1', 'score:2', 'score:3'], gloss: { ...GLOSS.tenbou } },
        { tiles: ['1z'], highlight: [0], focus: ['round'], gloss: { ...GLOSS.tonikkyoku } },
      ],
    },
    {
      id: 'length',
      doc: 'Match length: East-only (tonpuusen) or East plus South (hanchan).',
      covers: [{ entity: /^button:(east|hanchan)$/ }],
      words: /tonpuu|hanchan|east.only|east and south|długość|przycisk/i,
      steps: [
        { tiles: ['1z'], highlight: [0], focus: ['round'], gloss: { ...GLOSS.tonpuusen } },
        { tiles: ['1z', '2z'], highlight: [0, 1], arrow: [0, 1], focus: ['round'], gloss: { ...GLOSS.hanchan } },
      ],
    },
  ]
}

export const SCENES: Scene[] = scenes(tutorialMatch())
