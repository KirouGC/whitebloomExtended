import { createCommand, type LexicalCommand } from 'lexical'

/**
 * Dispatch this command inside a LexicalComposer to apply an inline CSS color
 * to the current text selection. Pass an empty string to clear the color.
 */
export const TEXT_COLOR_COMMAND: LexicalCommand<string> = createCommand('TEXT_COLOR_COMMAND')

/**
 * Inline CSS style patch for text (e.g. `{ 'font-family': '...', 'font-size': '18px' }`).
 * With a non-collapsed selection it styles the selection; with a collapsed caret it
 * styles the whole text box (Whiteboard-style) and the caret, so new typing matches.
 * A `null` value clears that property.
 */
export const TEXT_STYLE_COMMAND: LexicalCommand<Record<string, string | null>> =
  createCommand('TEXT_STYLE_COMMAND')

export const DEFAULT_TEXT_FONT_SIZE = 14

export const TEXT_FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 64, 72, 96, 120] as const

export type TextFontOption = {
  id: string
  label: string
  /** CSS font-family stack; '' means "inherit the node default". */
  value: string
}

/** Bundled fonts first (always available), then common system fonts. */
export const TEXT_FONT_OPTIONS: TextFontOption[] = [
  { id: 'dm-sans', label: 'DM Sans', value: '' },
  { id: 'source-serif', label: 'Source Serif 4', value: "'Source Serif 4', Georgia, serif" },
  { id: 'courier-prime', label: 'Courier Prime', value: "'Courier Prime', 'Courier New', monospace" },
  { id: 'source-code', label: 'Source Code Pro', value: "'Source Code Pro', Consolas, monospace" },
  { id: 'segoe-ui', label: 'Segoe UI', value: "'Segoe UI', system-ui, sans-serif" },
  { id: 'arial', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { id: 'calibri', label: 'Calibri', value: 'Calibri, Carlito, sans-serif' },
  { id: 'verdana', label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { id: 'georgia', label: 'Georgia', value: 'Georgia, serif' },
  { id: 'times', label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { id: 'comic', label: 'Comic Sans MS', value: "'Comic Sans MS', 'Comic Neue', cursive" },
  { id: 'ink-free', label: 'Ink Free', value: "'Ink Free', 'Segoe Print', 'Bradley Hand', cursive" },
  { id: 'impact', label: 'Impact', value: "Impact, 'Arial Black', sans-serif" }
]

/** Normalize a stored font-family value for comparison (quotes/spacing vary). */
export function normalizeFontFamily(value: string): string {
  return value.replace(/["']/g, '').replace(/\s*,\s*/g, ',').trim().toLowerCase()
}

export function findFontOption(value: string): TextFontOption | undefined {
  const normalized = normalizeFontFamily(value)
  if (!normalized) return TEXT_FONT_OPTIONS[0]
  return TEXT_FONT_OPTIONS.find((f) => f.value && normalizeFontFamily(f.value) === normalized)
    ?? TEXT_FONT_OPTIONS.find((f) => normalizeFontFamily(f.value).split(',')[0] === normalized.split(',')[0])
}
