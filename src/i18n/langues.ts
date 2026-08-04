export const LANGUES = [
  { code: 'fr', nom: 'Français', locale: 'fr-FR' },
  { code: 'en', nom: 'English', locale: 'en-GB' },
  { code: 'zh', nom: '中文', locale: 'zh-CN' },
] as const

export type LangueCode = (typeof LANGUES)[number]['code']
