import type { Demo } from './demo.ts'
import type { Scene } from './scenes.ts'

// Steps through scenes in order: one tap = one step; false after the last.

export interface Cursor {
  scene: Scene
  step: number
  demo: Demo
  /** Overall position, 0-based, and the total number of steps. */
  index: number
  total: number
}

export class TutorialPlayer {
  private s = 0
  private i = 0
  private readonly scenes: Scene[]

  constructor(scenes: Scene[]) {
    this.scenes = scenes.filter((x) => x.steps.length > 0)
  }

  get total(): number {
    return this.scenes.reduce((n, x) => n + x.steps.length, 0)
  }

  current(): Cursor | null {
    const scene = this.scenes[this.s]
    const demo = scene?.steps[this.i]
    if (!scene || !demo) return null
    const before = this.scenes.slice(0, this.s).reduce((n, x) => n + x.steps.length, 0)
    return { scene, step: this.i, demo, index: before + this.i, total: this.total }
  }

  /** Advance one step; false when the tutorial is over. */
  next(): boolean {
    const scene = this.scenes[this.s]
    if (!scene) return false
    if (this.i + 1 < scene.steps.length) this.i++
    else {
      this.s++
      this.i = 0
    }
    return this.current() !== null
  }
}
