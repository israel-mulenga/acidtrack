/**
 * Primitives d'interface AcidTrack.
 * Mobile-first : cibles tactiles ≥ 44 px, lisibles dès 360 px de large.
 */

import { useEffect } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GraviteIncident, StatutCamion, StatutEtape } from '@/lib/types'
import {
  LIBELLE_STATUT_CAMION,
  LIBELLE_STATUT_CLIENT,
  LIBELLE_STATUT_ETAPE,
} from '@/lib/workflow'

/* ------------------------------------------------------------------ */
/* Bouton                                                              */
/* ------------------------------------------------------------------ */

type VarianteBouton = 'principal' | 'secondaire' | 'discret' | 'danger' | 'succes'
type TailleBouton = 'sm' | 'md' | 'lg'

const VARIANTES: Record<VarianteBouton, string> = {
  principal:
    'bg-ardoise-900 text-white hover:bg-ardoise-800 active:bg-ardoise-950 shadow-sm disabled:bg-ardoise-300',
  secondaire:
    'bg-white text-ardoise-900 border border-ardoise-200 hover:bg-ardoise-50 active:bg-ardoise-100 shadow-xs',
  discret: 'bg-transparent text-ardoise-600 hover:bg-ardoise-100 active:bg-ardoise-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm disabled:bg-red-300',
  succes:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm disabled:bg-emerald-300',
}

const TAILLES: Record<TailleBouton, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton
  taille?: TailleBouton
}

export function Bouton({
  variante = 'principal',
  taille = 'md',
  className,
  ...props
}: BoutonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTES[variante],
        TAILLES[taille],
        className,
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Carte                                                               */
/* ------------------------------------------------------------------ */

export function Carte({
  className,
  children,
  ...props
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-ardoise-200 bg-white shadow-xs',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Badges de statut                                                    */
/* ------------------------------------------------------------------ */

const STYLE_ETAPE: Record<StatutEtape, string> = {
  PLANIFIE: 'bg-ardoise-100 text-ardoise-600 ring-ardoise-200',
  EN_ATTENTE_ACTION: 'bg-ambre-50 text-ambre-700 ring-ambre-200',
  EN_COURS: 'bg-blue-50 text-blue-700 ring-blue-200',
  EN_ATTENTE_VALIDATION: 'bg-violet-50 text-violet-700 ring-violet-200',
  TERMINE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  BLOQUE: 'bg-red-50 text-red-700 ring-red-200',
  EN_RETARD: 'bg-orange-50 text-orange-700 ring-orange-200',
  ANNULE: 'bg-ardoise-100 text-ardoise-500 ring-ardoise-200 line-through',
}

export function BadgeEtape({
  statut,
  vueClient = false,
  className,
}: {
  statut: StatutEtape
  vueClient?: boolean
  className?: string
}) {
  const libelle = vueClient ? LIBELLE_STATUT_CLIENT[statut] : LIBELLE_STATUT_ETAPE[statut]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STYLE_ETAPE[statut],
        className,
      )}
    >
      {libelle}
    </span>
  )
}

const STYLE_CAMION: Record<StatutCamion, string> = {
  EN_COURS: 'bg-blue-50 text-blue-700 ring-blue-200',
  TERMINE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  BLOQUE: 'bg-red-50 text-red-700 ring-red-200',
  ANNULE: 'bg-ardoise-100 text-ardoise-500 ring-ardoise-200',
}

export function BadgeCamion({ statut, className }: { statut: StatutCamion; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STYLE_CAMION[statut],
        className,
      )}
    >
      {LIBELLE_STATUT_CAMION[statut]}
    </span>
  )
}

const STYLE_GRAVITE: Record<GraviteIncident, string> = {
  FAIBLE: 'bg-ardoise-100 text-ardoise-600 ring-ardoise-200',
  MOYENNE: 'bg-ambre-50 text-ambre-700 ring-ambre-200',
  ELEVEE: 'bg-orange-50 text-orange-700 ring-orange-200',
  CRITIQUE: 'bg-red-600 text-white ring-red-700',
}

export function BadgeGravite({ gravite }: { gravite: GraviteIncident }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset',
        STYLE_GRAVITE[gravite],
      )}
    >
      {gravite.toLowerCase()}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Barre de progression                                                */
/* ------------------------------------------------------------------ */

