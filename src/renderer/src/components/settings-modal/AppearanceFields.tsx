import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Plus, Sun } from 'lucide-react'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import { buildCrosshairCursor } from '@renderer/theme/appearance'
import type { ThemePreference } from '../../../../shared/app-settings'

const CROSSHAIR_COLORS = [
  '#111111',
  '#ffffff',
  '#ec164c',
  '#ff6b2b',
  '#ffc21a',
  '#00b86b',
  '#0bbcd4',
  '#1e87ff',
  '#7c35ff',
  '#ff285a'
]

/**
 * Appearance settings: theme (Light / Dark / System, as in Microsoft Whiteboard's
 * settings) and the crosshair cursor color used by the text, shape and ink tools.
 */
export default function AppearanceFields(): React.JSX.Element {
  const { t } = useTranslation()
  const theme = useAppSettingsStore((s) => s.appearance.theme)
  const crosshairColor = useAppSettingsStore((s) => s.appearance.crosshairColor)
  const updateTheme = useAppSettingsStore((s) => s.updateTheme)
  const updateCrosshairColor = useAppSettingsStore((s) => s.updateCrosshairColor)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: t('appSettings.themeLight'), icon: <Sun size={14} strokeWidth={1.8} /> },
    { value: 'dark', label: t('appSettings.themeDark'), icon: <Moon size={14} strokeWidth={1.8} /> },
    { value: 'system', label: t('appSettings.themeSystem'), icon: <Monitor size={14} strokeWidth={1.8} /> }
  ]

  const isCustom = crosshairColor !== null && !CROSSHAIR_COLORS.includes(crosshairColor)

  return (
    <>
      <div className="settings-field">
        <span className="settings-field__label">{t('appSettings.themeLabel')}</span>
        <span className="settings-field__hint">{t('appSettings.themeHint')}</span>
        <div className="settings-segmented" role="radiogroup" aria-label={t('appSettings.themeLabel')}>
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={`settings-segmented__item${theme === option.value ? ' settings-segmented__item--active' : ''}`}
              onClick={() => void updateTheme(option.value)}
            >
              <span className={`settings-theme-preview settings-theme-preview--${option.value}`} aria-hidden>
                <span />
              </span>
              <span className="settings-segmented__label">
                {option.icon}
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-field">
        <span className="settings-field__label">{t('appSettings.crosshairLabel')}</span>
        <span className="settings-field__hint">{t('appSettings.crosshairHint')}</span>
        <div className="settings-crosshair">
          <div className="settings-crosshair__swatches" role="radiogroup" aria-label={t('appSettings.crosshairLabel')}>
            <button
              type="button"
              role="radio"
              aria-checked={crosshairColor === null}
              className={`settings-crosshair__swatch settings-crosshair__swatch--default${crosshairColor === null ? ' settings-crosshair__swatch--selected' : ''}`}
              title={t('appSettings.crosshairDefault')}
              aria-label={t('appSettings.crosshairDefault')}
              onClick={() => void updateCrosshairColor(null)}
            >
              {t('appSettings.crosshairDefaultShort')}
            </button>
            {CROSSHAIR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={crosshairColor === color}
                className={`settings-crosshair__swatch${crosshairColor === color ? ' settings-crosshair__swatch--selected' : ''}`}
                style={{ backgroundColor: color }}
                title={color}
                aria-label={color}
                onClick={() => void updateCrosshairColor(color)}
              />
            ))}
            <button
              type="button"
              className={`settings-crosshair__swatch settings-crosshair__swatch--custom${isCustom ? ' settings-crosshair__swatch--selected' : ''}`}
              style={isCustom && crosshairColor ? { background: crosshairColor } : undefined}
              title={t('appSettings.crosshairCustom')}
              aria-label={t('appSettings.crosshairCustom')}
              onClick={() => colorInputRef.current?.click()}
            >
              {!isCustom && <Plus size={12} strokeWidth={2.2} />}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              className="settings-crosshair__native"
              value={crosshairColor ?? '#1e87ff'}
              onChange={(e) => void updateCrosshairColor(e.target.value)}
              tabIndex={-1}
              aria-hidden
            />
          </div>
          <div
            className="settings-crosshair__preview"
            style={{ cursor: crosshairColor ? buildCrosshairCursor(crosshairColor) : 'crosshair' }}
          >
            {t('appSettings.crosshairPreview')}
          </div>
        </div>
      </div>
    </>
  )
}
