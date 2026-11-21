import { describe, expect, it } from 'vitest'
import { TutorialPlayer } from '../../src/tutorial/player.ts'
import { SCENES } from '../../src/tutorial/scenes.ts'

describe('tutorial player', () => {
  it('visits every step of every scene once, in order, then ends', () => {
    const p = new TutorialPlayer(SCENES)
    const seen: string[] = []
    do {
      const c = p.current()
      if (c) seen.push(`${c.scene.id}:${String(c.step)}:${String(c.index)}`)
    } while (p.next())
    const want = SCENES.flatMap((s) => s.steps.map((_, i) => `${s.id}:${String(i)}`))
    expect(seen.map((x) => x.split(':').slice(0, 2).join(':'))).toEqual(want)
    expect(seen.map((x) => Number(x.split(':')[2]))).toEqual(want.map((_, i) => i))
    expect(p.current()).toBeNull()
    expect(p.next()).toBe(false)
  })
})
