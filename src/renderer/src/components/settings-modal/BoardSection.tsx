import { PetalField } from '@renderer/components/petal'
import { useTranslation } from 'react-i18next'
import type { BoardMetaPatch } from '@renderer/stores/board'

type BoardSectionProps = {
  name: string | undefined
  brief: string | undefined
  hideBackgroundDots: boolean
  onChange: (patch: BoardMetaPatch) => void
}

export default function BoardSection({ name, brief, hideBackgroundDots, onChange }: BoardSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">{t('boardSettings.title')}</h2>
      <div className="settings-section__fields">
        <PetalField
          label={t('boardSettings.nameLabel')}
          value={name ?? ''}
          placeholder={t('boardSettings.namePlaceholder')}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <PetalField
          as="textarea"
          label={t('boardSettings.briefLabel')}
          hint={t('boardSettings.briefHint')}
          value={brief ?? ''}
          placeholder={t('boardSettings.briefPlaceholder')}
          rows={6}
          onChange={(e) => onChange({ brief: e.target.value })}
        />
        <div className="settings-field">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!hideBackgroundDots}
              onChange={(e) => onChange({ hideBackgroundDots: !e.target.checked })}
            />
            <span className="settings-toggle__label">{t('boardSettings.backgroundDotsLabel')}</span>
          </label>
          <span className="settings-field__hint" style={{ paddingLeft: 22 }}>
            {t('boardSettings.backgroundDotsHint')}
          </span>
        </div>
      </div>
    </div>
  )
}
