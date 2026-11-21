import { KINDS, isYaochu, toCounts } from './tiles.ts'

/** A concealed group found in a winning hand: a sequence starting at `start`, or a triplet. */
export interface Group {
  type: 'seq' | 'trip'
  start: number
}

export interface Decomposition {
  form: 'standard' | 'chiitoi' | 'kokushi'
  pair: number
  groups: Group[]
}

function extract(counts: number[], from: number, need: number, acc: Group[], out: Group[][]): void {
  let i = from
  while (i < KINDS && (counts[i] ?? 0) === 0) i++
  if (i === KINDS) {
    if (need === 0) out.push([...acc])
    return
  }
  if (need === 0) return
  const c = counts[i] ?? 0
  if (c >= 3) {
    counts[i] = c - 3
    acc.push({ type: 'trip', start: i })
    extract(counts, i, need - 1, acc, out)
    acc.pop()
    counts[i] = c
  }
  const r = i % 9
  if (i < 27 && r <= 6 && (counts[i + 1] ?? 0) > 0 && (counts[i + 2] ?? 0) > 0) {
    counts[i] = c - 1
    counts[i + 1] = (counts[i + 1] ?? 0) - 1
    counts[i + 2] = (counts[i + 2] ?? 0) - 1
    acc.push({ type: 'seq', start: i })
    extract(counts, i, need - 1, acc, out)
    acc.pop()
    counts[i] = c
    counts[i + 1] = (counts[i + 1] ?? 0) + 1
    counts[i + 2] = (counts[i + 2] ?? 0) + 1
  }
}

/**
 * Every way the concealed tiles (winning tile included) form a complete hand,
 * given how many open melds already sit on the table.
 */
export function decompose(concealed: readonly number[], openMelds: number): Decomposition[] {
  const counts = toCounts(concealed)
  const need = 4 - openMelds
  if (concealed.length !== need * 3 + 2) return []
  const out: Decomposition[] = []
  for (let p = 0; p < KINDS; p++) {
    if ((counts[p] ?? 0) < 2) continue
    counts[p] = (counts[p] ?? 0) - 2
    const found: Group[][] = []
    extract(counts, 0, need, [], found)
    for (const groups of found) out.push({ form: 'standard', pair: p, groups })
    counts[p] = (counts[p] ?? 0) + 2
  }
  if (openMelds === 0) {
    if (counts.filter((c) => c === 2).length === 7) out.push({ form: 'chiitoi', pair: -1, groups: [] })
    const yaochu = counts.map((c, k) => (isYaochu(k) ? c : 0))
    const pairKind = yaochu.findIndex((c) => c === 2)
    const allYaochu = counts.every((c, k) => (isYaochu(k) ? c >= 1 : c === 0))
    if (allYaochu && pairKind >= 0) out.push({ form: 'kokushi', pair: pairKind, groups: [] })
  }
  return out
}

export function isComplete(concealed: readonly number[], openMelds: number): boolean {
  return decompose(concealed, openMelds).length > 0
}

/**
 * Kinds that complete a 13-tile (or fewer, with melds) hand. A kind whose four
 * copies are all already in the hand cannot be waited on.
 */
export function waitsOf(concealed: readonly number[], openMelds: number): number[] {
  const counts = toCounts(concealed)
  const waits: number[] = []
  for (let k = 0; k < KINDS; k++) {
    if ((counts[k] ?? 0) >= 4) continue
    if (isComplete([...concealed, k], openMelds)) waits.push(k)
  }
  return waits
}

/**
 * Minimum shanten-like distance used by the AI: 0 means tenpai. A cheap
 * estimate (groups + partial groups) is enough for an easy opponent.
 */
export function shanten(concealed: readonly number[], openMelds: number): number {
  const counts = toCounts(concealed)
  let best = 8
  const search = (i: number, groups: number, partials: number, pair: boolean): void => {
    while (i < KINDS && (counts[i] ?? 0) === 0) i++
    if (i === KINDS) {
      const g = groups + openMelds
      const p = Math.min(partials, 4 - g)
      best = Math.min(best, 8 - 2 * g - p - (pair ? 1 : 0))
      return
    }
    const c = counts[i] ?? 0
    const r = i % 9
    const suited = i < 27
    if (c >= 3) { counts[i] = c - 3; search(i, groups + 1, partials, pair); counts[i] = c }
    if (suited && r <= 6 && (counts[i + 1] ?? 0) > 0 && (counts[i + 2] ?? 0) > 0) {
      counts[i] = c - 1; counts[i + 1]! -= 1; counts[i + 2]! -= 1
      search(i, groups + 1, partials, pair)
      counts[i] = c; counts[i + 1]! += 1; counts[i + 2]! += 1
    }
    if (c >= 2) {
      counts[i] = c - 2
      if (!pair) search(i, groups, partials, true)
      search(i, groups, partials + 1, pair)
      counts[i] = c
    }
    if (suited && r <= 7 && (counts[i + 1] ?? 0) > 0) {
      counts[i] = c - 1; counts[i + 1]! -= 1
      search(i, groups, partials + 1, pair)
      counts[i] = c; counts[i + 1]! += 1
    }
    if (suited && r <= 6 && (counts[i + 2] ?? 0) > 0) {
      counts[i] = c - 1; counts[i + 2]! -= 1
      search(i, groups, partials + 1, pair)
      counts[i] = c; counts[i + 2]! += 1
    }
    counts[i] = c - 1
    search(i, groups, partials, pair)
    counts[i] = c
  }
  search(0, 0, 0, false)
  if (openMelds === 0) {
    const pairs = counts.filter((c) => c >= 2).length
    best = Math.min(best, 6 - pairs + Math.max(0, 7 - counts.filter((c) => c > 0).length))
  }
  return best
}
