import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useViewport, useReactFlow } from '@xyflow/react'
import { getStroke } from 'perfect-freehand'
import type { InkBoardWorldSample, InkStroke } from '../../../shared/ink'
import {
  DEFAULT_INK_STROKE_DYNAMICS,
  DEFAULT_INK_STROKE_STYLE
} from '../../../shared/ink'
import type { InkTool } from './InkToolbar'
import { displayInkColor, useResolvedTheme } from '@renderer/theme/appearance'
import { BOARD_MAX_ZOOM, BOARD_MIN_ZOOM } from './zoomLimits'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import {
  LIVE_STREAMLINE,
  rawStrokePath,
  strokeIsRaw,
  strokeOutlineOptions,
  strokeRawPath,
  strokeStreamline,
  strokeUsesPressure
} from './inkStrokeOptions'
import './InkOverlay.css'

const ERASER_SCREEN_RADIUS = 20

export type InkPenStyle = {
  color: string
  width: number
  /** Width follows pen pressure. */
  pressure: boolean
  /** Direct ink: draw the pen path as-is (no smoothing, no tapering). */
  raw: boolean
}

type InkOverlayProps = {
  active: boolean
  activeTool: InkTool
  penStyle: InkPenStyle
  acetateVisible: boolean
  acetateStrokes: BoardInkStroke[]
  onTransfer: (stroke: BoardInkStroke) => void
  onEraseComplete: (erasedStrokes: BoardInkStroke[]) => void
  /** Strokes picked by the area selection (pointer tool). */
  selectedStrokeIds?: ReadonlySet<string>
  /** Live offset (world units) applied to selected strokes while they are dragged. */
  selectedStrokeOffset?: { dx: number; dy: number } | null
  /** Dragging the selection box of selected strokes. `done` on release. */
  onSelectedStrokesDrag?: (dx: number, dy: number, done: boolean) => void
}

const NO_SELECTION: ReadonlySet<string> = new Set()

/**
 * The live-ink canvas uses a desynchronized (low-latency) 2D context: drawing goes
 * to screen without waiting for the compositor's next frame. Must be the first
 * getContext call on that canvas, so every access goes through here.
 */
function getGlassContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { desynchronized: true }) as CanvasRenderingContext2D | null
}

function isLightHex(hex: string): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const full = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6
}

type CachedStrokePath = {
  path: Path2D
  /** Raw strokes are stroked (polyline at constant width) instead of filled. */
  raw?: { width: number }
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Stroke outlines are computed once, in world space, and cached per stroke object
 * (strokes are immutable). Drawing a frame is then just a transform + fill, so
 * panning and zooming don't recompute every stroke on every frame.
 */
const strokePathCache = new WeakMap<BoardInkStroke, CachedStrokePath>()

function getCachedStrokePath(stroke: BoardInkStroke): CachedStrokePath | null {
  const cached = strokePathCache.get(stroke)
  if (cached) return cached
  if (strokeIsRaw(stroke.dynamics)) {
    const points = (stroke.samples as InkBoardWorldSample[]).map((s) => [s.x, s.y] as [number, number])
    if (points.length === 0) return null
    const half = stroke.style.width / 2
    let rMinX = Infinity
    let rMinY = Infinity
    let rMaxX = -Infinity
    let rMaxY = -Infinity
    for (const [x, y] of points) {
      rMinX = Math.min(rMinX, x - half)
      rMinY = Math.min(rMinY, y - half)
      rMaxX = Math.max(rMaxX, x + half)
      rMaxY = Math.max(rMaxY, y + half)
    }
    const rawEntry = { path: rawStrokePath(points), raw: { width: stroke.style.width }, minX: rMinX, minY: rMinY, maxX: rMaxX, maxY: rMaxY }
    strokePathCache.set(stroke, rawEntry)
    return rawEntry
  }
  if (stroke.samples.length < 2) return null
  const pressure = strokeUsesPressure(stroke.dynamics)
  const outline = getStroke(
    (stroke.samples as InkBoardWorldSample[]).map((sample) => [sample.x, sample.y, pressure ? clampPressure(sample.pressure) : DEFAULT_PRESSURE]),
    strokeOutlineOptions(stroke.style.width, pressure, strokeStreamline(stroke.dynamics))
  )
  if (outline.length < 2) return null
  const path = new Path2D()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  outline.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  })
  path.closePath()
  const entry = { path, minX, minY, maxX, maxY }
  strokePathCache.set(stroke, entry)
  return entry
}

