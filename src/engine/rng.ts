/**
 * Seeded PRNG (mulberry32). The only source of randomness in the engine and AI,
 * so a seed replays the same deal and the same opponent play.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      const tmp = items[i] as T
      items[i] = items[j] as T
      items[j] = tmp
    }
    return items
  }
}

/** Mix a game seed and round number into a per-round seed. */
export function roundSeed(seed: number, roundNumber: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 2654435761) + roundNumber * 40503) >>> 0
}
