import { useMemo } from 'react'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import type { InkPenStyle } from './InkOverlay'

/**
 * Pen colors, laid out like Microsoft Whiteboard's pen tray: neutrals first,
 * then a warm-to-cool sweep. Values lean on the Whitebloom palette where possible.
 */
export const INK_PEN_COLORS: Array<{ id: string; value: string }> = [
  { id: 'black', value: '#111111' },
  { id: 'charcoal', value: '#2b2b2b' },
  { id: 'slate', value: '#6b7280' },
  { id: 'silver', value: '#c4c8cf' },
  { id: 'white', value: '#ffffff' },
  { id: 'brown', value: '#8b5a2b' },
  { id: 'red', value: '#ec164c' },
  { id: 'pink', value: '#ff285a' },
  { id: 'orange', value: '#ff6b2b' },
  { id: 'yellow', value: '#ffc21a' },
  { id: 'lime', value: '#8bd317' },
  { id: 'green', value: '#00b86b' },
  { id: 'teal', value: '#0bbcd4' },
  { id: 'blue', value: '#1e87ff' },
  { id: 'navy', value: '#1f3a8a' },
  { id: 'purple', value: '#7c35ff' },
  { id: 'magenta', value: '#d63bd1' },
  { id: 'lavender', value: '#b9a3ff' }
]

/** Quick thickness presets shown as dots, like Whiteboard's size row. */
export const PEN_WIDTH_PRESETS = [1, 2, 4, 8, 16] as const

/** Current pen style, read from (and persisted to) the app settings. */
export function useInkPenStyle(): InkPenStyle {
  const color = useAppSettingsStore((s) => s.ink.penColor)
  const width = useAppSettingsStore((s) => s.ink.penWidth)
  const pressure = useAppSettingsStore((s) => s.ink.pressureSensitive)
  return useMemo(() => ({ color, width, pressure }), [color, width, pressure])
}

/** Diameter of the preview dot for a given pen width, clamped to fit a 26px button. */
export function previewDotSize(width: number, max = 16): number {
  return Math.max(4, Math.min(max, 3 + width * 0.8))
}
