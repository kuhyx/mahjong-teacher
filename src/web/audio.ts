// Procedural audio (WebAudio, no files). Off by default; agent runs never turn
// it on. Music: a calm loop on the major pentatonic (C D E G A), soft sine
// plucks over a slow two-chord drone. [design guess] tempo 72 bpm, quarter notes.
// SFX: a tile clack = short filtered noise burst + a damped 1.8 kHz click.

const PENTA = [0, 2, 4, 7, 9]
const ROOT = 261.63 // C4
const PHRASE = [0, 2, 4, 3, 2, 1, 2, -1, 0, 1, 3, 4, 2, 1, 0, -1]
const BEAT = 60 / 72

const freq = (step: number): number => {
  const oct = Math.floor(step / 5)
  const deg = PENTA[((step % 5) + 5) % 5] ?? 0
  return ROOT * 2 ** (oct + deg / 12)
}

export class Audio {
  private ctx: AudioContext | null = null
  private loop: ReturnType<typeof setInterval> | null = null
  private master: GainNode | null = null

  on: boolean

  constructor(on: boolean) {
    this.on = on
  }

  private ensure(): AudioContext | null {
    if (!this.on) return null
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.25
      this.master.connect(this.ctx.destination)
    }
    void this.ctx.resume()
    return this.ctx
  }

  toggle(): void {
    this.on = !this.on
    if (this.on) this.startMusic()
    else this.stopMusic()
  }

  private note(ctx: AudioContext, f: number, at: number, len: number, vol: number, type: OscillatorType): void {
    if (!this.master) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(vol, at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(this.master)
    o.start(at)
    o.stop(at + len + 0.05)
  }

  startMusic(): void {
    const ctx = this.ensure()
    if (!ctx || this.loop !== null) return
    let bar = 0
    const playBar = (): void => {
      const t0 = ctx.currentTime + 0.05
      const chord = bar % 2 === 0 ? [-5, -3] : [-4, -1]
      for (const c of chord) this.note(ctx, freq(c) / 2, t0, BEAT * 4, 0.08, 'triangle')
      for (let i = 0; i < 4; i++) {
        const step = PHRASE[(bar * 4 + i) % PHRASE.length] ?? 0
        this.note(ctx, freq(step), t0 + i * BEAT, BEAT * 1.6, 0.12, 'sine')
      }
      bar++
    }
    playBar()
    this.loop = setInterval(playBar, BEAT * 4 * 1000)
  }

  stopMusic(): void {
    if (this.loop !== null) clearInterval(this.loop)
    this.loop = null
  }

  private lastClack = -1

  /** Rate-limited to one per 80 ms so fast AI turns never machine-gun. */
  clack(): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const at = ctx.currentTime
    if (at - this.lastClack < 0.08) return
    this.lastClack = at
    const len = 0.06
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate)
    const data = buf.getChannelData(0)
    // Deterministic noise: an LCG, so the engine's no-Math.random rule holds here too.
    let x = 12345
    for (let i = 0; i < data.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff
      data[i] = ((x / 0x7fffffff) * 2 - 1) * (1 - i / data.length) ** 3
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400
    const g = ctx.createGain()
    g.gain.value = 0.9
    src.connect(bp).connect(g).connect(this.master)
    src.start(at)
    this.note(ctx, 1800, at, 0.04, 0.2, 'square')
  }
}
