import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type ElementFormatType,
} from 'lexical'
import { $getSelectionStyleValueForProperty } from '@lexical/selection'
import { AlignCenter, AlignLeft, AlignRight, AArrowDown, AArrowUp, Bold, Check, ChevronDown, Italic, Scaling, Terminal } from 'lucide-react'
import { CanvasToolbar, CanvasToolbarBtn, CanvasToolbarSep, CanvasToolbarSwatch, useCanvasToolbarPopover } from './CanvasToolbar'
import { CanvasPopover } from './CanvasPopover'
import { WHITEBLOOM_DEFAULT_PALETTE, type PaletteSwatch } from './palette'
import {
  DEFAULT_TEXT_FONT_SIZE,
  TEXT_COLOR_COMMAND,
  TEXT_FONT_OPTIONS,
  TEXT_FONT_SIZES,
  TEXT_STYLE_COMMAND,
  findFontOption
} from './textEditorCommands'
import './FormatToolbar.css'

// ── Text color control ────────────────────────────────────────────────────────

type TextColorControlProps = {
  selectionColor: string
}

function TextColorControl({ selectionColor }: TextColorControlProps) {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, setOpen])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, setOpen])

  function applyColor(cssColor: string) {
    editor.dispatchCommand(TEXT_COLOR_COMMAND, cssColor)
  }

  function isSwatchActive(swatch: PaletteSwatch): boolean {
    return !!selectionColor && selectionColor.toLowerCase() === swatch.value.toLowerCase()
  }

  // The swatch shows the active selection color, falling back to the foreground token
  const displayColor = selectionColor || 'var(--color-primary-fg)'

  // Convert raw CSS color to a hex value for the native color input
  function toInputHex(): string {
    if (!selectionColor || selectionColor.startsWith('var(')) return '#2b2b2b'
    return selectionColor.startsWith('#') ? selectionColor : '#2b2b2b'
  }

  const palette = WHITEBLOOM_DEFAULT_PALETTE

  return (
    <div className="canvas-control" ref={controlRef}>
      <CanvasToolbarBtn
        aria-label={t('formatToolbar.textColorLabel')}
        popoverId={popoverId}
        active={open}
      >
        <CanvasToolbarSwatch color={displayColor} />
      </CanvasToolbarBtn>

      {open && (
        <CanvasPopover anchorRef={controlRef} className="canvas-color-picker">
          <div className="canvas-color-picker__palette-name">{palette.name}</div>

          <div className="canvas-color-picker__swatches">
            {palette.swatches.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                tabIndex={-1}
                className={`canvas-color-picker__swatch${isSwatchActive(swatch) ? ' canvas-color-picker__swatch--selected' : ''}`}
                style={{ backgroundColor: swatch.value }}
                aria-label={swatch.label}
                title={swatch.label}
                onClick={() => applyColor(swatch.value)}
              />
            ))}
          </div>

          <div className="canvas-popover__sep" />

          {/* Clear inline color — restores inherited/default text color */}
          <button
            type="button"
            className="canvas-color-picker__option"
            onClick={() => applyColor('')}
          >
            <CanvasToolbarSwatch color="var(--color-primary-fg)" />
            <span className="canvas-color-picker__custom-label">{t('formatToolbar.textColorDefault')}</span>
          </button>

          <div className="canvas-popover__sep" />

          <div
            className="canvas-color-picker__option"
            onClick={() => colorInputRef.current?.click()}
          >
            <input
              ref={colorInputRef}
              type="color"
              className="canvas-color-picker__custom-input"
              value={toInputHex()}
              onChange={(e) => applyColor(e.target.value)}
              tabIndex={-1}
            />
            <span className="canvas-color-picker__custom-label">Custom</span>
          </div>
        </CanvasPopover>
      )}
    </div>
  )
}

// ── Dropdown helper (focus-safe: never steals focus from the editor) ─────────

function useDismissablePopover(
  open: boolean,
  setOpen: (v: boolean) => void,
  controlRef: React.RefObject<HTMLElement | null>,
  listRef: React.RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!open) return
    const handleDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (controlRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [open, setOpen, controlRef, listRef])
}