/** World-space bounds of a set of strokes (for the selection box). */
function strokesBounds(strokes: BoardInkStroke[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    const entry = getCachedStrokePath(stroke)
    if (!entry) continue
    minX = Math.min(minX, entry.minX)
    minY = Math.min(minY, entry.minY)
    maxX = Math.max(maxX, entry.maxX)
    maxY = Math.max(maxY, entry.maxY)
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}

export type BoardInkStroke = InkStroke & {
  samples: InkBoardWorldSample[]
}

type StrokePoint = [number, number, number]

const DEFAULT_PRESSURE = 0.5

function clampPressure(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PRESSURE
  return Math.min(1, Math.max(0, value))
}

function drawStrokePolygon(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  opacity: number
): void {
  if (points.length < 2) return

  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0], points[index][1])
  }
  context.closePath()
  context.fillStyle = color
  context.globalAlpha = opacity
  context.fill()
  context.globalAlpha = 1
}

function worldToScreenPoint(
  sample: Pick<InkBoardWorldSample, 'x' | 'y'>,
  viewport: { x: number; y: number; zoom: number }
): [number, number] {
  return [sample.x * viewport.zoom + viewport.x, sample.y * viewport.zoom + viewport.y]
}

function buildStrokeOutline(
  samples: InkBoardWorldSample[],
  viewport: { x: number; y: number; zoom: number },
  width: number,
  pressure = true,
  streamline = LIVE_STREAMLINE
): Array<[number, number]> {
  const points: StrokePoint[] = samples.map((sample) => {
    const [x, y] = worldToScreenPoint(sample, viewport)
    return [x, y, pressure ? clampPressure(sample.pressure) : DEFAULT_PRESSURE]
  })

  return getStroke(points, strokeOutlineOptions(width * viewport.zoom, pressure, streamline))
}

function makeSample(event: PointerEvent, viewport: { x: number; y: number; zoom: number }, bounds: DOMRect): InkBoardWorldSample {
  const localX = event.clientX - bounds.left
  const localY = event.clientY - bounds.top

  return {
    x: (localX - viewport.x) / viewport.zoom,
    y: (localY - viewport.y) / viewport.zoom,
    pressure: clampPressure(event.pressure),
    t: event.timeStamp
  }
}

function isValidPointerSample(event: PointerEvent): boolean {
  return Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
}

const MIN_ZOOM = BOARD_MIN_ZOOM
const MAX_ZOOM = BOARD_MAX_ZOOM

