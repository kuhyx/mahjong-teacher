import type { Mark, MarkTool } from '../../log/log.ts'

// Drawing layer over the frozen stage: rect, arrow, circle, pen, text, plus
// entity picking. Marks are kept in CSS px and converted to screenshot pixels
// (x dpr) when saved. Pointer events cover mouse, pen and touch alike.

export type Tool = MarkTool | 'pick'

export interface Picked {
  entity: string
  label: string
  rect: DOMRect
}

const GOLD = '#d9a441'
const RED = '#e5484d'

export class MarkLayer {
  readonly canvas: HTMLCanvasElement
  tool: Tool = 'pick'
  marks: Mark[] = []
  picked: Picked[] = []
  private draft: Mark | null = null
  onPick: (p: Picked) => void = () => undefined
  onText: (x: number, y: number) => void = () => undefined

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'mark-canvas'
    parent.appendChild(this.canvas)
    this.resize()
    this.canvas.addEventListener('pointerdown', (e) => this.down(e))
    this.canvas.addEventListener('pointermove', (e) => this.move(e))
    this.canvas.addEventListener('pointerup', () => this.up())
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(window.innerWidth * dpr)
    this.canvas.height = Math.round(window.innerHeight * dpr)
    this.redraw()
  }

  private pos(e: PointerEvent): [number, number] {
    return [Math.round(e.clientX), Math.round(e.clientY)]
  }

  private down(e: PointerEvent): void {
    e.preventDefault()
    const p = this.pos(e)
    if (this.tool === 'pick') return this.pick(p)
    if (this.tool === 'text') return this.onText(p[0], p[1])
    this.canvas.setPointerCapture(e.pointerId)
    this.draft = { tool: this.tool, points: [p, p], text: '' }
  }

  private move(e: PointerEvent): void {
    if (!this.draft) return
    const p = this.pos(e)
    if (this.draft.tool === 'pen') this.draft.points.push(p)
    else this.draft.points[1] = p
    this.redraw()
  }

  private up(): void {
    if (this.draft) this.marks.push(this.draft)
    this.draft = null
    this.redraw()
  }

  /** Topmost element under the point that names itself with data-entity. */
  private pick([x, y]: [number, number]): void {
    this.canvas.style.pointerEvents = 'none'
    const hit = document.elementsFromPoint(x, y).map((el) => el.closest('[data-entity]')).find((el) => el !== null)
    this.canvas.style.pointerEvents = ''
    if (!hit) return
    const entity = hit.getAttribute('data-entity') ?? ''
    if (this.picked.some((p) => p.entity === entity)) return
    const p = { entity, label: hit.getAttribute('data-label') ?? entity, rect: hit.getBoundingClientRect() }
    this.picked.push(p)
    this.redraw()
    this.onPick(p)
  }

  addText(x: number, y: number, text: string): void {
    if (text.trim()) this.marks.push({ tool: 'text', points: [[x, y]], text: text.trim() })
    this.redraw()
  }

  undo(): void {
    if (this.marks.length > 0) this.marks.pop()
    else this.picked.pop()
    this.redraw()
  }

  clear(): void {
    this.marks = []
    this.picked = []
    this.redraw()
  }

  /** Draw marks and pick highlights onto any context (screen layer or the burned frame). */
  paint(ctx: CanvasRenderingContext2D, scale: number): void {
    ctx.save()
    ctx.scale(scale, scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const p of this.picked) {
      ctx.strokeStyle = GOLD
      ctx.lineWidth = 3
      ctx.setLineDash([8, 5])
      ctx.strokeRect(p.rect.left - 3, p.rect.top - 3, p.rect.width + 6, p.rect.height + 6)
    }
    ctx.setLineDash([])
    for (const m of this.draft ? [...this.marks, this.draft] : this.marks) drawMark(ctx, m)
    ctx.restore()
  }

  redraw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.paint(ctx, window.devicePixelRatio || 1)
  }

  /** Marks in screenshot pixels for the log and the prompt. */
  marksAt(scale: number): Mark[] {
    return this.marks.map((m) => ({ ...m, points: m.points.map(([x, y]) => [Math.round(x * scale), Math.round(y * scale)] as [number, number]) }))
  }

  destroy(): void {
    this.canvas.remove()
  }
}

function drawMark(ctx: CanvasRenderingContext2D, m: Mark): void {
  ctx.strokeStyle = RED
  ctx.fillStyle = RED
  ctx.lineWidth = 4
  const a: [number, number] = m.points[0] ?? [0, 0]
  const b: [number, number] = m.points[m.points.length - 1] ?? [0, 0]
  switch (m.tool) {
    case 'rect':
      ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
      break
    case 'circle': {
      ctx.beginPath()
      ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 + 1, Math.abs(b[1] - a[1]) / 2 + 1, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'arrow': {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.moveTo(b[0], b[1])
      ctx.lineTo(b[0] - 18 * Math.cos(ang - 0.45), b[1] - 18 * Math.sin(ang - 0.45))
      ctx.moveTo(b[0], b[1])
      ctx.lineTo(b[0] - 18 * Math.cos(ang + 0.45), b[1] - 18 * Math.sin(ang + 0.45))
      ctx.stroke()
      break
    }
    case 'pen':
      ctx.beginPath()
      m.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.stroke()
      break
    case 'text':
      ctx.font = '700 20px sans-serif'
      ctx.lineWidth = 4
      ctx.strokeStyle = '#ffffff'
      ctx.strokeText(m.text, a[0], a[1])
      ctx.fillText(m.text, a[0], a[1])
      break
  }
}
