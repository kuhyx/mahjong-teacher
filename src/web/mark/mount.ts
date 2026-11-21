import { explain } from '../../engine/explain.ts'
import { PROPOSE_PHRASE, REJECT_PHRASE } from '../../log/clear.ts'
import { parseLog, serializeLog } from '../../log/log.ts'
import { ChatPanel } from '../chat/panel.ts'
import { pickTransport, usesRelay } from '../chat/pick.ts'
import { SignInNeeded, signIn, signedIn, workerAge } from '../chat/relay.ts'
import { PlaySession } from '../chat/session.ts'
import type { Game } from '../game.ts'
import { captureStage, toJpegBase64 } from './capture.ts'
import { MarkLayer, type Tool } from './overlay.ts'

// Freeze-frame mode: ✎ (or F12) pauses the game, shows the tool strip and the
// question drawer. The first question burns the marks into the frame, stores
// the full PNG with the log and sends a small JPEG with the question.

export interface MarkHost {
  getGame: () => Game | null
  rerender: () => void
}

const TOOLS: [Tool | 'undo' | 'wipe' | 'exit', string, string][] = [
  ['pick', '☝', 'Pick a tile or item'], ['rect', '▭', 'Rectangle'], ['arrow', '➚', 'Arrow'], ['circle', '◯', 'Circle'],
  ['pen', '✎', 'Pen'], ['text', 'T', 'Text note'], ['undo', '↶', 'Undo'], ['wipe', '⌫', 'Clear marks'], ['exit', '✕', 'Close and resume'],
]

