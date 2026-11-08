import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, Pen, Plus, Trash2 } from 'lucide-react'
import { CanvasToolbar, CanvasToolbarBtn, CanvasToolbarSep, useCanvasToolbarPopover } from './CanvasToolbar'
import { CanvasPopover } from './CanvasPopover'
import { ShortcutTip } from '@renderer/components/petal/ShortcutTip'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import { MAX_PEN_WIDTH, MIN_PEN_WIDTH } from '../../../shared/app-settings'
import { INK_PEN_COLORS, PEN_WIDTH_PRESETS, previewDotSize, useInkPenStyle } from './inkPen'
import './CanvasPopover.css'
import './InkToolbar.css'

export type InkTool = 'pen' | 'eraser'

// ── Pen style popover ─────────────────────────────────────────────────────────

type PenStyleControlProps = {
  popoverId: string
}

function PenStyleControl({ popoverId }: PenStyleControlProps): React.JSX.Element {
  const { t } = useTranslation()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)
  const popoverContentRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const penStyle = useInkPenStyle()
  const updatePenStyle = useAppSettingsStore((s) => s.updatePenStyle)

  useEffect(() => {
    if (!open) return
    const handleDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (controlRef.current?.contains(target)) return
      if (popoverContentRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, setOpen])

  const isPresetColor = INK_PEN_COLORS.some((c) => c.value === penStyle.color.toLowerCase())
  const dot = previewDotSize(penStyle.width)

  return (
    <div className="canvas-control" ref={controlRef}>
      <ShortcutTip label={t('inkToolbar.penStyleLabel')}>
        <CanvasToolbarBtn popoverId={popoverId} active={open} aria-label={t('inkToolbar.penStyleLabel')}>
          <span
            className="ink-pen-dot"
            style={{ width: dot, height: dot, backgroundColor: penStyle.color }}
          />
        </CanvasToolbarBtn>
      </ShortcutTip>

      {open && (
        <CanvasPopover anchorRef={controlRef}>
          <div className="ink-pen-picker" ref={popoverContentRef}>
            <div className="canvas-popover__label">{t('inkToolbar.colorLabel')}</div>
            <div className="ink-pen-picker__colors" role="listbox" aria-label={t('inkToolbar.colorLabel')}>
              {INK_PEN_COLORS.map((c) => {
                const selected = penStyle.color.toLowerCase() === c.value
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={c.value}
                    title={c.value}
                    className={`ink-pen-picker__color${selected ? ' ink-pen-picker__color--selected' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => void updatePenStyle({ penColor: c.value })}
                  />
                )
              })}
              <button
                type="button"
                className={`ink-pen-picker__color ink-pen-picker__color--custom${!isPresetColor ? ' ink-pen-picker__color--selected' : ''}`}
                style={!isPresetColor ? { backgroundColor: penStyle.color } : undefined}
                aria-label={t('inkToolbar.customColorLabel')}
                title={t('inkToolbar.customColorLabel')}
                onClick={() => colorInputRef.current?.click()}
              >
                {isPresetColor && <Plus size={12} strokeWidth={2.2} />}
              </button>
              <input
                ref={colorInputRef}
                type="color"
                className="ink-pen-picker__native-color"
                value={penStyle.color.length === 7 ? penStyle.color : '#111111'}
                onChange={(e) => void updatePenStyle({ penColor: e.target.value })}
                tabIndex={-1}
                aria-hidden
              />
            </div>

            <div className="canvas-popover__sep" />

            <div className="ink-pen-picker__thickness-head">
              <span className="canvas-popover__label">{t('inkToolbar.thicknessLabel')}</span>
              <span className="ink-pen-picker__value">{penStyle.width}</span>
            </div>
            <div className="ink-pen-picker__presets">
              {PEN_WIDTH_PRESETS.map((w) => {
                const size = previewDotSize(w, 18)
                return (
                  <button
                    key={w}
                    type="button"
                    className={`ink-pen-picker__preset${penStyle.width === w ? ' ink-pen-picker__preset--selected' : ''}`}
                    aria-label={`${t('inkToolbar.thicknessLabel')} ${w}`}
                    title={String(w)}
                    onClick={() => void updatePenStyle({ penWidth: w })}
                  >
                    <span style={{ width: size, height: size, backgroundColor: penStyle.color }} />
                  </button>
                )
              })}
            </div>
            <input
              type="range"
              className="ink-pen-picker__slider"
              min={MIN_PEN_WIDTH}
              max={MAX_PEN_WIDTH}
              step={0.5}
              value={penStyle.width}
              aria-label={t('inkToolbar.thicknessLabel')}
              // The popover shell prevents default on mousedown (to keep editor focus);
              // stop here so the native range drag still works.
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ['--ink-slider-fill' as string]: `${((penStyle.width - MIN_PEN_WIDTH) / (MAX_PEN_WIDTH - MIN_PEN_WIDTH)) * 100}%` }}
              onChange={(e) => void updatePenStyle({ penWidth: Number(e.target.value) })}
            />

            <label className="ink-pen-picker__check">
              <input
                type="checkbox"
                checked={penStyle.pressure}
                onChange={(e) => void updatePenStyle({ pressureSensitive: e.target.checked })}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <span>{t('inkToolbar.pressureLabel')}</span>
            </label>

            <div className="ink-pen-picker__preview" aria-hidden>
              <svg viewBox="0 0 168 40" width="168" height="40">
                <path
                  d="M10 28 C 40 6, 62 6, 84 20 S 128 34, 158 12"
                  fill="none"
                  stroke={penStyle.color}
                  strokeWidth={Math.min(penStyle.width, 24)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </CanvasPopover>
      )}
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

type InkToolbarProps = {
  activeTool: InkTool
  onToolChange: (tool: InkTool) => void
  onClearLayer: () => void
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>
}

export function InkToolbar(props: InkToolbarProps): React.JSX.Element {
  return (
    <CanvasToolbar onMouseDown={props.onMouseDown}>
      <InkToolbarContent {...props} />
    </CanvasToolbar>
  )
}

function InkToolbarContent({ activeTool, onToolChange, onClearLayer }: InkToolbarProps): React.JSX.Element {
  const { t } = useTranslation()
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const penStyle = useInkPenStyle()
  const updatePenStyle = useAppSettingsStore((s) => s.updatePenStyle)

  // Quick colors inline in the tray (Whiteboard shows several pens side by side).
  const quickColors = INK_PEN_COLORS.filter((c) =>
    ['black', 'red', 'blue', 'green', 'yellow'].includes(c.id)
  )

  return (
    <>
      <ShortcutTip label={t('inkToolbar.penLabel')} shortcut="P">
        <CanvasToolbarBtn
          active={activeTool === 'pen'}
          preserveOpenPopover
          onClick={() => {
            // Like Whiteboard: tapping the already-selected pen opens its settings.
            if (activeTool === 'pen') setOpen(!open)
            else onToolChange('pen')
          }}
          aria-label={t('inkToolbar.penLabel')}
          aria-keyshortcuts="P"
        >
          <Pen size={14} strokeWidth={1.8} />
        </CanvasToolbarBtn>
      </ShortcutTip>
      <ShortcutTip label={t('inkToolbar.eraserLabel')} shortcut="E">
        <CanvasToolbarBtn
          active={activeTool === 'eraser'}
          onClick={() => onToolChange('eraser')}
          aria-label={t('inkToolbar.eraserLabel')}
          aria-keyshortcuts="E"
        >
          <Eraser size={14} strokeWidth={1.8} />
        </CanvasToolbarBtn>
      </ShortcutTip>
      <CanvasToolbarSep />
      {quickColors.map((c) => {
        const selected = penStyle.color.toLowerCase() === c.value
        return (
          <CanvasToolbarBtn
            key={c.id}
            active={selected && activeTool === 'pen'}
            aria-label={c.value}
            title={c.value}
            onClick={() => {
              void updatePenStyle({ penColor: c.value })
              onToolChange('pen')
            }}
          >
            <span className="ink-quick-color" style={{ backgroundColor: c.value }} />
          </CanvasToolbarBtn>
        )
      })}
      <PenStyleControl popoverId={popoverId} />
      <CanvasToolbarSep />
      <ShortcutTip label={t('inkToolbar.clearLabel')}>
        <CanvasToolbarBtn onClick={onClearLayer} aria-label={t('inkToolbar.clearLabel')}>
          <Trash2 size={14} strokeWidth={1.8} />
        </CanvasToolbarBtn>
      </ShortcutTip>
    </>
  )
}
