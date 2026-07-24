/**
 * Génération des références métier.
 *
 * Les références suivent la convention déjà en vigueur sur le corridor :
 *   commande  PO-2026-0060
 *   lot       LOT-0060-01          (segment de la commande + rang du lot)
 *   camion    TRK-0060-01-01       (segment du lot + rang du camion)
 *
 * L'unicité est garantie en base par une contrainte `unique`. Ces fonctions
 * proposent la prochaine référence libre ; en cas de collision (deux
 * créations simultanées), l'appelant réessaie avec le rang suivant.
 */

import type { Camion, Commande, Lot } from './types'

/** Extrait le compteur final d'une référence : « PO-2026-0060 » → 60. */
function compteur(reference: string): number {
  const dernier = reference.split('-').at(-1) ?? ''
  const valeur = Number.parseInt(dernier, 10)
  return Number.isNaN(valeur) ? 0 : valeur
}

/** Segment identifiant d'une commande : « PO-2026-0060 » → « 0060 ». */
export function segmentCommande(reference: string): string {
  return reference.split('-').at(-1) ?? '0000'
}

/** Segment identifiant d'un lot : « LOT-0060-02 » → « 0060-02 ». */
export function segmentLot(reference: string): string {
  return reference.replace(/^LOT-/, '')
}

/**
 * Prochaine référence de commande, numérotée par année civile.
 * `PO-2026-0061` si `PO-2026-0060` est la dernière de l'année.
 */
export function prochaineReferenceCommande(commandes: Commande[], annee = new Date().getFullYear()): string {
  const prefixe = `PO-${annee}-`
  const max = commandes
    .filter((c) => c.reference.startsWith(prefixe))
    .reduce((acc, c) => Math.max(acc, compteur(c.reference)), 0)
  return `${prefixe}${String(max + 1).padStart(4, '0')}`
}

/** Prochaine référence de lot pour une commande donnée. */
export function prochaineReferenceLot(commande: Commande, lots: Lot[]): string {
  const segment = segmentCommande(commande.reference)
  const prefixe = `LOT-${segment}-`
  const existants = lots.filter((l) => l.commande_id === commande.id)
  const max = existants.reduce((acc, l) => Math.max(acc, compteur(l.reference)), 0)
  return `${prefixe}${String(max + 1).padStart(2, '0')}`
}

/**
 * Références des `nombre` prochains camions d'un lot.
 * Utilisé par la création en série (critère AC-01).
 */
export function referencesCamions(lot: Lot, camions: Camion[], nombre: number): string[] {
  const prefixe = `TRK-${segmentLot(lot.reference)}-`
  const existants = camions.filter((c) => c.lot_id === lot.id)
  const depart = existants.reduce((acc, c) => Math.max(acc, compteur(c.reference)), 0)
  return Array.from(
    { length: nombre },
    (_, i) => `${prefixe}${String(depart + i + 1).padStart(2, '0')}`,
  )
}
