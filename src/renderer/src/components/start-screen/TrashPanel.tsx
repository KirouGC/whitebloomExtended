import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, RotateCcw, Trash2 } from 'lucide-react'
import { PetalButton, PetalPanel } from '../petal'
import { folderDisplayName, parentFolder, type TrashItem } from '../../../../shared/quick-access'

type TrashPanelProps = {
  busy: boolean
  formatRelativeTime: (timestamp: number) => string
  /** Called after a board is restored so the other start-screen lists refresh. */
  onRestored: () => void
}

type PendingConfirm = { kind: 'delete'; item: TrashItem } | { kind: 'empty' } | null

/**
 * Start-screen Trash: boards moved to the trash can be restored to their original
 * folder, or deleted permanently (always confirmed first).
 */
export default function TrashPanel({ busy, formatRelativeTime, onRestored }: TrashPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [reloadToken, setReloadToken] = useState(0)
  const reload = (): void => setReloadToken((v) => v + 1)

  useEffect(() => {
    let cancelled = false
    void window.api.listTrash().then((result) => {
      if (!cancelled) setItems(result.ok ? result.items : [])
    })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const restore = async (item: TrashItem): Promise<void> => {
    setWorking(true)
    const result = await window.api.restoreFromTrash(item.trashPath)
    setWorking(false)
    if (result.ok && result.restoredPath) {
      setMessage(t('startScreen.trashRestoredTo', { path: parentFolder(result.restoredPath) }))
      onRestored()
    } else {
      setMessage(t('startScreen.trashRestoreFailed'))
    }
    reload()
  }

  const confirmAction = async (): Promise<void> => {
    if (!confirm) return
    setWorking(true)
    if (confirm.kind === 'delete') await window.api.deleteFromTrash(confirm.item.trashPath)
    else await window.api.emptyTrash()
    setWorking(false)
    setConfirm(null)
    setMessage(null)
    reload()
  }

  const disabled = busy || working

  return (
    <>
      <div className="start-screen__panel-head">
        <p className="start-screen__recent-eyebrow">{t('startScreen.trashSection')}</p>
        {items && items.length > 0 ? (
          <button
            type="button"
            className="start-screen__panel-action start-screen__panel-action--danger"
            onClick={() => setConfirm({ kind: 'empty' })}
            disabled={disabled}
          >
            <Trash2 size={13} strokeWidth={1.8} />
            {t('startScreen.trashEmpty')}
          </button>
        ) : null}
      </div>
      <p className="start-screen__folder-path">{t('startScreen.trashHint')}</p>

      {message ? <p className="start-screen__trash-message">{message}</p> : null}

      {items === null ? null : items.length === 0 ? (
        <p className="start-screen__empty">{t('startScreen.trashEmptyState')}</p>
      ) : (
        <div className="start-screen__board-grid">
          {items.map((item) => (
            <div key={item.trashPath} className="start-screen__board-tile start-screen__board-tile--trash">
              <div className="start-screen__board-preview">
                <LayoutGrid size={30} strokeWidth={1.2} />
              </div>
              <div className="start-screen__board-info">
                <span className="start-screen__board-label">{item.name}</span>
                <span className="start-screen__board-path" title={item.originalPath ?? undefined}>
                  {item.originalPath
                    ? folderDisplayName(parentFolder(item.originalPath))
                    : t('startScreen.trashUnknownOrigin')}
                </span>
                <span className="start-screen__board-time">{formatRelativeTime(item.trashedAt)}</span>
              </div>
              <div className="start-screen__trash-actions">
                <button
                  type="button"
                  className="start-screen__trash-btn"
                  onClick={() => void restore(item)}
                  disabled={disabled}
                  title={t('startScreen.trashRestore')}
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  {t('startScreen.trashRestore')}
                </button>
                <button
                  type="button"
                  className="start-screen__trash-btn start-screen__trash-btn--danger"
                  onClick={() => setConfirm({ kind: 'delete', item })}
                  disabled={disabled}
                  aria-label={t('startScreen.trashDeleteForever')}
                  title={t('startScreen.trashDeleteForever')}
                >
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm ? (
        <PetalPanel
          title={confirm.kind === 'empty' ? t('startScreen.trashEmptyConfirmTitle') : t('startScreen.trashDeleteConfirmTitle')}
          body={
            confirm.kind === 'empty'
              ? t('startScreen.trashEmptyConfirmBody', { count: items?.length ?? 0 })
              : t('startScreen.trashDeleteConfirmBody', { name: confirm.item.name })
          }
          onClose={() => (working ? undefined : setConfirm(null))}
        >
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setConfirm(null)} disabled={working}>
              {t('startScreen.trashCancel')}
            </PetalButton>
            <PetalButton intent="destructive" onClick={() => void confirmAction()} disabled={working}>
              {confirm.kind === 'empty' ? t('startScreen.trashEmpty') : t('startScreen.trashDeleteForever')}
            </PetalButton>
          </div>
        </PetalPanel>
      ) : null}
    </>
  )
}