export function mountMarking(host: MarkHost): { onGame: (g: Game) => void; onRender: (g: Game) => void } {
  const transport = pickTransport()
  const sessions = new WeakMap<Game, PlaySession>()
  let layer: MarkLayer | null = null
  let panel: ChatPanel | null = null
  let bar: HTMLElement | null = null
  let pending: string | null = null
  let savedEnd = false

  const session = (): PlaySession | null => {
    const g = host.getGame()
    return g ? (sessions.get(g) ?? null) : null
  }

  function exit(): void {
    layer?.destroy()
    panel?.destroy()
    bar?.remove()
    layer = panel = bar = null
    document.body.classList.remove('marking')
    host.getGame()?.setPaused(false)
  }

  function enter(): void {
    const g = host.getGame()
    const s = session()
    if (!g || !s || layer) return
    g.setPaused(true)
    document.body.classList.add('marking')
    const ml = new MarkLayer(document.body)
    layer = ml
    bar = document.createElement('nav')
    bar.id = 'mark-tools'
    bar.innerHTML = TOOLS.map(([id, glyph, aria]) => `<button data-tool="${id}" aria-label="${aria}"${id === 'pick' ? ' class="on"' : ''}>${glyph}</button>`).join('')
    document.body.appendChild(bar)
    bar.addEventListener('click', (e) => onTool((e.target as Element).closest<HTMLElement>('[data-tool]')?.dataset['tool'] ?? ''))
    const cp = new ChatPanel(document.body, { send: (q) => void send(q), propose: () => void send(null), reject: () => void send('reject') })
    panel = cp
    ml.onPick = () => {
      cp.chips(ml.picked.map((p) => p.label))
      cp.go(true)
    }
    ml.onMark = () => cp.go(true)
    ml.onText = (x, y) => textInput(ml, x, y)
    s.setFrame({ entities: [], marks: [], pngBase64: '', jpegBase64: '', snapshot: explain(g.match) })
    cp.thread(null, null)
    void relayStatus(cp)
  }

  /** Public site only: show the sign-in or worker-offline glyph. */
  async function relayStatus(cp: ChatPanel): Promise<void> {
    if (!usesRelay()) return
    try {
      if (!(await signedIn())) return cp.status('signin', () => void signIn().then(() => relayStatus(cp)).catch(() => cp.error()))
      cp.status((await workerAge()) > 90 ? 'offline' : null)
    } catch (e) {
      cp.status(e instanceof SignInNeeded ? 'signin' : 'offline', () => void signIn().then(() => relayStatus(cp)).catch(() => cp.error()))
    }
  }

  function onTool(id: string): void {
    if (!layer || !bar) return
    if (id === 'undo') return layer.undo()
    if (id === 'wipe') return layer.clear()
    if (id === 'exit') return exit()
    layer.tool = id as Tool
    for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', b.dataset['tool'] === id)
  }

  async function freezeFrame(g: Game, s: PlaySession, ml: MarkLayer): Promise<void> {
    const stage = document.getElementById('stage')
    if (!stage) return
    ml.canvas.style.visibility = 'hidden'
    const { canvas, scale } = await captureStage(stage)
    ml.canvas.style.visibility = ''
    const ctx = canvas.getContext('2d')
    if (ctx) ml.paint(ctx, scale)
    s.setFrame({
      entities: ml.picked.map((p) => ({ entity: p.entity, label: p.label })), marks: ml.marksAt(scale),
      pngBase64: canvas.toDataURL('image/png').split(',')[1] ?? '', jpegBase64: toJpegBase64(canvas), snapshot: explain(g.match),
    })
  }

  /** q: typed text; null: ➤ with an empty box (proposal); 'reject': ✗. */
  async function send(q: string | null): Promise<void> {
    const g = host.getGame()
    const s = session()
    if (!g || !s || !panel || !layer || pending !== null) return
    pending = q === null ? (s.item ? REJECT_PHRASE : PROPOSE_PHRASE) : q === 'reject' ? REJECT_PHRASE : q
    panel.thread(s.item, pending)
    try {
      if (s.item === null) await freezeFrame(g, s, layer)
      const state = explain(g.match)
      const r = q === null ? await s.propose(state) : q === 'reject' ? await s.reject(state) : await s.send(q, state)
      pending = null
      if (r.closed) return exit()
      panel.thread(s.item, null)
      void relayStatus(panel) // an answer means the worker is back: drop a stale offline glyph
    } catch (e) {
      pending = null
      panel.thread(s.item, null)
      panel.error()
      if (e instanceof SignInNeeded) panel.status('signin', () => void signIn().then(() => panel && relayStatus(panel)).catch(() => panel?.error()))
      console.error(e)
    }
  }

  function textInput(ml: MarkLayer, x: number, y: number): void {
    const input = document.createElement('input')
    input.id = 'mark-text'
    input.setAttribute('aria-label', 'Text note')
    input.style.left = `${String(x)}px`
    input.style.top = `${String(y - 16)}px`
    document.body.appendChild(input)
    input.focus()
    const done = (): void => {
      ml.addText(x, y, input.value)
      input.remove()
    }
    input.addEventListener('keydown', (e) => e.key === 'Enter' && done())
    input.addEventListener('blur', done)
  }

  document.getElementById('t-mark')?.addEventListener('click', () => (layer ? exit() : enter()))
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F12' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault()
      if (layer) exit()
      else enter()
    }
  })
  window.addEventListener('resize', () => layer?.resize())

  window.__mjLog = {
    id: () => session()?.log.id ?? null,
    /** C12: load the saved file, parse, save again; true when bytes are identical. */
    reload: async (id: string) => {
      const before = await transport.loadLog(id)
      await transport.saveLog(parseLog(before))
      const after = await transport.loadLog(id)
      return { same: before === after && serializeLog(parseLog(before)) === before, bytes: before.length }
    },
  }

  return {
    onGame: (g) => {
      sessions.set(g, new PlaySession(transport, g.opts.seed, g.opts.length))
      savedEnd = false
      void sessions.get(g)?.save().catch(() => undefined)
    },
    onRender: (g) => {
      panel?.respot()
      if (g.screen === 'end' && !savedEnd) {
        savedEnd = true
        void sessions.get(g)?.save().catch(() => undefined)
      }
    },
  }
}

declare global {
  interface Window {
    __mjLog: { id: () => string | null; reload: (id: string) => Promise<{ same: boolean; bytes: number }> }
  }
}
