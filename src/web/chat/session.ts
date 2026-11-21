import type { Explain } from '../../engine/explain.ts'
import { emptyLog, type ConfusionItem, type Mark, type PlayLog } from '../../log/log.ts'
import { topicsFor } from '../../log/topics.ts'
import type { Transport } from './transport.ts'

// One play-through log and the open question thread (a ConfusionItem). A
// thread closes only when the player says "ok that is clear" (or taps ✓).

const CLEAR = /^\s*(ok(ay)?[,.]?\s*(that'?s|that is|it'?s|it is)\s*clear|ok[,.]?\s*to\s*(jest\s*)?jasne)\s*[.!]*\s*$/i
export const isClearPhrase = (q: string): boolean => CLEAR.test(q)

const now = (): string => new Date().toISOString()

export interface Frame {
  entities: { entity: string; label: string }[]
  marks: Mark[]
  pngBase64: string
  jpegBase64: string
  snapshot: Explain
}

export class PlaySession {
  readonly log: PlayLog
  item: ConfusionItem | null = null
  private frame: Frame | null = null

  private readonly transport: Transport

  constructor(transport: Transport, seed: number, length: PlayLog['length']) {
    this.transport = transport
    this.log = emptyLog(`p${String(seed)}-${Date.now().toString(36)}`, seed, length, now())
  }

  save(): Promise<void> {
    return this.transport.saveLog(this.log)
  }

  /** Freeze-frame taken: the next question opens a new thread about it. */
  setFrame(f: Frame): void {
    this.frame = f
    this.item = null
  }

  private async open(question: string): Promise<ConfusionItem> {
    const f = this.frame
    if (!f) throw new Error('no frame')
    const id = `i${String(this.log.items.length + 1)}`
    const shot = `${this.log.id}-${id}`
    await this.transport.saveShot(shot, f.pngBase64)
    const item: ConfusionItem = {
      id, createdAt: now(), topics: topicsFor(f.entities.map((e) => e.entity), question), entities: f.entities,
      marks: f.marks, screenshot: `${shot}.png`, transcript: [], snapshot: f.snapshot,
      sessionId: null, cleared: false, clearedAt: null, flagged: false,
    }
    this.log.items.push(item)
    return item
  }

  /** Send a question (or the clear phrase). Returns the assistant turn text, or null when closed. */
  async send(question: string, state: Explain): Promise<{ closed: boolean }> {
    if (this.item && isClearPhrase(question)) {
      this.item.transcript.push({ role: 'user', text: question, at: now(), corrected: [] })
      this.item.cleared = true
      this.item.clearedAt = now()
      await this.save()
      this.item = null
      this.frame = null
      return { closed: true }
    }
    const first = this.item === null
    const item = this.item ?? (this.item = await this.open(question))
    item.transcript.push({ role: 'user', text: question, at: now(), corrected: [] })
    for (const t of topicsFor([], question)) if (!item.topics.includes(t) && t !== 'flow') item.topics.push(t)
    await this.save()
    const reply = await this.transport.ask({
      logId: this.log.id, itemId: item.id, turn: item.transcript.length, question, state,
      entities: item.entities, marks: item.marks, sessionId: item.sessionId,
      jpegBase64: first ? (this.frame?.jpegBase64 ?? null) : null,
    })
    item.sessionId = reply.sessionId
    item.flagged = item.flagged || reply.flagged
    item.transcript.push({ role: 'assistant', text: reply.answer, at: now(), corrected: reply.corrected })
    await this.save()
    return { closed: false }
  }
}
