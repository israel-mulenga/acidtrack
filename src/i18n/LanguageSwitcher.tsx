import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { LANGUES } from './langues'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation()

  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg border border-ardoise-200 bg-white/90 p-0.5 sm:gap-1 sm:p-1', className)}>
      {LANGUES.map((langue) => {
        const active = i18n.resolvedLanguage?.startsWith(langue.code)
        const court = langue.code === 'zh' ? '中文' : langue.code.toUpperCase()

        return (
          <button
            key={langue.code}
            type="button"
            onClick={() => void i18n.changeLanguage(langue.code)}
            className={cn(
              'rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1.5 sm:text-xs',
              active ? 'bg-ardoise-900 text-white' : 'text-ardoise-600 hover:bg-ardoise-50',
            )}
            aria-label={langue.nom}
          >
            <span className="sm:hidden">{court}</span>
            <span className="hidden sm:inline">{langue.nom}</span>
          </button>
        )
      })}
    </div>
  )
}
