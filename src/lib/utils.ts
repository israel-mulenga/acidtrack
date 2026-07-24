import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ------------------------------------------------------------------ */
/* Dates — stockage UTC, affichage Africa/Lubumbashi (§12.12)          */
/* ------------------------------------------------------------------ */

const FUSEAU = 'Africa/Lubumbashi'

export function formatDateHeure(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSEAU,
  }).format(new Date(iso))
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: FUSEAU,
  }).format(new Date(iso))
}

/** « il y a 3 h », « il y a 2 j » — la fraîcheur est un KPI (§19). */
export function depuis(iso: string | null | undefined): string {
  if (!iso) return '—'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.round(heures / 24)
  return `il y a ${jours} j`
}

/** « dans 3 h » / « en retard de 2 h » pour l'ETA. */
export function jusqua(iso: string | null | undefined): string {
  if (!iso) return '—'
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const abs = Math.abs(minutes)
  const suffixe = abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} j`
  return minutes >= 0 ? `dans ${suffixe}` : `dépassée de ${suffixe}`
}

/* ------------------------------------------------------------------ */
/* Nombres                                                             */
/* ------------------------------------------------------------------ */

export function formatTonnage(valeur: number | string | null | undefined): string {
  const n = Number(valeur ?? 0)
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} t`
}

export function formatMontant(valeur: number | string | null | undefined, devise = 'USD'): string {
  const n = Number(valeur ?? 0)
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`
}

export function formatTaille(octets: number | null | undefined): string {
  if (!octets) return ''
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`
}

export function initiales(nom: string | null | undefined): string {
  if (!nom) return '?'
  return nom
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join('')
}

/** Valeur d'entrée pour un <input type="datetime-local"> préremplie à maintenant. */
export function maintenantLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function aujourdhuiLocal(): string {
  return maintenantLocal().slice(0, 10)
}
