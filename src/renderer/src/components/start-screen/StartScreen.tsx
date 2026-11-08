import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  LayoutGrid,
  Plus,
  Settings,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { resourceToImageSrc } from '../../shared/resource-url'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import {
  folderDisplayName,
  normalizeFolderKey,
  type QuickAccessListResult
} from '../../../../shared/quick-access'
import './StartScreen.css'

type RecentBoard = {
  path: string
  openedAt: number
  workspaceRoot?: string
  thumbnailUri?: string
}

type StartScreenProps = {
  busy: boolean
  errorMessage: string | null
  transientBoards: string[]
  recentBoards: RecentBoard[]
  currentBoardName: string | null
  onReturnToBoard: (() => void) | null
  onOpenWorkspace: () => void
  onCreateWorkspace: () => void
  onCreateQuickboard: () => void
  onOpenTransientBoard: (boardPath: string) => void
  onOpenRecentBoard: (item: RecentBoard) => void
  onTrashBoard: (boardPath: string) => void
  onOpenWorkspaceRoot: (workspaceRoot: string) => void
  onOpenSettings: () => void
}

/** Which panel the large right-hand area shows. */
type StartSection = { kind: 'recent' } | { kind: 'folder'; path: string }

const QUICK_ACCESS_EXPANDED_KEY = 'wb:start:quick-access-expanded'

function getBoardLabel(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || fileName || 'Unsaved quickboard'
}

