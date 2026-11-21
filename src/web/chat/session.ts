import type { Explain } from '../../engine/explain.ts'
import { emptyLog, type ConfusionItem, type Mark, type PlayLog } from '../../log/log.ts'
import { topicsFor } from '../../log/topics.ts'
import { isClearPhrase, isTriggerPhrase, PROPOSE_PHRASE, REJECT_PHRASE } from '../../log/clear.ts'
import type { Transport } from './transport.ts'

// One play-through log and the open question thread (a ConfusionItem). A
// thread closes only when the player says "ok that is clear" (or taps ✓).


const now = (): string => new Date().toISOString()
const POLISH = /[ąćęłńóśźż]|\b(dlaczego|czemu|jak|co|czy|ile|nie|jest|jaki|jaka|pokaz)\b/i

/** Reply language for a tap with no typed text: the last typed question wins. */
function guessLang(text: string | null): string {
  if (text) return POLISH.test(text) ? 'pl' : 'en'
  const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem('mj.lang')
  if (saved === 'pl' || saved === 'en') return saved
  const nav = typeof navigator === 'undefined' ? 'en' : navigator.language.slice(0, 2).toLowerCase()
  return nav === 'pl' ? 'pl' : 'en'
}

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
  /** Items opened by a tap (➤ empty): follow-ups keep asking for proposals. */
  private readonly proposing = new Set<string>()
  private lastTyped: string | null = null

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

  /** ➤ with nothing typed: ask at once for a proposal about the marked items. */
  propose(state: Explain): Promise<{ closed: boolean }> {
    return this.send(this.item ? REJECT_PHRASE : PROPOSE_PHRASE, state, 'propose')
  }

  /** ✗: the proposal did not help; ask for a different approach in the same thread. */
  reject(state: Explain): Promise<{ closed: boolean }> {
    return this.send(REJECT_PHRASE, state, 'propose')
  }

  /** Send a question (or the clear phrase). */
  async send(question: string, state: Explain, force?: 'propose'): Promise<{ closed: boolean }> {
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
    const trigger = isTriggerPhrase(question)
    const item = this.item ?? (this.item = await this.open(trigger ? '' : question))
    if (force === 'propose') this.proposing.add(item.id)
    const mode = this.proposing.has(item.id) ? 'propose' : 'ask'
    if (!trigger) {
      this.lastTyped = question
      if (typeof localStorage !== 'undefined') localStorage.setItem('mj.lang', guessLang(question))
    }
    item.transcript.push({ role: 'user', text: question, at: now(), corrected: [] })
    if (!trigger) for (const t of topicsFor([], question)) if (!item.topics.includes(t) && t !== 'flow') item.topics.push(t)
    await this.save()
    const reply = await this.transport.ask({
      logId: this.log.id, itemId: item.id, turn: item.transcript.length, question, state,
      entities: item.entities, marks: item.marks, sessionId: item.sessionId,
      jpegBase64: first ? (this.frame?.jpegBase64 ?? null) : null, mode,
      // A typed turn is answered in its own language; only a tap needs a guess.
      lang: trigger ? guessLang(this.lastTyped) : '',
    })
    item.sessionId = reply.sessionId
    item.flagged = item.flagged || reply.flagged
    item.transcript.push({ role: 'assistant', text: reply.answer, at: now(), corrected: reply.corrected, ...(reply.demo ? { demo: reply.demo } : {}) })
    await this.save()
    return { closed: false }
  }
}