// ── Font family control ───────────────────────────────────────────────────────

function FontFamilyControl({ fontFamily }: { fontFamily: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useDismissablePopover(open, setOpen, controlRef, listRef)

  const current = findFontOption(fontFamily)
  const label = current?.label ?? (fontFamily.split(',')[0]?.replace(/["']/g, '') || 'DM Sans')

  return (
    <div className="canvas-control" ref={controlRef}>
      <CanvasToolbarBtn
        className="format-toolbar__dropdown format-toolbar__dropdown--font"
        popoverId={popoverId}
        active={open}
        aria-label={t('formatToolbar.fontLabel')}
        title={t('formatToolbar.fontLabel')}
      >
        <span className="format-toolbar__dropdown-text" style={{ fontFamily: current?.value || undefined }}>
          {label}
        </span>
        <ChevronDown size={11} strokeWidth={2.2} />
      </CanvasToolbarBtn>
      {open && (
        <CanvasPopover anchorRef={controlRef} align="start">
          <div className="format-toolbar__list" ref={listRef} role="listbox" aria-label={t('formatToolbar.fontLabel')}>
            {TEXT_FONT_OPTIONS.map((font) => {
              const selected = current?.id === font.id
              return (
                <button
                  key={font.id}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={selected}
                  className={`format-toolbar__list-item${selected ? ' format-toolbar__list-item--selected' : ''}`}
                  style={{ fontFamily: font.value || '"DM Sans", sans-serif' }}
                  onClick={() => {
                    editor.dispatchCommand(TEXT_STYLE_COMMAND, { 'font-family': font.value || null })
                    setOpen(false)
                  }}
                >
                  <span className="format-toolbar__list-check">
                    {selected && <Check size={12} strokeWidth={2.4} />}
                  </span>
                  {font.label}
                </button>
              )
            })}
          </div>
        </CanvasPopover>
      )}
    </div>
  )
}

// ── Font size control ─────────────────────────────────────────────────────────

function parseFontSize(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_TEXT_FONT_SIZE
}

function FontSizeControl({ fontSize }: { fontSize: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useDismissablePopover(open, setOpen, controlRef, listRef)

  const size = parseFontSize(fontSize)

  const applySize = (next: number): void => {
    const clamped = Math.max(6, Math.min(400, Math.round(next)))
    editor.dispatchCommand(TEXT_STYLE_COMMAND, {
      'font-size': clamped === DEFAULT_TEXT_FONT_SIZE ? null : `${clamped}px`
    })
  }

  const step = (direction: 1 | -1): void => {
    const sizes = TEXT_FONT_SIZES as readonly number[]
    const next =
      direction > 0
        ? (sizes.find((s) => s > size) ?? size + 12)
        : ([...sizes].reverse().find((s) => s < size) ?? Math.max(6, size - 2))
    applySize(next)
  }

  useEffect(() => {
    if (!open) return
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    selected?.scrollIntoView({ block: 'center' })
  }, [open])

  return (
    <>
      <CanvasToolbarBtn
        onClick={() => step(-1)}
        aria-label={t('formatToolbar.decreaseSizeLabel')}
        title={t('formatToolbar.decreaseSizeLabel')}
      >
        <AArrowDown size={14} strokeWidth={1.9} />
      </CanvasToolbarBtn>
      <div className="canvas-control" ref={controlRef}>
        <CanvasToolbarBtn
          className="format-toolbar__dropdown format-toolbar__dropdown--size"
          popoverId={popoverId}
          active={open}
          aria-label={t('formatToolbar.fontSizeLabel')}
          title={t('formatToolbar.fontSizeLabel')}
        >
          <span className="format-toolbar__dropdown-text">{size}</span>
          <ChevronDown size={11} strokeWidth={2.2} />
        </CanvasToolbarBtn>
        {open && (
          <CanvasPopover anchorRef={controlRef}>
            <div
              className="format-toolbar__list format-toolbar__list--sizes"
              ref={listRef}
              role="listbox"
              aria-label={t('formatToolbar.fontSizeLabel')}
            >
              {TEXT_FONT_SIZES.map((s) => {
                const selected = s === size
                return (
                  <button
                    key={s}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={selected}
                    className={`format-toolbar__list-item${selected ? ' format-toolbar__list-item--selected' : ''}`}
                    onClick={() => {
                      applySize(s)
                      setOpen(false)
                    }}
                  >
                    <span className="format-toolbar__list-check">
                      {selected && <Check size={12} strokeWidth={2.4} />}
                    </span>
                    {s}
                  </button>
                )
              })}
            </div>
          </CanvasPopover>
        )}
      </div>
      <CanvasToolbarBtn
        onClick={() => step(1)}
        aria-label={t('formatToolbar.increaseSizeLabel')}
        title={t('formatToolbar.increaseSizeLabel')}
      >
        <AArrowUp size={14} strokeWidth={1.9} />
      </CanvasToolbarBtn>
    </>
  )
}

// ── FormatToolbar ─────────────────────────────────────────────────────────────

type FormatToolbarProps = {
  /** Whether the text box scales its text to fit its own area. */
  autoFit?: boolean
  onToggleAutoFit?: () => void
}

export function FormatToolbar({ autoFit = false, onToggleAutoFit }: FormatToolbarProps = {}): React.JSX.Element {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [selectionColor, setSelectionColor] = useState('')
  const [fontFamily, setFontFamily] = useState('')
  const [fontSize, setFontSize] = useState('')
  const [elementAlign, setElementAlign] = useState<ElementFormatType>('')

  const syncFormats = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) {
        setIsBold(false)
        setIsItalic(false)
        setIsCode(false)
        setSelectionColor('')
        setFontFamily('')
        setFontSize('')
        setElementAlign('')
        return
      }
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsCode(selection.hasFormat('code'))
      setSelectionColor($getSelectionStyleValueForProperty(selection, 'color', ''))
      setFontFamily($getSelectionStyleValueForProperty(selection, 'font-family', ''))
      setFontSize($getSelectionStyleValueForProperty(selection, 'font-size', ''))
      const anchorNode = selection.anchor.getNode()
      const element = anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow()
      const format = $isElementNode(element) ? element.getFormatType() : ''
      setElementAlign(format)
    })
  }, [editor])

  // Style changes don't always move the selection; resync on every update.
  useEffect(() => editor.registerUpdateListener(() => syncFormats()), [editor, syncFormats])

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        syncFormats()
        return false
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, syncFormats])

  return (
    <CanvasToolbar onMouseDown={(e) => e.preventDefault()}>
      <FontFamilyControl fontFamily={fontFamily} />
      <FontSizeControl fontSize={fontSize} />
      <CanvasToolbarSep />
      <CanvasToolbarBtn
        active={isBold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        aria-label={t('formatToolbar.boldLabel')}
      >
        <Bold size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarBtn
        active={isItalic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        aria-label={t('formatToolbar.italicLabel')}
      >
        <Italic size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarBtn
        active={isCode}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        aria-label={t('formatToolbar.inlineCodeLabel')}
      >
        <Terminal size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarSep />
      <CanvasToolbarBtn
        active={elementAlign === 'left' || elementAlign === ''}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
        aria-label={t('formatToolbar.alignLeftLabel')}
      >
        <AlignLeft size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarBtn
        active={elementAlign === 'center'}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
        aria-label={t('formatToolbar.alignCenterLabel')}
      >
        <AlignCenter size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarBtn
        active={elementAlign === 'right'}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
        aria-label={t('formatToolbar.alignRightLabel')}
      >
        <AlignRight size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarSep />
      <TextColorControl selectionColor={selectionColor} />
      {onToggleAutoFit && (
        <>
          <CanvasToolbarSep />
          <CanvasToolbarBtn
            active={autoFit}
            onClick={onToggleAutoFit}
            aria-label={t('formatToolbar.autoFitLabel')}
            title={t('formatToolbar.autoFitLabel')}
          >
            <Scaling size={13} strokeWidth={2.2} />
          </CanvasToolbarBtn>
        </>
      )}
    </CanvasToolbar>
  )
}
