// Tile kinds 0..33: 0-8 man (characters), 9-17 pin (dots), 18-26 sou (bamboo),
// 27-30 winds East South West North, 31-33 dragons haku hatsu chun.
// Hands hold kinds, not physical tile ids: Riichi rules never tell two copies
// of the same kind apart (red fives are not used in this ruleset).

export const KINDS = 34
export const COPIES = 4

export type Suit = 'm' | 'p' | 's' | 'z'

export function suitOf(kind: number): Suit {
  if (kind < 9) return 'm'
  if (kind < 18) return 'p'
  if (kind < 27) return 's'
  return 'z'
}

/** Rank 1-9 for suited tiles, 1-7 for honours (E S W N haku hatsu chun). */
export function rankOf(kind: number): number {
  return kind < 27 ? (kind % 9) + 1 : kind - 26
}

export const isHonor = (k: number): boolean => k >= 27
export const isTerminal = (k: number): boolean => k < 27 && (k % 9 === 0 || k % 9 === 8)
export const isYaochu = (k: number): boolean => isHonor(k) || isTerminal(k)
export const isSimple = (k: number): boolean => !isYaochu(k)
export const isDragon = (k: number): boolean => k >= 31
export const isWind = (k: number): boolean => k >= 27 && k <= 30

/** Parse compact notation like "123m456p11z" into sorted kinds. */
export function parseTiles(text: string): number[] {
  const out: number[] = []
  let digits: number[] = []
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      digits.push(Number(ch))
      continue
    }
    const base = { m: 0, p: 9, s: 18, z: 27 }[ch as Suit]
    if (base === undefined) throw new Error(`bad tile suit ${ch}`)
    for (const d of digits) out.push(base + d - 1)
    digits = []
  }
  if (digits.length > 0) throw new Error('digits without suit')
  return out.sort((a, b) => a - b)
}

/** Compact code for one kind, e.g. 4 -> "5m", 31 -> "5z". */
export function tileCode(kind: number): string {
  return `${String(rankOf(kind))}${suitOf(kind)}`
}

const HONOR_NAMES = ['East', 'South', 'West', 'North', 'White dragon', 'Green dragon', 'Red dragon']
const HONOR_JP = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun']
const SUIT_NAMES: Record<Suit, string> = { m: 'characters (man)', p: 'dots (pin)', s: 'bamboo (sou)', z: '' }

/** English name with the Japanese term, used in question context. */
export function tileName(kind: number): string {
  if (isHonor(kind)) {
    const i = kind - 27
    return `${HONOR_JP[i] ?? ''} (${HONOR_NAMES[i] ?? ''}${i < 4 ? ' wind' : ''})`
  }
  return `${String(rankOf(kind))} of ${SUIT_NAMES[suitOf(kind)]}`
}

export function toCounts(kinds: readonly number[]): number[] {
  const c: number[] = new Array<number>(KINDS).fill(0)
  for (const k of kinds) c[k] = (c[k] ?? 0) + 1
  return c
}

/** The dora is the kind after the indicator, wrapping inside its group. */
export function doraFromIndicator(ind: number): number {
  if (ind < 27) return ind - (ind % 9) + ((ind % 9) + 1) % 9
  if (ind <= 30) return 27 + ((ind - 27 + 1) % 4)
  return 31 + ((ind - 31 + 1) % 3)
}

export function sortKinds(kinds: number[]): number[] {
  return kinds.sort((a, b) => a - b)
}
