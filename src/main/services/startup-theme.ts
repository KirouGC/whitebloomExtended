import type { ThemePreference } from '../../shared/app-settings'

let startupTheme: ThemePreference = 'light'

/** Remembered from the settings read at startup, before the window is created. */
export function setStartupTheme(theme: ThemePreference): void {
  startupTheme = theme
}

export function getStartupTheme(): ThemePreference {
  return startupTheme
}
