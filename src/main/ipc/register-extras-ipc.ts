import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'fs/promises'
import { extname } from 'path'
import { t } from '../i18n'
import { listWorkspacesInFolder } from '../services/quick-access'
import {
  EXPORT_IMAGE_FORMATS,
  type ExportImageFormat,
  type ExportPickPathResult,
  type QuickAccessListResult,
  type QuickAccessPickFolderResult
} from '../../shared/quick-access'

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function sanitizeFileStem(value: string): string {
  const cleaned = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && !'<>:"/\\|?*'.includes(ch))
    .join('')
    .trim()
  return cleaned.length > 0 ? cleaned : 'whitebloom'
}

/** Quick Access folders on the start screen + board image export. */
export function registerExtrasIpc(): void {
  ipcMain.handle('quick-access:pick-folder', async (): Promise<QuickAccessPickFolderResult> => {
    const win = focusedWindow()
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs.quickAccessPickTitle'),
      properties: ['openDirectory', 'createDirectory']
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (canceled || filePaths.length === 0) return { ok: false }
    return { ok: true, folderPath: filePaths[0] }
  })

  ipcMain.handle(
    'quick-access:list-workspaces',
    async (_event, folderPath: string): Promise<QuickAccessListResult> => {
      if (typeof folderPath !== 'string' || !folderPath) return { ok: false, exists: false, workspaces: [] }
      return listWorkspacesInFolder(folderPath)
    }
  )

  ipcMain.handle(
    'export:pick-image-path',
    async (_event, suggestedName: string): Promise<ExportPickPathResult> => {
      const win = focusedWindow()
      const filters: Electron.FileFilter[] = [
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        { name: 'WebP', extensions: ['webp'] },
        { name: 'BMP', extensions: ['bmp'] }
      ]
      const options: Electron.SaveDialogOptions = {
        title: t('dialogs.exportImageTitle'),
        defaultPath: `${sanitizeFileStem(suggestedName)}.png`,
        filters
      }
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (canceled || !filePath) return { ok: false }

      const ext = extname(filePath).slice(1).toLowerCase() as ExportImageFormat
      if (EXPORT_IMAGE_FORMATS.includes(ext)) return { ok: true, filePath, format: ext }
      // No/unknown extension typed: fall back to PNG.
      return { ok: true, filePath: `${filePath}.png`, format: 'png' }
    }
  )

  ipcMain.handle(
    'export:write-image',
    async (_event, filePath: string, bytes: Uint8Array): Promise<{ ok: boolean }> => {
      try {
        await writeFile(filePath, Buffer.from(bytes))
        return { ok: true }
      } catch {
        return { ok: false }
      }
    }
  )
}
