import type { ConfusionItem } from '../../log/log.ts'
import type { Demo } from '../../tutorial/demo.ts'
import { offlineIcon } from '../icons.ts'
import { isTriggerPhrase, REJECT_PHRASE } from '../../log/clear.ts'
import { demoSvg, spotlight } from '../render/demo.ts'
import { CLEAR_PHRASE } from '../strings.ts'

// Question drawer: picked-item chips, the thread, an input, send (➤), ✗ and ✓
// (sends "ok that is clear"). ➤ with an empty box asks for a proposal at once;
// ✗ asks for a different one. Proposals draw their demo above the text. Right side on wide screens, bottom sheet on phones.

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

/** Minimal markdown for answers: paragraphs, **bold**, `code`. */
function md(text: string): string {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export interface PanelHandlers {
  send: (q: string) => void
  propose: () => void
  reject: () => void
}

export class ChatPanel {
  readonly el: HTMLElement
  private readonly input: HTMLTextAreaElement
  private spot: Demo | null = null

  constructor(parent: HTMLElement, h: PanelHandlers) {
    this.el = document.createElement('aside')
    this.el.id = 'chat'
    this.el.innerHTML = `<div id="status"></div><div id="chips"></div><div id="thread" aria-live="polite"></div>
      <form id="ask"><textarea id="q" rows="2" aria-label="Your question (English or Polish)"></textarea>
      <button type="submit" id="send" aria-label="Send question, or show me a proposal when empty">➤</button>
      <button type="button" id="reject" aria-label="Show it another way" hidden>✗</button>
      <button type="button" id="clear" aria-label="${CLEAR_PHRASE}">✓</button></form>`
    parent.appendChild(this.el)
    const input = this.el.querySelector<HTMLTextAreaElement>('#q')
    if (!input) throw new Error('no input')
    this.input = input
    this.el.querySelector('#ask')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const q = this.input.value.trim()
      this.input.value = ''
      this.go(false)
      if (q) h.send(q)
      else h.propose()
    })
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.el.querySelector<HTMLFormElement>('#ask')?.requestSubmit()
      }
    })
    this.el.querySelector('#clear')?.addEventListener('click', () => h.send(CLEAR_PHRASE))
    this.el.querySelector('#reject')?.addEventListener('click', () => h.reject())
  }

  /** Table re-rendered: spotlight the current proposal's entities again. */
  respot(): void {
    spotlight(document, this.spot)
  }

  /** Pulse ➤ once something is marked: one tap starts the proposal. */
  go(on: boolean): void {
    this.el.querySelector('#send')?.classList.toggle('go', on)
  }

  chips(labels: string[]): void {
    const box = this.el.querySelector('#chips')
    if (box) box.innerHTML = labels.map((l) => `<span class="chip">${esc(l)}</span>`).join('')
  }

  thread(item: ConfusionItem | null, pending: string | null): void {
    const box = this.el.querySelector('#thread')
    if (!box) return
    const turns = (item?.transcript ?? []).map((t) => {
      const fix = t.corrected.map((c) => `<div class="fix" data-entity="correction:${esc(c.field)}" data-label="engine correction of ${esc(c.field)}">⚠ ${esc(c.field)}: <s>${esc(c.model)}</s> → <b>${esc(c.engine)}</b></div>`).join('')
      if (t.role === 'user' && isTriggerPhrase(t.text)) {
        return `<div class="turn user trigger" role="img" aria-label="${t.text === REJECT_PHRASE ? 'another way' : 'show me'}">${t.text === REJECT_PHRASE ? '✗' : '➤'}</div>`
      }
      const demo = t.role === 'assistant' && t.demo ? demoSvg(t.demo) : ''
      return `<div class="turn ${t.role}${t.corrected.length > 0 ? ' flagged' : ''}${demo ? ' proposal' : ''}">${demo}${t.role === 'assistant' ? md(t.text) : esc(t.text)}${fix}</div>`
    })
    const last = [...(item?.transcript ?? [])].reverse().find((t) => t.role === 'assistant')
    this.spot = pending === null ? (last?.demo ?? null) : null
    this.respot()
    const reject = this.el.querySelector<HTMLButtonElement>('#reject')
    if (reject) reject.hidden = !(last?.demo) || pending !== null
    if (pending !== null) turns.push(`${isTriggerPhrase(pending) ? `<div class="turn user trigger">${pending === REJECT_PHRASE ? '✗' : '➤'}</div>` : `<div class="turn user">${esc(pending)}</div>`}<div class="turn assistant waiting" aria-label="waiting for the answer">…</div>`)
    box.innerHTML = turns.join('')
    box.scrollTop = box.scrollHeight
  }

  /** Glyph state: sign-in needed (tap to sign in), PC worker offline, or none. */
  status(kind: 'signin' | 'offline' | null, onSignIn?: () => void): void {
    const box = this.el.querySelector<HTMLElement>('#status')
    if (!box) return
    box.innerHTML = kind === 'signin'
      ? '<button id="signin" aria-label="Sign in with Google to ask" data-entity="button:signin" data-label="sign-in needed">🔑</button>'
      : kind === 'offline' ? `<span id="offline" role="img" aria-label="PC worker offline: the question waits in the queue">${offlineIcon()}</span>` : ''
    box.querySelector('#signin')?.addEventListener('click', () => onSignIn?.())
  }

  error(): void {
    this.el.classList.add('shake')
    setTimeout(() => this.el.classList.remove('shake'), 500)
  }

  focus(): void {
    this.input.focus()
  }

  destroy(): void {
    spotlight(document, null)
    this.el.remove()
  }
}
