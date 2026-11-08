/** A workspace discovered inside a Quick Access folder. */
export type QuickAccessWorkspace = {
  root: string
  name: string
  boardCount: number
  modifiedAt: number
}

export type QuickAccessListResult = {
  ok: boolean
  /** False when the folder no longer exists (moved/deleted/unplugged drive). */
  exists: boolean
  workspaces: QuickAccessWorkspace[]
}

export type QuickAccessPickFolderResult = {
  ok: boolean
  folderPath?: string
}

export type TrashItem = {
  trashPath: string
  name: string
  originalPath: string | null
  trashedAt: number
}

/** Raster formats the board exporter can produce. */
export type ExportImageFormat = 'png' | 'jpg' | 'jpeg' | 'webp' | 'bmp'

export const EXPORT_IMAGE_FORMATS: ExportImageFormat[] = ['png', 'jpg', 'jpeg', 'webp', 'bmp']

export type ExportPickPathResult = {
  ok: boolean
  filePath?: string
  format?: ExportImageFormat
}

/** Normalize a folder path for comparisons (Windows paths are case-insensitive). */
export function normalizeFolderKey(folderPath: string): string {
  return folderPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** Parent directory of a path, keeping the original separators. */
export function parentFolder(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (index <= 0) return trimmed
  const parent = trimmed.slice(0, index)
  // Keep drive roots as "C:\" rather than "C:"
  return /^[a-zA-Z]:$/.test(parent) ? `${parent}\\` : parent
}

export function folderDisplayName(folderPath: string): string {
  const trimmed = folderPath.replace(/[\\/]+$/, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return (index >= 0 ? trimmed.slice(index + 1) : trimmed) || folderPath
}
