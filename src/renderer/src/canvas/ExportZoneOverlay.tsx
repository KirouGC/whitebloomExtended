import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Download, X } from 'lucide-react'
import './ExportZoneOverlay.css'

export type ScreenRect = { x: number; y: number; width: number; height: number }

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type DragMode = { kind: 'move' } | { kind: 'resize'; handle: Handle } | { kind: 'pan' }

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_SIZE = 24

type ExportZoneOverlayProps = {
  busy: boolean
  /** Current board zoom, for the size readout in board units. */
  getZoom: () => number
  /** Pan the board under the (fixed) export area by screen pixels. */
  onPanBy: (dx: number, dy: number) => void
  /** Zoom the board around a screen point. */
  onZoomAt: (factor: number, clientX: number, clientY: number) => void
  onExport: (rect: ScreenRect) => void
  onCancel: () => void
}

function initialRect(): ScreenRect {
  const width = Math.round(window.innerWidth * 0.5)
  const height = Math.round(window.innerHeight * 0.5)
  return {
    x: Math.round((window.innerWidth - width) / 2),
    y: Math.round((window.innerHeight - height) / 2),
    width,
    height
  }
}

function clampRect(rect: ScreenRect): ScreenRect {
  const x = Math.max(0, Math.min(rect.x, window.innerWidth - MIN_SIZE))
  const y = Math.max(0, Math.min(rect.y, window.innerHeight - MIN_SIZE))
  return {
    x,
    y,
    width: Math.max(MIN_SIZE, Math.min(rect.width, window.innerWidth - x)),
    height: Math.max(MIN_SIZE, Math.min(rect.height, window.innerHeight - y))
  }
}

/**
 * Miro-style "export area" picker: dims the board, shows a rectangle that can be
 * moved, resized from its corners/edges, or redrawn by dragging on the dimmed area.
 */
export function ExportZoneOverlay({
  busy,
  getZoom,
  onPanBy,
  onZoomAt,
  onExport,
  onCancel
}: ExportZoneOverlayProps): React.JSX.Element {
  const { t } = useTranslation()
  const [rect, setRect] = useState<ScreenRect>(initialRect)
  const [panning, setPanning] = useState(false)
  const [, setZoomTick] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    lastX: number
    lastY: number
    start: ScreenRect
  } | null>(null)

  /**
   * Left button: move the area (inside) / resize (handles) / pan the board (outside).
   * Middle button: always pans the board, even inside the area.
   */
  const beginDrag = useCallback(
    (mode: DragMode) => (event: React.PointerEvent) => {
      if (busy) return
      let nextMode = mode
      if (event.button === 1) nextMode = { kind: 'pan' }
      else if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      dragRef.current = {
        mode: nextMode,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        start: rect
      }
      if (nextMode.kind === 'pan') setPanning(true)
    },
    [busy, rect]
  )

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const s = drag.start

    if (drag.mode.kind === 'pan') {
      onPanBy(event.clientX - drag.lastX, event.clientY - drag.lastY)
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      return
    }

    if (drag.mode.kind === 'move') {
      setRect(
        clampRect({
          ...s,
          x: Math.min(Math.max(0, s.x + dx), window.innerWidth - s.width),
          y: Math.min(Math.max(0, s.y + dy), window.innerHeight - s.height)
        })
      )
      return
    }

    const h = drag.mode.handle
    let left = s.x
    let top = s.y
    let right = s.x + s.width
    let bottom = s.y + s.height
    if (h.includes('w')) left = Math.min(s.x + dx, right - MIN_SIZE)
    if (h.includes('e')) right = Math.max(s.x + s.width + dx, left + MIN_SIZE)
    if (h.includes('n')) top = Math.min(s.y + dy, bottom - MIN_SIZE)
    if (h.includes('s')) bottom = Math.max(s.y + s.height + dy, top + MIN_SIZE)
    setRect(clampRect({ x: left, y: top, width: right - left, height: bottom - top }))
  }, [onPanBy])

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    setPanning(false)
    try {
      ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!busy) onCancel()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (!busy) onExport(rect)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel, onExport, rect])

  // Wheel zooms the board under the export area (native listener: needs passive: false).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      if (busy) return
      onZoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY)
      setZoomTick((v) => v + 1)
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [busy, onZoomAt])

  const zoom = getZoom() || 1
  const worldW = Math.round(rect.width / zoom)
  const worldH = Math.round(rect.height / zoom)

  return createPortal(
    <div
      ref={rootRef}
      className={`export-zone${busy ? ' export-zone--busy' : ''}${panning ? ' export-zone--panning' : ''}`}
      data-board-capture="exclude"
      onPointerDown={beginDrag({ kind: 'pan' })}
      onAuxClick={(e) => e.preventDefault()}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="export-zone__rect"
        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        onPointerDown={beginDrag({ kind: 'move' })}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="export-zone__size">
          {worldW} × {worldH}
        </span>
        {HANDLES.map((handle) => (
          <span
            key={handle}
            className={`export-zone__handle export-zone__handle--${handle}`}
            onPointerDown={beginDrag({ kind: 'resize', handle })}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </div>

      <div className="export-zone__hint">{t('exportImage.zoneHint')}</div>

      <div className="export-zone__bar" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="export-zone__btn export-zone__btn--primary"
          onClick={() => onExport(rect)}
          disabled={busy}
        >
          <Download size={14} strokeWidth={2} />
          {busy ? t('exportImage.exporting') : t('exportImage.exportButton')}
        </button>
        <button type="button" className="export-zone__btn" onClick={onCancel} disabled={busy}>
          <X size={14} strokeWidth={2} />
          {t('exportImage.cancelButton')}
        </button>
      </div>
    </div>,
    document.body
  )
}