export function InkOverlay({
  active,
  activeTool,
  penStyle,
  acetateVisible,
  acetateStrokes,
  onTransfer,
  onEraseComplete,
  selectedStrokeIds = NO_SELECTION,
  selectedStrokeOffset = null,
  onSelectedStrokesDrag
}: InkOverlayProps) {
  const viewport = useViewport()
  const resolvedTheme = useResolvedTheme()
  const { setViewport, getViewport } = useReactFlow()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const acetateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const panPointerIdRef = useRef<number | null>(null)
  const panLastXRef = useRef<number>(0)
  const panLastYRef = useRef<number>(0)
  const currentSamplesRef = useRef<InkBoardWorldSample[]>([])
  const erasedIdsRef = useRef<Set<string>>(new Set())
  const acetateStrokesRef = useRef<BoardInkStroke[]>(acetateStrokes)
  const activeToolRef = useRef<InkTool>(activeTool)
  const onEraseCompleteRef = useRef(onEraseComplete)
  const setViewportRef = useRef(setViewport)
  const getViewportRef = useRef(getViewport)
  useEffect(() => { setViewportRef.current = setViewport }, [setViewport])
  useEffect(() => { getViewportRef.current = getViewport }, [getViewport])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, pixelRatio: 1 })
  const [erasedIds, setErasedIds] = useState<ReadonlySet<string>>(new Set())
  // Live stroke is drawn imperatively (no React render per pen sample).
  const predictedSamplesRef = useRef<InkBoardWorldSample[]>([])
  const lastSampleTimeRef = useRef(0)
  const lastSampleKeyRef = useRef('')
  const canvasSizeRef = useRef(canvasSize)
  canvasSizeRef.current = canvasSize
  const themeRef = useRef(resolvedTheme)
  themeRef.current = resolvedTheme
  /** The finished stroke stays on the glass until the acetate has drawn it (no flicker). */
  const clearGlassAfterCommitRef = useRef(false)

  useEffect(() => { acetateStrokesRef.current = acetateStrokes }, [acetateStrokes])
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  const penStyleRef = useRef<InkPenStyle>(penStyle)
  useEffect(() => { penStyleRef.current = penStyle }, [penStyle])

  /** Draw the in-progress stroke (+ predicted tip) straight onto the low-latency glass canvas. */
  const drawLiveStroke = useCallback(() => {
    const canvas = glassCanvasRef.current
    if (!canvas) return
    const context = getGlassContext(canvas)
    if (!context) return
    const size = canvasSizeRef.current
    context.setTransform(size.pixelRatio, 0, 0, size.pixelRatio, 0, 0)
    context.clearRect(0, 0, size.width, size.height)
    const samples = currentSamplesRef.current
    if (samples.length < 1) return
    const style = penStyleRef.current
    if (style.raw) {
      const vp = getViewportRef.current()
      const points = samples.map((s) => [s.x * vp.zoom + vp.x, s.y * vp.zoom + vp.y] as [number, number])
      strokeRawPath(
        context,
        rawStrokePath(points),
        style.width * vp.zoom,
        displayInkColor(style.color, themeRef.current),
        DEFAULT_INK_STROKE_STYLE.opacity
      )
      return
    }
    const withPrediction =
      predictedSamplesRef.current.length > 0 ? [...samples, ...predictedSamplesRef.current] : samples
    if (withPrediction.length < 2) return
    const outline = buildStrokeOutline(withPrediction, getViewportRef.current(), style.width, style.pressure)
    drawStrokePolygon(context, outline, displayInkColor(style.color, themeRef.current), DEFAULT_INK_STROKE_STYLE.opacity)
  }, [])

  // Eraser guide: a small dot under the pointer, in the user's crosshair color.
  // Positioned imperatively (no re-render per mouse move).
  const eraserDotRef = useRef<HTMLDivElement | null>(null)
  const crosshairColor = useAppSettingsStore((s) => s.appearance.crosshairColor)
  const eraserDotColor = crosshairColor ?? (resolvedTheme === 'dark' ? '#f2f2f2' : '#111111')
  const eraserDotHalo = isLightHex(eraserDotColor) ? 'rgba(17, 17, 17, 0.85)' : 'rgba(255, 255, 255, 0.95)'
  const positionEraserDot = (event: PointerEvent): void => {
    const dot = eraserDotRef.current
    const root = rootRef.current
    if (!dot || !root) return
    if (activeToolRef.current !== 'eraser') {
      dot.style.opacity = '0'
      return
    }
    const bounds = root.getBoundingClientRect()
    dot.style.transform = `translate(${event.clientX - bounds.left}px, ${event.clientY - bounds.top}px)`
    dot.style.opacity = '1'
  }
  useEffect(() => {
    if ((!active || activeTool !== 'eraser') && eraserDotRef.current) eraserDotRef.current.style.opacity = '0'
  }, [active, activeTool])
  useEffect(() => { onEraseCompleteRef.current = onEraseComplete }, [onEraseComplete])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      const pixelRatio = window.devicePixelRatio || 1
      setCanvasSize({ width, height, pixelRatio })
    })

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const configureCanvas = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      canvas.width = Math.max(1, Math.floor(canvasSize.width * canvasSize.pixelRatio))
      canvas.height = Math.max(1, Math.floor(canvasSize.height * canvasSize.pixelRatio))
      canvas.style.width = `${canvasSize.width}px`
      canvas.style.height = `${canvasSize.height}px`

      const context = canvas === glassCanvasRef.current ? getGlassContext(canvas) : canvas.getContext('2d')
      if (!context) return
      context.setTransform(canvasSize.pixelRatio, 0, 0, canvasSize.pixelRatio, 0, 0)
    }

    configureCanvas(glassCanvasRef.current)
    configureCanvas(acetateCanvasRef.current)
  }, [canvasSize])

  // Re-draw the live stroke if the view changes mid-stroke (e.g. zooming while drawing).
  useEffect(() => {
    drawLiveStroke()
  }, [viewport, canvasSize, drawLiveStroke])

  useEffect(() => {
    const canvas = acetateCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const pr = canvasSize.pixelRatio
    context.setTransform(pr, 0, 0, pr, 0, 0)
    context.clearRect(0, 0, canvasSize.width, canvasSize.height)
    if (!acetateVisible) return

    // Visible world rect (skip strokes entirely off screen).
    const viewMinX = -viewport.x / viewport.zoom
    const viewMinY = -viewport.y / viewport.zoom
    const viewMaxX = viewMinX + canvasSize.width / viewport.zoom
    const viewMaxY = viewMinY + canvasSize.height / viewport.zoom

    for (const stroke of acetateStrokes) {
      if (erasedIds.has(stroke.id)) continue
      const entry = getCachedStrokePath(stroke)
      if (!entry) continue
      const isSelected = selectedStrokeIds.has(stroke.id)
      const dx = isSelected && selectedStrokeOffset ? selectedStrokeOffset.dx : 0
      const dy = isSelected && selectedStrokeOffset ? selectedStrokeOffset.dy : 0
      if (
        entry.maxX + dx < viewMinX ||
        entry.minX + dx > viewMaxX ||
        entry.maxY + dy < viewMinY ||
        entry.minY + dy > viewMaxY
      ) {
        continue
      }

      const scale = pr * viewport.zoom
      context.setTransform(scale, 0, 0, scale, pr * viewport.x + dx * scale, pr * viewport.y + dy * scale)
      if (isSelected) {
        // Selection halo under the stroke.
        context.globalAlpha = 0.5
        context.lineJoin = 'round'
        context.lineCap = 'round'
        context.lineWidth = 6 / viewport.zoom + (entry.raw ? entry.raw.width : 0)
        context.strokeStyle = '#1e87ff'
        context.stroke(entry.path)
      }
      if (entry.raw) {
        strokeRawPath(context, entry.path, entry.raw.width, displayInkColor(stroke.style.color, resolvedTheme), stroke.style.opacity)
        continue
      }
      context.globalAlpha = stroke.style.opacity
      context.fillStyle = displayInkColor(stroke.style.color, resolvedTheme)
      context.fill(entry.path)
    }
    context.globalAlpha = 1
    context.setTransform(pr, 0, 0, pr, 0, 0)

    if (clearGlassAfterCommitRef.current && activePointerIdRef.current === null) {
      clearGlassAfterCommitRef.current = false
      currentSamplesRef.current = []
      predictedSamplesRef.current = []
      drawLiveStroke()
    }
  }, [acetateStrokes, acetateVisible, canvasSize.height, canvasSize.width, canvasSize.pixelRatio, viewport, erasedIds, resolvedTheme, selectedStrokeIds, selectedStrokeOffset])

  useEffect(() => {
    if (active) return
    activePointerIdRef.current = null
    panPointerIdRef.current = null
    currentSamplesRef.current = []
    predictedSamplesRef.current = []
    drawLiveStroke()
    erasedIdsRef.current = new Set()
    setErasedIds(new Set())
  }, [active, drawLiveStroke])

  useEffect(() => {
    if (activePointerIdRef.current === null && erasedIds.size > 0) {
      erasedIdsRef.current = new Set()
      setErasedIds(new Set())
    }
  }, [acetateStrokes, erasedIds.size])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // pointerrawupdate fires as soon as the pen reports (not aligned to frames).
    const usesRawUpdates = 'onpointerrawupdate' in window

    /** Append every pen sample since the last event (coalesced), then draw. */
    const addPenSamples = (event: PointerEvent): void => {
      if (activePointerIdRef.current !== event.pointerId) return
      const bounds = root.getBoundingClientRect()
      const vp = getViewportRef.current()
      // Direct ink keeps every distinct pen point (no spacing filter).
      const minSpacing = penStyleRef.current.raw ? 0.0001 : DEFAULT_INK_STROKE_DYNAMICS.sampleSpacing / Math.max(1, vp.zoom)
      const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : []
      const sources = coalesced.length > 0 ? coalesced : [event]
      const samples = currentSamplesRef.current
      for (const source of sources) {
        if (!isValidPointerSample(source)) continue
        // pointerrawupdate and pointermove report the same samples: keep each once.
        // A duplicate has the same timestamp AND position; distinct fast samples can
        // share a timestamp, so time alone must not drop them (that lost quick strokes).
        if (source.timeStamp < lastSampleTimeRef.current) continue
        const key = `${source.timeStamp}:${source.clientX}:${source.clientY}`
        if (key === lastSampleKeyRef.current) continue
        lastSampleTimeRef.current = source.timeStamp
        lastSampleKeyRef.current = key
        const sample = makeSample(source, vp, bounds)
        const last = samples[samples.length - 1]
        if (last && Math.hypot(sample.x - last.x, sample.y - last.y) < minSpacing) continue
        samples.push(sample)
      }
      // No predicted points: the browser's prediction jumps around between samples and
      // made the stroke tip wobble like a shaking stick. Drawing in the event on a
      // low-latency canvas already keeps the tip under the pen.
      predictedSamplesRef.current = []
      drawLiveStroke()
      event.preventDefault()
    }

    const handlePointerRawUpdate = (event: Event): void => {
      if (!active || activeToolRef.current !== 'pen') return
      addPenSamples(event as PointerEvent)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!active) return

      // Middle mouse button — pan the canvas
      if (event.button === 1) {
        panPointerIdRef.current = event.pointerId
        panLastXRef.current = event.clientX
        panLastYRef.current = event.clientY
        root.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }

      if (event.button !== 0) return
      if (!isValidPointerSample(event)) return

      const tool = activeToolRef.current
      activePointerIdRef.current = event.pointerId
      root.setPointerCapture(event.pointerId)

      if (tool === 'pen') {
        const bounds = root.getBoundingClientRect()
        const sample = makeSample(event, getViewportRef.current(), bounds)
        currentSamplesRef.current = [sample]
        lastSampleTimeRef.current = event.timeStamp
        lastSampleKeyRef.current = `${event.timeStamp}:${event.clientX}:${event.clientY}`
        predictedSamplesRef.current = []
        clearGlassAfterCommitRef.current = false
        drawLiveStroke()
        erasedIdsRef.current = new Set()
        setErasedIds(new Set())
      } else if (tool === 'eraser') {
        erasedIdsRef.current = new Set()
        setErasedIds(new Set())
      }

      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!active) return
      positionEraserDot(event)

      // Middle mouse button pan
      if (panPointerIdRef.current === event.pointerId) {
        const dx = event.clientX - panLastXRef.current
        const dy = event.clientY - panLastYRef.current
        panLastXRef.current = event.clientX
        panLastYRef.current = event.clientY
        const vp = getViewportRef.current()
        setViewportRef.current({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom })
        event.preventDefault()
        return
      }

      if (activePointerIdRef.current !== event.pointerId) return
      if (!isValidPointerSample(event)) return

      const tool = activeToolRef.current

      if (tool === 'pen') {
        // Raw updates usually delivered these already; duplicates are skipped by timestamp.
        addPenSamples(event)
      } else if (tool === 'eraser') {
        const bounds = root.getBoundingClientRect()
        const worldX = (event.clientX - bounds.left - getViewportRef.current().x) / getViewportRef.current().zoom
        const worldY = (event.clientY - bounds.top - getViewportRef.current().y) / getViewportRef.current().zoom
        const eraserWorldRadius = ERASER_SCREEN_RADIUS / getViewportRef.current().zoom

        const strokes = acetateStrokesRef.current
        let changed = false
        for (const stroke of strokes) {
          if (erasedIdsRef.current.has(stroke.id)) continue
          for (const sample of stroke.samples) {
            if (Math.hypot(sample.x - worldX, sample.y - worldY) <= eraserWorldRadius) {
              erasedIdsRef.current.add(stroke.id)
              changed = true
              break
            }
          }
        }
        if (changed) setErasedIds(new Set(erasedIdsRef.current))
      }

      event.preventDefault()
    }

    const finalizeStroke = (event: PointerEvent, includeFinalSample: boolean) => {
      // Release MMB pan
      if (panPointerIdRef.current === event.pointerId) {
        panPointerIdRef.current = null
        try { root.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
        event.preventDefault()
        return
      }

      if (activePointerIdRef.current !== event.pointerId) return

      const tool = activeToolRef.current

      if (tool === 'pen') {
        const bounds = includeFinalSample ? root.getBoundingClientRect() : null
        const finalSample =
          includeFinalSample && bounds !== null && isValidPointerSample(event)
            ? makeSample(event, getViewportRef.current(), bounds)
            : null

        const previous = currentSamplesRef.current
        const samples =
          finalSample !== null &&
          previous.length > 0 &&
          Math.hypot(finalSample.x - previous[previous.length - 1].x, finalSample.y - previous[previous.length - 1].y) > 0
            ? [...previous, finalSample]
            : previous

        activePointerIdRef.current = null
        predictedSamplesRef.current = []
        // Direct ink keeps single taps (a dot); smoothed ink needs at least two points.
        const keepStroke = samples.length > 1 || (penStyleRef.current.raw && samples.length === 1)

        if (keepStroke) {
          // Keep it on the glass until the acetate redraw shows the committed stroke;
          // fall back to clearing shortly after in case nothing is committed.
          currentSamplesRef.current = samples
          drawLiveStroke()
          clearGlassAfterCommitRef.current = true
          window.setTimeout(() => {
            if (clearGlassAfterCommitRef.current && activePointerIdRef.current === null) {
              clearGlassAfterCommitRef.current = false
              currentSamplesRef.current = []
              drawLiveStroke()
            }
          }, 400)
        } else {
          currentSamplesRef.current = []
          drawLiveStroke()
        }

        if (keepStroke) {
          onTransfer({
            id: crypto.randomUUID(),
            tool: 'pen',
            style: {
              ...DEFAULT_INK_STROKE_STYLE,
              color: penStyleRef.current.color,
              width: penStyleRef.current.width
            },
            dynamics: {
              ...DEFAULT_INK_STROKE_DYNAMICS,
              pressure: penStyleRef.current.raw ? false : penStyleRef.current.pressure,
              streamline: LIVE_STREAMLINE,
              ...(penStyleRef.current.raw ? { raw: true } : {})
            },
            samples,
            createdAt: new Date().toISOString()
          })
        }
      } else if (tool === 'eraser') {
        activePointerIdRef.current = null
        const hitIds = erasedIdsRef.current
        if (hitIds.size > 0) {
          const strokes = acetateStrokesRef.current
          const erasedStrokes = strokes.filter((s) => hitIds.has(s.id))
          if (erasedStrokes.length > 0) {
            onEraseCompleteRef.current(erasedStrokes)
          }
        }
        // erasedIdsRef is intentionally left populated so the acetate doesn't flash
        // the strokes back before the parent removes them from acetateStrokes.
        // It will be cleared at the start of the next gesture.
      }

      try {
        root.releasePointerCapture(event.pointerId)
      } catch {
        // ignore release failures if the pointer capture lifecycle already completed
      }
      event.preventDefault()
    }

    const handlePointerUp = (event: PointerEvent) => {
      finalizeStroke(event, true)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      finalizeStroke(event, false)
    }

    const handlePointerLeave = (): void => {
      if (eraserDotRef.current) eraserDotRef.current.style.opacity = '0'
    }

    root.addEventListener('pointerdown', handlePointerDown)
    root.addEventListener('pointermove', handlePointerMove)
    if (usesRawUpdates) root.addEventListener('pointerrawupdate', handlePointerRawUpdate)
    root.addEventListener('pointerleave', handlePointerLeave)
    root.addEventListener('pointerup', handlePointerUp)
    root.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      root.removeEventListener('pointerdown', handlePointerDown)
      root.removeEventListener('pointermove', handlePointerMove)
      if (usesRawUpdates) root.removeEventListener('pointerrawupdate', handlePointerRawUpdate)
      root.removeEventListener('pointerleave', handlePointerLeave)
      root.removeEventListener('pointerup', handlePointerUp)
      root.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [active, onTransfer, drawLiveStroke])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handleWheel = (event: WheelEvent) => {
      if (!active) return
      event.preventDefault()

      const vp = getViewportRef.current()
      const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * zoomFactor))

      // Keep the point under the cursor fixed while zooming
      const bounds = root.getBoundingClientRect()
      const mouseX = event.clientX - bounds.left
      const mouseY = event.clientY - bounds.top
      const worldX = (mouseX - vp.x) / vp.zoom
      const worldY = (mouseY - vp.y) / vp.zoom

      setViewportRef.current({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom,
        zoom: newZoom
      })
    }

    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => root.removeEventListener('wheel', handleWheel)
  }, [active])

  const selectionDragRef = useRef<{ startX: number; startY: number } | null>(null)
  const selectionBox = useMemo(() => {
    if (active || !acetateVisible || selectedStrokeIds.size === 0) return null
    const bounds = strokesBounds(acetateStrokes.filter((s) => selectedStrokeIds.has(s.id)))
    if (!bounds) return null
    const dx = selectedStrokeOffset?.dx ?? 0
    const dy = selectedStrokeOffset?.dy ?? 0
    const pad = 6
    return {
      left: (bounds.minX + dx) * viewport.zoom + viewport.x - pad,
      top: (bounds.minY + dy) * viewport.zoom + viewport.y - pad,
      width: (bounds.maxX - bounds.minX) * viewport.zoom + pad * 2,
      height: (bounds.maxY - bounds.minY) * viewport.zoom + pad * 2
    }
  }, [active, acetateVisible, acetateStrokes, selectedStrokeIds, selectedStrokeOffset, viewport])

  return (
    <div
      ref={rootRef}
      className={`ink-overlay${active ? ' ink-overlay--active' : ''}`}
      aria-hidden="true"
    >
      <canvas
        ref={acetateCanvasRef}
        className={`ink-overlay__canvas ink-overlay__canvas--acetate${acetateVisible ? ' ink-overlay__canvas--visible' : ''}`}
      />
      <canvas
        ref={glassCanvasRef}
        className={`ink-overlay__canvas ink-overlay__canvas--glass${active ? ' ink-overlay__canvas--visible' : ''}`}
      />
      <div
        ref={eraserDotRef}
        className="ink-overlay__eraser-dot"
        style={{ ['--eraser-dot-color' as string]: eraserDotColor, ['--eraser-dot-halo' as string]: eraserDotHalo }}
      />
      {selectionBox ? (
        <div
          className="ink-overlay__selection-box nodrag nopan"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !onSelectedStrokesDrag) return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            selectionDragRef.current = { startX: event.clientX, startY: event.clientY }
          }}
          onPointerMove={(event) => {
            const drag = selectionDragRef.current
            if (!drag || !onSelectedStrokesDrag) return
            const zoom = getViewportRef.current().zoom || 1
            onSelectedStrokesDrag((event.clientX - drag.startX) / zoom, (event.clientY - drag.startY) / zoom, false)
          }}
          onPointerUp={(event) => {
            const drag = selectionDragRef.current
            if (!drag || !onSelectedStrokesDrag) return
            selectionDragRef.current = null
            const zoom = getViewportRef.current().zoom || 1
            onSelectedStrokesDrag((event.clientX - drag.startX) / zoom, (event.clientY - drag.startY) / zoom, true)
          }}
        />
      ) : null}
    </div>
  )
}
