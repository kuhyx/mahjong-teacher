// Freeze-frame rasteriser. Browsers cannot screenshot the page, but everything
// that matters here is SVG (table, tile minis) or a simple text panel, so we
// redraw those onto a canvas at device pixels. Marks are burned on top later.

function svgImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const r = svg.getBoundingClientRect()
  clone.setAttribute('width', String(r.width))
  clone.setAttribute('height', String(r.height))
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('svg raster failed'))
    img.src = url
  })
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

function drawPanel(ctx: CanvasRenderingContext2D, panel: HTMLElement): void {
  const r = panel.getBoundingClientRect()
  const cs = getComputedStyle(panel)
  ctx.fillStyle = cs.backgroundColor
  ctx.strokeStyle = cs.borderTopColor
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(r.left, r.top, r.width, r.height, 18)
  ctx.fill()
  ctx.stroke()
  // Text nodes at their laid-out positions (Range rects), so the frame matches the screen.
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent?.trim()
    const parent = n.parentElement
    if (!text || !parent || parent.closest('svg')) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    const box = range.getBoundingClientRect()
    if (box.width === 0) continue
    const ps = getComputedStyle(parent)
    ctx.font = `${ps.fontWeight} ${ps.fontSize} ${ps.fontFamily}`
    ctx.fillStyle = ps.color
    ctx.textBaseline = 'middle'
    ctx.fillText(text, box.left, box.top + box.height / 2)
  }
}

/** Raster of the stage (CSS px x dpr). Returns the canvas and the scale used. */
export async function captureStage(stage: HTMLElement): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const scale = Math.min(window.devicePixelRatio || 1, 3)
  const rect = stage.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rect.width * scale)
  canvas.height = Math.round(rect.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.scale(scale, scale)
  ctx.translate(-rect.left, -rect.top)
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor
  ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
  const table = stage.querySelector<SVGSVGElement>('#table')
  if (table) {
    const r = table.getBoundingClientRect()
    ctx.drawImage(await svgImage(table), r.left, r.top, r.width, r.height)
  }
  for (const btn of stage.querySelectorAll<HTMLElement>('#actions button')) {
    const r = btn.getBoundingClientRect()
    ctx.fillStyle = getComputedStyle(btn).backgroundColor
    ctx.fillRect(r.left, r.top, r.width, r.height)
  }
  for (const panel of stage.querySelectorAll<HTMLElement>('#overlay .panel')) if (visible(panel)) drawPanel(ctx, panel)
  for (const mini of stage.querySelectorAll<SVGSVGElement>('svg.mini')) {
    if (!visible(mini)) continue
    const r = mini.getBoundingClientRect()
    ctx.drawImage(await svgImage(mini), r.left, r.top, r.width, r.height)
  }
  for (const btn of stage.querySelectorAll<HTMLElement>('#actions button')) {
    const r = btn.getBoundingClientRect()
    ctx.fillStyle = getComputedStyle(btn).color
    ctx.font = `700 ${getComputedStyle(btn).fontSize} sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(btn.textContent?.trim() ?? '', r.left + 8, r.top + r.height / 2)
  }
  return { canvas, scale }
}

/** Downscale to a JPEG under ~500 KB for the request (marks already burned in). */
export function toJpegBase64(src: HTMLCanvasElement, maxBytes = 500_000): string {
  let width = Math.min(src.width, 1600)
  for (let q = 0.85; ; q -= 0.1) {
    const c = document.createElement('canvas')
    c.width = width
    c.height = Math.round((src.height * width) / src.width)
    c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height)
    const b64 = c.toDataURL('image/jpeg', Math.max(q, 0.4)).split(',')[1] ?? ''
    if (b64.length * 0.75 <= maxBytes || width < 400) return b64
    if (q < 0.5) width = Math.round(width * 0.75)
  }
}
