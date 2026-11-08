import { toCanvas } from 'html-to-image'
import { getStroke } from 'perfect-freehand'
import type { InkBoardWorldSample } from '../../../shared/ink'
import type { ExportImageFormat } from '../../../shared/quick-access'
import { displayInkColor, type ResolvedTheme } from '@renderer/theme/appearance'

export type WorldRect = { x: number; y: number; width: number; height: number }

export type ExportInkStroke = {
  samples: InkBoardWorldSample[]
  style: { color: string; width: number; opacity: number }
}

/** Padding (world units) around content for "Export all", like Whiteboard's auto-crop. */
export const EXPORT_ALL_PADDING = 32

// Pixel budget. Chromium accepts far larger canvases on paper, but in Electron the
// GPU runs out of memory well before that: the window flashes black (GPU reset)
// and the canvas comes back empty. ~32 MP keeps a 4x export of a normal board
// while staying safely inside typical GPU limits.
const MAX_CANVAS_SIDE = 8192
const MAX_CANVAS_AREA = 32_000_000
const MAX_EXPORT_SCALE = 4
const MIN_EXPORT_SCALE = 0.5

/** Highest pixel ratio that still fits the browser's canvas limits. */
export function pickExportScale(rect: WorldRect): number {
  const bySide = MAX_CANVAS_SIDE / Math.max(rect.width, rect.height, 1)
  const byArea = Math.sqrt(MAX_CANVAS_AREA / Math.max(rect.width * rect.height, 1))
  return Math.max(0.25, Math.min(MAX_EXPORT_SCALE, bySide, byArea))
}

/**
 * True when the canvas actually holds an image. A canvas whose GPU context was lost
 * (or that failed to draw) reads back as fully transparent — which encodes to black.
 */
function canvasHasContent(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d')
  if (!context) return false
  if ('isContextLost' in context && (context as CanvasRenderingContext2D & { isContextLost: () => boolean }).isContextLost()) {
    return false
  }
  const probes = 6
  for (let iy = 0; iy < probes; iy += 1) {
    for (let ix = 0; ix < probes; ix += 1) {
      const x = Math.floor(((ix + 0.5) / probes) * canvas.width)
      const y = Math.floor(((iy + 0.5) / probes) * canvas.height)
      if (context.getImageData(x, y, 1, 1).data[3] !== 0) return true
    }
  }
  return false
}

export function inkStrokeBounds(strokes: ExportInkStroke[]): WorldRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    const pad = stroke.style.width
    for (const s of stroke.samples) {
      minX = Math.min(minX, s.x - pad)
      minY = Math.min(minY, s.y - pad)
      maxX = Math.max(maxX, s.x + pad)
      maxY = Math.max(maxY, s.y + pad)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function unionRects(a: WorldRect | null, b: WorldRect | null): WorldRect | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  }
}

export function padRect(rect: WorldRect, padding: number): WorldRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  }
}

/** Interaction chrome that must never appear in an exported image. */
function exportFilter(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true
  if (node.dataset.boardCapture === 'exclude') return false
  const cls = node.classList
  return !(
    cls.contains('react-flow__handle') ||
    cls.contains('react-flow__node-toolbar') ||
    cls.contains('react-flow__selection') ||
    cls.contains('react-flow__nodesselection') ||
    cls.contains('react-flow__connection') ||
    cls.contains('text-node__resize-zone') ||
    cls.contains('text-node__resize-cue') ||
    cls.contains('text-node__fit-handle') ||
    cls.contains('node-resize-handles')
  )
}

function drawInk(
  context: CanvasRenderingContext2D,
  strokes: ExportInkStroke[],
  rect: WorldRect,
  scale: number,
  theme: ResolvedTheme
): void {
  context.save()
  context.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale)
  for (const stroke of strokes) {
    if (stroke.samples.length < 2) continue
    const outline = getStroke(
      stroke.samples.map((s) => [s.x, s.y, s.pressure > 0 ? s.pressure : 0.5]),
      {
        size: stroke.style.width,
        thinning: 0.62,
        smoothing: 0.58,
        streamline: 0.44,
        simulatePressure: true,
        last: true
      }
    )
    if (outline.length < 2) continue
    context.beginPath()
    context.moveTo(outline[0][0], outline[0][1])
    for (let i = 1; i < outline.length; i += 1) context.lineTo(outline[i][0], outline[i][1])
    context.closePath()
    context.globalAlpha = stroke.style.opacity
    context.fillStyle = displayInkColor(stroke.style.color, theme)
    context.fill()
  }
  context.restore()
}

