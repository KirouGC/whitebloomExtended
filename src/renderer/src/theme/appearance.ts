import { useEffect, useSyncExternalStore } from 'react'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import type { ThemePreference } from '../../../shared/app-settings'

export type ResolvedTheme = 'light' | 'dark'

const THEME_CACHE_KEY = 'wb:theme'

/** Call before the first render to avoid a light flash when the user prefers dark. */
export function applyCachedThemeEarly(): void {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY)
    if (cached === 'light' || cached === 'dark' || cached === 'system') {
      document.documentElement.dataset.theme = resolveTheme(cached)
    }
  } catch {
    // ignore
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

/**
 * Builds a crosshair cursor (24×24, hotspot at the center) in the given color.
 * A contrasting halo keeps it visible on both light and dark canvases.
 */
export function buildCrosshairCursor(color: string): string {
  const halo = isDarkColor(color) ? '#ffffff' : '#111111'
  const lines = 'M12 1v8M12 15v8M1 12h8M15 12h8'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<path d="${lines}" stroke="${halo}" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="${lines}" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<circle cx="12" cy="12" r="1.2" fill="${color}"/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`
}

function isDarkColor(hex: string): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return true
  const full = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5
}

/**
 * Applies appearance settings to the document: `data-theme` on <html> (drives the
 * dark token overrides) and the custom crosshair cursor CSS variable.
 */
export function useApplyAppearance(): void {
  const theme = useAppSettingsStore((s) => s.appearance.theme)
  const crosshairColor = useAppSettingsStore((s) => s.appearance.crosshairColor)

  useEffect(() => {
    const root = document.documentElement
    const apply = (): void => {
      const resolved = resolveTheme(theme)
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
    }
    // Cache the preference so the next launch paints in the right theme before
    // the settings file has been read (see applyCachedThemeEarly).
    try {
      localStorage.setItem(THEME_CACHE_KEY, theme)
    } catch {
      // storage unavailable — the theme still applies once settings load
    }
    apply()
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (crosshairColor) root.style.setProperty('--wb-crosshair-cursor', buildCrosshairCursor(crosshairColor))
    else root.style.removeProperty('--wb-crosshair-cursor')
  }, [crosshairColor])
}

function subscribeSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** Current resolved theme, reactive to settings and (for 'system') the OS. */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useAppSettingsStore((s) => s.appearance.theme)
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false)
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

/**
 * Like Microsoft Whiteboard, near-black ink is shown as near-white on a dark board
 * (and vice versa) so default-colored strokes stay readable. Stored colors are untouched.
 */
export function displayInkColor(color: string, theme: ResolvedTheme): string {
  const c = color.toLowerCase()
  if (theme === 'dark' && (c === '#111111' || c === '#000000' || c === '#2b2b2b')) return '#f2f2f2'
  return color
}
