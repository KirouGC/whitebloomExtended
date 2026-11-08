import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { QuickAccessListResult, QuickAccessWorkspace } from '../../shared/quick-access'

const WORKSPACE_CONFIG_FILENAME = '.wbconfig'
const BOARD_FILE_SUFFIX = '.wb.json'

async function readWorkspaceSummary(root: string): Promise<QuickAccessWorkspace | null> {
  const configPath = join(root, WORKSPACE_CONFIG_FILENAME)
  let configStat
  try {
    configStat = await stat(configPath)
  } catch {
    return null
  }

  let name = basename(root)
  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf-8')) as { name?: unknown }
    if (typeof parsed.name === 'string' && parsed.name.trim()) name = parsed.name.trim()
  } catch {
    // Malformed config: still list it by folder name.
  }

  let boardCount = 0
  let modifiedAt = configStat.mtimeMs
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(BOARD_FILE_SUFFIX)) continue
      boardCount += 1
      try {
        const boardStat = await stat(join(root, entry.name))
        modifiedAt = Math.max(modifiedAt, boardStat.mtimeMs)
      } catch {
        // ignore unreadable board
      }
    }
  } catch {
    // ignore
  }

  return { root, name, boardCount, modifiedAt }
}

/**
 * Lists the workspaces in a Quick Access folder: the folder itself if it is a
 * workspace, plus every direct subfolder that is one. Most recently modified first.
 */
export async function listWorkspacesInFolder(folderPath: string): Promise<QuickAccessListResult> {
  try {
    const folderStat = await stat(folderPath)
    if (!folderStat.isDirectory()) return { ok: true, exists: false, workspaces: [] }
  } catch {
    return { ok: true, exists: false, workspaces: [] }
  }

  const candidates = [folderPath]
  try {
    const entries = await readdir(folderPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) candidates.push(join(folderPath, entry.name))
    }
  } catch {
    return { ok: false, exists: true, workspaces: [] }
  }

  const summaries = await Promise.all(candidates.map((root) => readWorkspaceSummary(root)))
  const workspaces = summaries
    .filter((s): s is QuickAccessWorkspace => s !== null)
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
  return { ok: true, exists: true, workspaces }
}
