import { create } from 'zustand'
import {
  DEFAULT_APP_SETTINGS,
  normalizeCommandAlias,
  normalizeAppSettings,
  normalizeHexColor,
  normalizeLanguage,
  normalizePenWidth,
  normalizeQuickAccessFolders,
  normalizeUsername,
  type AppSettings,
  type ThemePreference,
  type UnhandledDropBehavior
} from '../../../shared/app-settings'
import i18n, { LANGUAGE_CACHE_KEY } from '../i18n'
import { normalizeFolderKey } from '../../../shared/quick-access'
import { createLogger } from '../../../shared/logger'
import { useBoardStore } from './board'

type AppSettingsState = AppSettings & {
  isHydrated: boolean
  loadAppSettings: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
  updateUnhandledDrop: (behavior: UnhandledDropBehavior) => Promise<void>
  updateWarnLargeImport: (warn: boolean) => Promise<void>
  updateLanguage: (lang: string) => Promise<void>
  updateCommandAlias: (commandId: string, alias: string) => Promise<void>
  updateTheme: (theme: ThemePreference) => Promise<void>
  updateCrosshairColor: (color: string | null) => Promise<void>
  updatePenStyle: (style: Partial<AppSettings['ink']>) => Promise<void>
  addQuickAccessFolder: (folderPath: string) => Promise<void>
  removeQuickAccessFolder: (folderPath: string) => Promise<void>
  setQuickAccessNeverAsk: (neverAsk: boolean) => Promise<void>
}

function rememberLanguage(language: string): void {
  try {
    localStorage.setItem(LANGUAGE_CACHE_KEY, language)
  } catch {
    // storage unavailable — the language still applies once settings load
  }
}

function pickSettings(state: AppSettingsState): AppSettings {
  return {
    user: state.user,
    files: state.files,
    commands: state.commands,
    language: state.language,
    appearance: state.appearance,
    ink: state.ink,
    quickAccess: state.quickAccess
  }
}

// Debounce disk writes for settings that change rapidly (e.g. dragging a slider).
let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(getState: () => AppSettingsState): void {
  if (pendingSaveTimer) clearTimeout(pendingSaveTimer)
  pendingSaveTimer = setTimeout(() => {
    pendingSaveTimer = null
    void window.api.saveAppSettings(pickSettings(getState())).then((result) => {
      if (!result.ok) logger.error('failed to persist app settings')
    })
  }, 300)
}

const logger = createLogger('app-settings')

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...DEFAULT_APP_SETTINGS,
  isHydrated: false,

  loadAppSettings: async () => {
    const settings = normalizeAppSettings(await window.api.loadAppSettings())
    set({ ...settings, isHydrated: true })
    useBoardStore.getState().setActiveUsername(settings.user.username)
    rememberLanguage(settings.language)
    await i18n.changeLanguage(settings.language)
  },

  updateUsername: async (username) => {
    const next: AppSettings = {
      ...get(),
      user: { username: normalizeUsername(username) }
    }
    set(next)
    useBoardStore.getState().setActiveUsername(next.user.username)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateUnhandledDrop: async (behavior) => {
    const next: AppSettings = { ...get(), files: { ...get().files, unhandledDrop: behavior } }
    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateWarnLargeImport: async (warn) => {
    const next: AppSettings = { ...get(), files: { ...get().files, warnLargeImport: warn } }
    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateLanguage: async (lang) => {
    const normalized = normalizeLanguage(lang)
    const next: AppSettings = { ...get(), language: normalized }
    set(next)
    rememberLanguage(normalized)
    await i18n.changeLanguage(normalized)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    await window.api.setLanguage(normalized)
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateCommandAlias: async (commandId, alias) => {
    const normalizedCommandId = commandId.trim()
    if (!normalizedCommandId) return

    const normalizedAlias = normalizeCommandAlias(alias)
    const existingAliases = { ...get().commands.aliases }

    for (const [existingCommandId, existingAlias] of Object.entries(existingAliases)) {
      if (existingCommandId !== normalizedCommandId && existingAlias === normalizedAlias) {
        delete existingAliases[existingCommandId]
      }
    }

    if (normalizedAlias) {
      existingAliases[normalizedCommandId] = normalizedAlias
    } else {
      delete existingAliases[normalizedCommandId]
    }

    const next: AppSettings = {
      ...get(),
      commands: {
        aliases: existingAliases
      }
    }

    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateTheme: async (theme) => {
    set({ appearance: { ...get().appearance, theme } })
    scheduleSave(get)
  },

  updateCrosshairColor: async (color) => {
    set({ appearance: { ...get().appearance, crosshairColor: color === null ? null : normalizeHexColor(color) } })
    scheduleSave(get)
  },

  updatePenStyle: async (style) => {
    const current = get().ink
    set({
      ink: {
        penColor: style.penColor !== undefined ? (normalizeHexColor(style.penColor) ?? current.penColor) : current.penColor,
        penWidth: style.penWidth !== undefined ? normalizePenWidth(style.penWidth) : current.penWidth
      }
    })
    scheduleSave(get)
  },

  addQuickAccessFolder: async (folderPath) => {
    const current = get().quickAccess
    set({ quickAccess: { ...current, folders: normalizeQuickAccessFolders([...current.folders, folderPath]) } })
    scheduleSave(get)
  },

  removeQuickAccessFolder: async (folderPath) => {
    const current = get().quickAccess
    const key = normalizeFolderKey(folderPath)
    set({
      quickAccess: { ...current, folders: current.folders.filter((f) => normalizeFolderKey(f) !== key) }
    })
    scheduleSave(get)
  },

  setQuickAccessNeverAsk: async (neverAsk) => {
    set({ quickAccess: { ...get().quickAccess, neverAskToAdd: neverAsk } })
    scheduleSave(get)
  }
}))
