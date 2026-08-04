import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { LANGUES } from './langues'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation()

  return (
    <div className={cn('flex items-center gap-1 rounded-lg border border-ardoise-200 bg-white/90 p-1', className)}>
      {LANGUES.map((langue) => {
        const active = i18n.resolvedLanguage?.startsWith(langue.code)

        return (
          <button
            key={langue.code}
            type="button"
            onClick={() => void i18n.changeLanguage(langue.code)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-ardoise-900 text-white' : 'text-ardoise-600 hover:bg-ardoise-50',
            )}
          >
            {langue.nom}
          </button>
        )
      })}
    </div>
  )
}
