import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PetalButton, PetalPanel } from '../petal'
import { folderDisplayName } from '../../../../shared/quick-access'
import '../settings-modal/SettingsModal.css'
import './StartScreen.css'

type AddToQuickAccessModalProps = {
  folderPath: string
  onDecide: (decision: { add: boolean; neverAskAgain: boolean }) => void
}

/**
 * Offered after a workspace is created in a folder that isn't in Quick Access yet.
 * "Don't ask again" disables the prompt permanently (also togglable in Settings).
 */
export default function AddToQuickAccessModal({
  folderPath,
  onDecide
}: AddToQuickAccessModalProps): React.JSX.Element {
  const { t } = useTranslation()
  const [neverAskAgain, setNeverAskAgain] = useState(false)

  return (
    <PetalPanel
      title={t('quickAccessPrompt.title')}
      body={t('quickAccessPrompt.body', { name: folderDisplayName(folderPath) })}
      onClose={() => onDecide({ add: false, neverAskAgain })}
    >
      <p className="quick-access-prompt__path" title={folderPath}>
        {folderPath}
      </p>
      <label className="settings-toggle quick-access-prompt__never">
        <input
          type="checkbox"
          checked={neverAskAgain}
          onChange={(e) => setNeverAskAgain(e.target.checked)}
        />
        <span className="settings-toggle__label">{t('quickAccessPrompt.neverAsk')}</span>
      </label>
      <div className="petal-panel__actions">
        <PetalButton onClick={() => onDecide({ add: false, neverAskAgain })}>
          {t('quickAccessPrompt.notNow')}
        </PetalButton>
        <PetalButton intent="primary" onClick={() => onDecide({ add: true, neverAskAgain })}>
          {t('quickAccessPrompt.add')}
        </PetalButton>
      </div>
    </PetalPanel>
  )
}