function getContainingDir(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

function formatRelativeTime(openedAt: number): string {
  const diffMin = Math.floor((Date.now() - openedAt) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return `${Math.floor(diffDay / 30)}mo ago`
}

function readExpanded(): boolean {
  try {
    return localStorage.getItem(QUICK_ACCESS_EXPANDED_KEY) !== 'false'
  } catch {
    return true
  }
}

// ── Folder panel ──────────────────────────────────────────────────────────────

function QuickAccessFolderPanel({
  folderPath,
  busy,
  onOpenWorkspaceRoot,
  onRemove
}: {
  folderPath: string
  busy: boolean
  onOpenWorkspaceRoot: (root: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [listing, setListing] = useState<QuickAccessListResult | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.listQuickAccessWorkspaces(folderPath).then((result) => {
      if (!cancelled) setListing(result)
    })
    return () => {
      cancelled = true
    }
  }, [folderPath])

  return (
    <>
      <p className="start-screen__recent-eyebrow">{folderDisplayName(folderPath)}</p>
      <p className="start-screen__folder-path" title={folderPath}>
        {folderPath}
      </p>

      {listing === null ? (
        <p className="start-screen__empty">{t('startScreen.quickAccessLoading')}</p>
      ) : !listing.exists ? (
        <div className="start-screen__notice">
          <AlertTriangle size={14} strokeWidth={1.8} />
          <span>{t('startScreen.quickAccessMissing')}</span>
          <button type="button" className="start-screen__notice-action" onClick={onRemove}>
            {t('startScreen.quickAccessRemove')}
          </button>
        </div>
      ) : listing.workspaces.length === 0 ? (
        <p className="start-screen__empty">{t('startScreen.quickAccessEmpty')}</p>
      ) : (
        <div className="start-screen__board-grid">
          {listing.workspaces.map((ws) => (
            <div key={ws.root} className="start-screen__board-tile">
              <button
                type="button"
                className="start-screen__board-open"
                onClick={() => onOpenWorkspaceRoot(ws.root)}
                disabled={busy}
                title={ws.root}
              >
                <div className="start-screen__board-preview start-screen__board-preview--workspace">
                  <Layers size={30} strokeWidth={1.2} />
                </div>
                <div className="start-screen__board-info">
                  <span className="start-screen__board-label">{ws.name}</span>
                  <span className="start-screen__board-path">
                    {t('startScreen.quickAccessBoardCount', { count: ws.boardCount })}
                  </span>
                  <span className="start-screen__board-time">{formatRelativeTime(ws.modifiedAt)}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Start screen ──────────────────────────────────────────────────────────────

export default function StartScreen({
  busy,
  errorMessage,
  transientBoards,
  recentBoards,
  currentBoardName,
  onReturnToBoard,
  onOpenWorkspace,
  onCreateWorkspace,
  onCreateQuickboard,
  onOpenTransientBoard,
  onOpenRecentBoard,
  onTrashBoard,
  onOpenWorkspaceRoot,
  onOpenSettings
}: StartScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const folders = useAppSettingsStore((s) => s.quickAccess.folders)
  const addQuickAccessFolder = useAppSettingsStore((s) => s.addQuickAccessFolder)
  const removeQuickAccessFolder = useAppSettingsStore((s) => s.removeQuickAccessFolder)
  const [section, setSection] = useState<StartSection>({ kind: 'recent' })
  const [quickAccessExpanded, setQuickAccessExpanded] = useState(readExpanded)

  const toggleQuickAccess = (): void => {
    setQuickAccessExpanded((current) => {
      const next = !current
      try {
        localStorage.setItem(QUICK_ACCESS_EXPANDED_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const handleAddFolder = useCallback(async () => {
    const result = await window.api.pickQuickAccessFolder()
    if (!result.ok || !result.folderPath) return
    await addQuickAccessFolder(result.folderPath)
    setQuickAccessExpanded(true)
    setSection({ kind: 'folder', path: result.folderPath })
  }, [addQuickAccessFolder])

  const handleRemoveFolder = useCallback(
    (folderPath: string) => {
      void removeQuickAccessFolder(folderPath)
      setSection((current) =>
        current.kind === 'folder' && normalizeFolderKey(current.path) === normalizeFolderKey(folderPath)
          ? { kind: 'recent' }
          : current
      )
    },
    [removeQuickAccessFolder]
  )

  const isFolderActive = (folderPath: string): boolean =>
    section.kind === 'folder' && normalizeFolderKey(section.path) === normalizeFolderKey(folderPath)

  return (
    <main className="start-screen">
      <aside className="start-screen__sidebar">
        <h1 className="start-screen__logo">{t('startScreen.logo')}</h1>

        <nav className="start-screen__nav">
          {onReturnToBoard ? (
            <button
              type="button"
              className="start-screen__action start-screen__action--return"
              onClick={onReturnToBoard}
            >
              <ChevronLeft size={14} strokeWidth={1.8} className="start-screen__action-icon" />
              {currentBoardName ?? t('startScreen.backToBoard')}
            </button>
          ) : null}

          <button
            type="button"
            className={`start-screen__action${section.kind === 'recent' ? ' start-screen__action--active' : ''}`}
            onClick={() => setSection({ kind: 'recent' })}
            aria-current={section.kind === 'recent' ? 'page' : undefined}
          >
            <Zap size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.recentlyAction')}
          </button>

          <button type="button" className="start-screen__action" onClick={onOpenWorkspace} disabled={busy}>
            <FolderOpen size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.openAction')}
          </button>

          <button type="button" className="start-screen__action" onClick={onCreateWorkspace} disabled={busy}>
            <FolderPlus size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.newWorkspaceAction')}
          </button>

          <button type="button" className="start-screen__action" onClick={onCreateQuickboard} disabled={busy}>
            <Zap size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.newQuickboardAction')}
          </button>

          {/* Quick Access: collapsible list of user-pinned folders */}
          <div className="start-screen__qa-header">
            <button
              type="button"
              className="start-screen__action start-screen__qa-toggle"
              onClick={toggleQuickAccess}
              aria-expanded={quickAccessExpanded}
            >
              <ChevronRight
                size={14}
                strokeWidth={1.8}
                className={`start-screen__action-icon start-screen__qa-chevron${quickAccessExpanded ? ' start-screen__qa-chevron--open' : ''}`}
              />
              {t('startScreen.quickAccess')}
            </button>
            <button
              type="button"
              className="start-screen__qa-add"
              onClick={() => void handleAddFolder()}
              aria-label={t('startScreen.quickAccessAdd')}
              title={t('startScreen.quickAccessAdd')}
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>

          {quickAccessExpanded && (
            <div className="start-screen__qa-list">
              {folders.length === 0 ? (
                <p className="start-screen__qa-empty">{t('startScreen.quickAccessNoFolders')}</p>
              ) : (
                folders.map((folderPath) => (
                  <div
                    key={folderPath}
                    className={`start-screen__qa-item${isFolderActive(folderPath) ? ' start-screen__qa-item--active' : ''}`}
                  >
                    <button
                      type="button"
                      className="start-screen__action start-screen__qa-folder"
                      onClick={() => setSection({ kind: 'folder', path: folderPath })}
                      title={folderPath}
                    >
                      <Folder size={13} strokeWidth={1.8} className="start-screen__action-icon" />
                      <span className="start-screen__qa-name">{folderDisplayName(folderPath)}</span>
                    </button>
                    <button
                      type="button"
                      className="start-screen__qa-remove"
                      onClick={() => handleRemoveFolder(folderPath)}
                      aria-label={t('startScreen.quickAccessRemoveAria', { name: folderDisplayName(folderPath) })}
                      title={t('startScreen.quickAccessRemove')}
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </nav>

        {errorMessage ? <p className="start-screen__error">{errorMessage}</p> : null}
      </aside>

      <section className="start-screen__recent" aria-label={t('startScreen.recentSection')}>
        <button
          type="button"
          className="start-screen__settings"
          onClick={onOpenSettings}
          aria-label={t('startScreen.settingsLabel')}
          title={t('startScreen.settingsLabel')}
        >
          <Settings size={17} strokeWidth={1.8} />
        </button>

        {section.kind === 'folder' ? (
          <QuickAccessFolderPanel
            key={section.path}
            folderPath={section.path}
            busy={busy}
            onOpenWorkspaceRoot={onOpenWorkspaceRoot}
            onRemove={() => handleRemoveFolder(section.path)}
          />
        ) : (
          <>
            {recentBoards.length > 0 && (
              <>
                <p className="start-screen__recent-eyebrow">{t('startScreen.recentSection')}</p>
                <div className="start-screen__board-grid">
                  {recentBoards.map((item) => (
                    <div key={item.path} className="start-screen__board-tile">
                      <button
                        type="button"
                        className="start-screen__board-open"
                        onClick={() => onOpenRecentBoard(item)}
                        disabled={busy}
                      >
                        <div className="start-screen__board-preview">
                          {item.thumbnailUri ? (
                            <img
                              src={resourceToImageSrc(item.thumbnailUri, item.workspaceRoot)}
                              alt=""
                              className="start-screen__board-thumbnail"
                              draggable={false}
                            />
                          ) : (
                            <LayoutGrid size={30} strokeWidth={1.2} />
                          )}
                        </div>
                        <div className="start-screen__board-info">
                          <span className="start-screen__board-label">{getBoardLabel(item.path)}</span>
                          <span className="start-screen__board-path">{getContainingDir(item.path)}</span>
                          <span className="start-screen__board-time">{formatRelativeTime(item.openedAt)}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {transientBoards.length > 0 && (
              <>
                <p
                  className="start-screen__recent-eyebrow"
                  style={recentBoards.length > 0 ? { marginTop: 32 } : undefined}
                >
                  {t('startScreen.unsavedQuickboards')}
                </p>
                <div className="start-screen__board-grid">
                  {transientBoards.map((boardPath) => (
                    <div key={boardPath} className="start-screen__board-tile">
                      <button
                        type="button"
                        className="start-screen__board-open"
                        onClick={() => onOpenTransientBoard(boardPath)}
                        disabled={busy}
                      >
                        <div className="start-screen__board-preview">
                          <LayoutGrid size={30} strokeWidth={1.2} />
                        </div>
                        <div className="start-screen__board-info">
                          <span className="start-screen__board-label">{getBoardLabel(boardPath)}</span>
                          <span className="start-screen__board-path">{boardPath}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="start-screen__board-discard"
                        onClick={() => onTrashBoard(boardPath)}
                        disabled={busy}
                        aria-label={t('startScreen.moveToTrashAria', { name: getBoardLabel(boardPath) })}
                        title={t('startScreen.moveToTrashTitle')}
                      >
                        <Trash2 size={11} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {recentBoards.length === 0 && transientBoards.length === 0 && (
              <p className="start-screen__empty">{t('startScreen.noRecentBoards')}</p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
