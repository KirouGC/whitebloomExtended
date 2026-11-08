import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../../locales/en.json'
import es from '../../locales/es.json'

// Last language used, so the first frame is already in the right language
// (settings.json is read asynchronously). English is the default.
export const LANGUAGE_CACHE_KEY = 'wb:language'
function cachedLanguage(): string {
  try {
    const value = localStorage.getItem(LANGUAGE_CACHE_KEY)
    return value === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

i18next.use(initReactI18next).init({
  lng: cachedLanguage(),
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    es: { translation: es }
  },
  interpolation: {
    escapeValue: false
  }
})

export default i18next