export function Progression({
  valeur,
  className,
  couleur,
}: {
  valeur: number
  className?: string
  couleur?: string
}) {
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-ardoise-200', className)}
      role="progressbar"
      aria-valuenow={valeur}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', couleur ?? 'bg-ardoise-900')}
        style={{ width: `${Math.min(Math.max(valeur, 0), 100)}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Champs de formulaire                                                */
/* ------------------------------------------------------------------ */

export function Etiquette({
  children,
  obligatoire,
  htmlFor,
}: {
  children: ReactNode
  obligatoire?: boolean
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ardoise-700">
      {children}
      {obligatoire && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

const STYLE_CHAMP =
  'w-full rounded-lg border border-ardoise-200 bg-white px-3 py-2.5 text-base text-ardoise-900 ' +
  'placeholder:text-ardoise-400 transition-colors focus:border-ardoise-400 focus:outline-none ' +
  'focus:ring-2 focus:ring-ambre-500/30 disabled:bg-ardoise-50 disabled:text-ardoise-500'

export function Champ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(STYLE_CHAMP, className)} {...props} />
}

export function ZoneTexte({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(STYLE_CHAMP, 'min-h-20 resize-y', className)} {...props} />
}

export function Selection({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(STYLE_CHAMP, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/* Modale — plein écran sur mobile, centrée sur desktop                */
/* ------------------------------------------------------------------ */

export function Modale({
  ouverte,
  onFermer,
  titre,
  sousTitre,
  children,
  pied,
}: {
  ouverte: boolean
  onFermer: () => void
  titre: string
  sousTitre?: string
  children: ReactNode
  pied?: ReactNode
}) {
  useEffect(() => {
    if (!ouverte) return
    const gererEchap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', gererEchap)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', gererEchap)
      document.body.style.overflow = ''
    }
  }, [ouverte, onFermer])

  if (!ouverte) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ardoise-950/60 backdrop-blur-sm"
        onClick={onFermer}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={cn(
          'animate-fade-in relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-2xl',
          'rounded-t-2xl sm:max-w-lg sm:rounded-2xl',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-ardoise-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ardoise-900">{titre}</h2>
            {sousTitre && <p className="mt-0.5 text-sm text-ardoise-500">{sousTitre}</p>}
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-ardoise-400 transition-colors hover:bg-ardoise-100 hover:text-ardoise-700"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {pied && (
          <footer className="border-t border-ardoise-200 bg-ardoise-50 px-5 py-3">{pied}</footer>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Encarts d'information                                               */
/* ------------------------------------------------------------------ */

const STYLE_ENCART = {
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  succes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  alerte: 'bg-ambre-50 text-ambre-700 border-ambre-200',
  erreur: 'bg-red-50 text-red-800 border-red-200',
}

export function Encart({
  ton = 'info',
  titre,
  children,
  icone,
  className,
}: {
  ton?: keyof typeof STYLE_ENCART
  titre?: string
  children?: ReactNode
  icone?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        STYLE_ENCART[ton],
        className,
      )}
    >
      {icone && <span className="mt-0.5 shrink-0">{icone}</span>}
      <div className="min-w-0">
        {titre && <p className="font-semibold">{titre}</p>}
        {children && <div className={cn(titre && 'mt-1')}>{children}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* États vides et chargement                                           */
/* ------------------------------------------------------------------ */

export function Squelette({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-ardoise-200/70', className)} />
}

export function EtatVide({
  icone,
  titre,
  description,
  action,
}: {
  icone?: ReactNode
  titre: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icone && <div className="mb-3 text-ardoise-300">{icone}</div>}
      <p className="font-medium text-ardoise-700">{titre}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ardoise-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Statistique de tableau de bord                                      */
/* ------------------------------------------------------------------ */

export function Statistique({
  libelle,
  valeur,
  unite,
  icone,
  ton,
}: {
  libelle: string
  valeur: string | number
  unite?: string
  icone?: ReactNode
  ton?: 'neutre' | 'alerte' | 'danger' | 'succes'
}) {
  const tons = {
    neutre: 'text-ardoise-900',
    alerte: 'text-ambre-600',
    danger: 'text-red-600',
    succes: 'text-emerald-600',
  }
  return (
    <Carte className="p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ardoise-500">{libelle}</p>
        {icone && <span className="shrink-0 text-ardoise-300">{icone}</span>}
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', tons[ton ?? 'neutre'])}>
        {valeur}
        {unite && <span className="ml-1 text-sm font-normal text-ardoise-400">{unite}</span>}
      </p>
    </Carte>
  )
}
