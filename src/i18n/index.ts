import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import frCommon from '@/locales/fr/common.json'
import enCommon from '@/locales/en/common.json'
import zhCommon from '@/locales/zh/common.json'
import frAuth from '@/locales/fr/auth.json'
import enAuth from '@/locales/en/auth.json'
import zhAuth from '@/locales/zh/auth.json'
import frWorkflow from '@/locales/fr/workflow.json'
import enWorkflow from '@/locales/en/workflow.json'
import zhWorkflow from '@/locales/zh/workflow.json'

const resources = {
  fr: {
    common: frCommon,
    auth: frAuth,
    workflow: frWorkflow,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    workflow: enWorkflow,
  },
  zh: {
    common: zhCommon,
    auth: zhAuth,
    workflow: zhWorkflow,
  },
} as const

void i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources,
    supportedLngs: ['fr', 'en', 'zh'],
    fallbackLng: 'fr',
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'acidtrack.langue',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    debug: import.meta.env.DEV,
  })

const applyHtmlLang = (lng: string | undefined) => {
  const normalized = (lng ?? 'fr').split('-')[0]
  const safeLang = normalized === 'zh' ? 'zh' : normalized
  document.documentElement.lang = safeLang
}

applyHtmlLang(i18next.language)
i18next.on('languageChanged', (lng) => applyHtmlLang(lng))

export default i18next