/**
 * Renders a world-space rectangle of the board (nodes, edges and ink) to a canvas
 * at the highest scale the browser allows, independent of the current viewport.
 */
export async function renderBoardRegion(
  rect: WorldRect,
  strokes: ExportInkStroke[],
  theme: ResolvedTheme
): Promise<HTMLCanvasElement> {
  const root = document.querySelector<HTMLElement>('[data-board-capture="root"]')
  const viewportEl = root?.querySelector<HTMLElement>('.react-flow__viewport')
  if (!root || !viewportEl) throw new Error('Board is not mounted')

  const background = resolveOpaqueBackground()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))

  // Try the highest quality first; if the GPU can't produce it, halve and retry.
  let scale = pickExportScale(rect)
  let lastError: unknown = null
  while (scale >= MIN_EXPORT_SCALE) {
    // Neutralize selection outlines while the DOM is being cloned.
    root.classList.add('wb-exporting')
    try {
      const canvas = await toCanvas(viewportEl, {
        width,
        height,
        pixelRatio: scale,
        skipAutoScale: true,
        backgroundColor: background,
        filter: exportFilter,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${-rect.x}px, ${-rect.y}px) scale(1)`
        }
      })
      const context = canvas.getContext('2d')
      if (context) {
        drawInk(context, strokes, rect, scale, theme)
        // Guarantee an opaque background (JPG/BMP have no alpha: transparent = black).
        context.save()
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.globalCompositeOperation = 'destination-over'
        context.fillStyle = background
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.restore()
      }
      if (canvasHasContent(canvas)) return canvas
      lastError = new Error(`Empty render at scale ${scale}`)
    } catch (error) {
      lastError = error
    } finally {
      root.classList.remove('wb-exporting')
    }
    scale /= 2
  }
  throw lastError instanceof Error ? lastError : new Error('Board render failed')
}

/** Board background as an opaque color (falls back to white/dark by theme). */
function resolveOpaqueBackground(): string {
  const value = getComputedStyle(document.body).backgroundColor
  if (!value || value === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(value)) {
    return document.documentElement.dataset.theme === 'dark' ? '#1b1c1f' : '#fcfcfc'
  }
  return value
}

// ── Encoding ─────────────────────────────────────────────────────────────────

/** 24-bit uncompressed BMP (canvas can't encode BMP natively). */
function encodeBmp(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No 2D context')
  const pixels = context.getImageData(0, 0, width, height).data
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const imageSize = rowSize * height
  const fileSize = 54 + imageSize
  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  view.setUint8(0, 0x42)
  view.setUint8(1, 0x4d)
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, imageSize, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)

  for (let y = 0; y < height; y += 1) {
    const srcRow = (height - 1 - y) * width * 4
    let dst = 54 + y * rowSize
    for (let x = 0; x < width; x += 1) {
      const src = srcRow + x * 4
      bytes[dst] = pixels[src + 2]
      bytes[dst + 1] = pixels[src + 1]
      bytes[dst + 2] = pixels[src]
      dst += 3
    }
  }
  return bytes
}

export async function encodeCanvas(canvas: HTMLCanvasElement, format: ExportImageFormat): Promise<Uint8Array> {
  if (format === 'bmp') return encodeBmp(canvas)
  const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg'
  const quality = format === 'png' ? undefined : format === 'webp' ? 1 : 0.95
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))
  if (!blob) throw new Error('Image encoding failed (the area may be too large)')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Full export flow: ask where to save (name + format), render the region at max
 * quality, encode and write. Returns the saved path, or null if cancelled.
 */
export async function exportBoardRegionToFile(
  rect: WorldRect,
  strokes: ExportInkStroke[],
  theme: ResolvedTheme,
  suggestedName: string
): Promise<string | null> {
  const target = await window.api.pickExportImagePath(suggestedName)
  if (!target.ok || !target.filePath || !target.format) return null
  const canvas = await renderBoardRegion(rect, strokes, theme)
  const bytes = await encodeCanvas(canvas, target.format)
  const result = await window.api.writeExportImage(target.filePath, bytes)
  if (!result.ok) throw new Error('Could not write the image file')
  return target.filePath
}
