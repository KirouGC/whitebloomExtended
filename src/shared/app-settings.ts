export const DEFAULT_USERNAME = 'anon'

export type UnhandledDropBehavior = 'import' | 'link' | 'ask'

export type ThemePreference = 'light' | 'dark' | 'system'

export const MIN_PEN_WIDTH = 1
export const MAX_PEN_WIDTH = 32

export type AppSettings = {
  user: {
    username: string
  }
  files: {
    /** What to do when a file with no registered module handler is dropped onto the canvas. */
    unhandledDrop: UnhandledDropBehavior
    /** Show a warning dialog before importing files larger than the threshold. */
    warnLargeImport: boolean
  }
  commands: {
    aliases: Record<string, string>
  }
  language: string
  appearance: {
    /** UI color theme. 'system' follows the OS preference. */
    theme: ThemePreference
    /** Custom crosshair cursor color (hex). null = native OS crosshair. */
    crosshairColor: string | null
  }
  ink: {
    /** Last used pen color (hex). */
    penColor: string
    /** Last used pen thickness in world units. */
    penWidth: number
  }
  quickAccess: {
    /** Folders pinned on the start screen; each lists the workspaces inside it. */
    folders: string[]
    /** Never offer to add a new workspace's parent folder to Quick Access. */
    neverAskToAdd: boolean
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  user: {
    username: DEFAULT_USERNAME
  },
  files: {
    unhandledDrop: 'link',
    warnLargeImport: true
  },
  commands: {
    aliases: {}
  },
  language: 'en',
  appearance: {
    theme: 'light',
    crosshairColor: null
  },
  ink: {
    penColor: '#111111',
    penWidth: 2
  },
  quickAccess: {
    folders: [],
    neverAskToAdd: false
  }
}

export function normalizeQuickAccessFolders(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const folders: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    folders.push(trimmed)
  }
  return folders
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : null
}

export function normalizeTheme(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return DEFAULT_APP_SETTINGS.appearance.theme
}

export function normalizePenWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_APP_SETTINGS.ink.penWidth
  return Math.min(MAX_PEN_WIDTH, Math.max(MIN_PEN_WIDTH, Math.round(value * 2) / 2))
}

export function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_USERNAME

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : DEFAULT_USERNAME
}

function normalizeUnhandledDrop(value: unknown): UnhandledDropBehavior {
  if (value === 'import' || value === 'link' || value === 'ask') return value
  return DEFAULT_APP_SETTINGS.files.unhandledDrop
}

export function normalizeLanguage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_APP_SETTINGS.language
  return value.split('-')[0].toLowerCase()
}

export function normalizeCommandAlias(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) return undefined
  if (!/^[a-z0-9._-]+$/.test(normalized)) return undefined
  return normalized
}

function normalizeCommandAliases(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}

  const entries = Object.entries(value as Record<string, unknown>)
  const normalized: Record<string, string> = {}

  for (const [commandId, aliasValue] of entries) {
    const trimmedCommandId = commandId.trim()
    const alias = normalizeCommandAlias(aliasValue)
    if (!trimmedCommandId || !alias) continue
    normalized[trimmedCommandId] = alias
  }

  return normalized
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return {
      user: { ...DEFAULT_APP_SETTINGS.user },
      files: { ...DEFAULT_APP_SETTINGS.files },
      commands: { ...DEFAULT_APP_SETTINGS.commands },
      language: DEFAULT_APP_SETTINGS.language,
      appearance: { ...DEFAULT_APP_SETTINGS.appearance },
      ink: { ...DEFAULT_APP_SETTINGS.ink },
      quickAccess: { folders: [], neverAskToAdd: false }
    }
  }

  const candidate = value as {
    user?: { username?: unknown }
    files?: { unhandledDrop?: unknown; warnLargeImport?: unknown }
    commands?: { aliases?: unknown }
    language?: unknown
    appearance?: { theme?: unknown; crosshairColor?: unknown }
    ink?: { penColor?: unknown; penWidth?: unknown }
    quickAccess?: { folders?: unknown; neverAskToAdd?: unknown }
  }
  return {
    user: {
      username: normalizeUsername(candidate.user?.username)
    },
    files: {
      unhandledDrop: normalizeUnhandledDrop(candidate.files?.unhandledDrop),
      warnLargeImport:
        candidate.files?.warnLargeImport === false
          ? false
          : DEFAULT_APP_SETTINGS.files.warnLargeImport
    },
    commands: {
      aliases: normalizeCommandAliases(candidate.commands?.aliases)
    },
    language: normalizeLanguage(candidate.language),
    appearance: {
      theme: normalizeTheme(candidate.appearance?.theme),
      crosshairColor: normalizeHexColor(candidate.appearance?.crosshairColor)
    },
    ink: {
      penColor: normalizeHexColor(candidate.ink?.penColor) ?? DEFAULT_APP_SETTINGS.ink.penColor,
      penWidth: normalizePenWidth(candidate.ink?.penWidth)
    },
    quickAccess: {
      folders: normalizeQuickAccessFolders(candidate.quickAccess?.folders),
      neverAskToAdd: candidate.quickAccess?.neverAskToAdd === true
    }
  }
}
