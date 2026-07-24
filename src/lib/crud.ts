/**
 * Écritures du référentiel et de la hiérarchie commerciale.
 *
 * Toute la création de données passe désormais par l'application : aucun
 * script SQL n'est nécessaire au-delà de l'installation du schéma.
 *
 * Les règles de cohérence (§5) sont appliquées ici, en amont de la base :
 *  - la somme des lots ne peut pas dépasser la quantité commandée ;
 *  - la somme des tonnages camions ne peut pas dépasser le lot ;
 *  - les références sont uniques et générées automatiquement.
 */

import { supabase } from './supabase'
import { ErreurMetier } from './actions'
import { referencesCamions } from './references'
import type { Camion, Commande, Lot } from './types'

/** Nom des tables adressables par les écrans d'administration. */
export type TableRessource =
  | 'organisations'
  | 'utilisateurs'
  | 'clients'
  | 'points_chargement'
  | 'itineraires'
  | 'modeles_etapes'
  | 'modeles_etapes_lignes'
  | 'commandes'
  | 'lots'
  | 'camions'

/** Valeurs d'un formulaire, avant conversion vers le format base. */
export type Enregistrement = Record<string, unknown>

function relayer(erreur: { message: string; code?: string } | null, contexte: string): void {
  if (!erreur) return
  if (erreur.code === '23505') {
    throw new ErreurMetier(
      'Cette référence existe déjà. Modifiez-la puis réessayez.',
      [erreur.message],
    )
  }
  if (erreur.code === '23503') {
    throw new ErreurMetier(
      'Cet enregistrement est référencé ailleurs et ne peut pas être supprimé.',
      [erreur.message],
    )
  }
  throw new ErreurMetier(`${contexte} : ${erreur.message}`)
}

/* ------------------------------------------------------------------ */
/* Opérations génériques                                               */
/* ------------------------------------------------------------------ */

export async function creer<T>(table: TableRessource, valeurs: Enregistrement): Promise<T> {
  const { data, error } = await supabase.from(table).insert(valeurs).select().single()
  relayer(error, 'Création impossible')
  return data as T
}

export async function modifier<T>(
  table: TableRessource,
  id: string,
  valeurs: Enregistrement,
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(valeurs)
    .eq('id', id)
    .select()
    .single()
  relayer(error, 'Modification impossible')
  return data as T
}

export async function supprimer(table: TableRessource, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  relayer(error, 'Suppression impossible')
}

/* ------------------------------------------------------------------ */
/* Règles de cohérence quantitative (§5 — critère AC-01)               */
/* ------------------------------------------------------------------ */

/** Tonnage déjà planifié sur une commande, hors lot en cours d'édition. */
export function tonnagePlanifie(
  commandeId: string,
  lots: Lot[],
  lotExclu?: string,
): number {
  return lots
    .filter((l) => l.commande_id === commandeId && l.id !== lotExclu)
    .reduce((somme, l) => somme + Number(l.quantite_planifiee_t), 0)
}

/** Tonnage déjà affecté à un lot, hors camion en cours d'édition. */
export function tonnageAffecte(
  lotId: string,
  camions: Camion[],
  camionExclu?: string,
): number {
  return camions
    .filter((c) => c.lot_id === lotId && c.id !== camionExclu && c.statut !== 'ANNULE')
    .reduce((somme, c) => somme + Number(c.tonnage_net_t), 0)
}

/**
 * Vérifie qu'un lot ne fait pas dépasser la quantité commandée.
 * Renvoie un message d'erreur, ou null si la quantité est cohérente.
 */
export function controleQuantiteLot(
  commande: Commande,
  lots: Lot[],
  quantite: number,
  lotExclu?: string,
): string | null {
  const dejaPlanifie = tonnagePlanifie(commande.id, lots, lotExclu)
  const restant = Number(commande.quantite_commandee_t) - dejaPlanifie
  if (quantite > restant + 0.001) {
    return (
      `La commande ${commande.reference} ne permet plus que ` +
      `${restant.toLocaleString('fr-FR')} t (${dejaPlanifie.toLocaleString('fr-FR')} t ` +
      `déjà planifiées sur ${Number(commande.quantite_commandee_t).toLocaleString('fr-FR')} t).`
    )
  }
  return null
}

/** Même contrôle, au niveau des camions d'un lot. */
export function controleTonnageCamion(
  lot: Lot,
  camions: Camion[],
  tonnage: number,
  camionExclu?: string,
): string | null {
  const dejaAffecte = tonnageAffecte(lot.id, camions, camionExclu)
  const restant = Number(lot.quantite_planifiee_t) - dejaAffecte
  if (tonnage > restant + 0.001) {
    return (
      `Le lot ${lot.reference} ne permet plus que ` +
      `${restant.toLocaleString('fr-FR')} t (${dejaAffecte.toLocaleString('fr-FR')} t ` +
      `déjà affectées sur ${Number(lot.quantite_planifiee_t).toLocaleString('fr-FR')} t).`
    )
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Création en série des dossiers camions (critère AC-01)              */
/* ------------------------------------------------------------------ */

export interface GabaritCamion {
  plaque_tracteur: string
  plaque_citerne?: string
  transporteur?: string
  chauffeur_nom?: string
  chauffeur_tel?: string
  capacite_t?: number
  tonnage_net_t: number
}

/**
 * Crée d'un seul geste les dossiers camions d'un lot, avec des références
 * uniques et séquentielles. Le contrôle de tonnage est appliqué sur
 * l'ensemble du lot, pas camion par camion.
 */
export async function creerCamionsEnSerie({
  lot,
  camionsExistants,
  gabarits,
}: {
  lot: Lot
  camionsExistants: Camion[]
  gabarits: GabaritCamion[]
}): Promise<Camion[]> {
  if (gabarits.length === 0) {
    throw new ErreurMetier('Aucun camion à créer.')
  }

  const total = gabarits.reduce((somme, g) => somme + Number(g.tonnage_net_t || 0), 0)
  const erreur = controleTonnageCamion(lot, camionsExistants, total)
  if (erreur) {
    throw new ErreurMetier('Tonnage incohérent avec le lot', [erreur])
  }

  const manquants = gabarits.filter((g) => !g.plaque_tracteur?.trim())
  if (manquants.length > 0) {
    throw new ErreurMetier('La plaque du tracteur est obligatoire pour chaque camion.')
  }

  const references = referencesCamions(lot, camionsExistants, gabarits.length)

  const lignes = gabarits.map((gabarit, i) => ({
    organisation_id: lot.organisation_id,
    lot_id: lot.id,
    reference: references[i],
    plaque_tracteur: gabarit.plaque_tracteur.trim(),
    plaque_citerne: gabarit.plaque_citerne?.trim() || null,
    transporteur: gabarit.transporteur?.trim() || null,
    chauffeur_nom: gabarit.chauffeur_nom?.trim() || null,
    chauffeur_tel: gabarit.chauffeur_tel?.trim() || null,
    capacite_t: gabarit.capacite_t || null,
    tonnage_net_t: gabarit.tonnage_net_t,
    etape_courante: 1,
    statut: 'EN_COURS',
  }))

  const { data, error } = await supabase.from('camions').insert(lignes).select()
  relayer(error, 'Création des dossiers camions impossible')
  return (data ?? []) as Camion[]
}

/* ------------------------------------------------------------------ */
/* Modèles d'étapes                                                    */
/* ------------------------------------------------------------------ */

/**
 * Duplique un modèle d'étapes avec ses sept lignes. Permet de partir d'une
 * séquence existante pour l'adapter à un nouvel itinéraire.
 */
export async function dupliquerModele(
  modeleId: string,
  organisationId: string,
  nouveauNom: string,
): Promise<string> {
  const { data: source, error: erreurLignes } = await supabase
    .from('modeles_etapes_lignes')
    .select('*')
    .eq('modele_id', modeleId)
    .order('numero')
  relayer(erreurLignes, 'Lecture du modèle impossible')

  const { data: modele, error: erreurModele } = await supabase
    .from('modeles_etapes')
    .insert({ organisation_id: organisationId, nom: nouveauNom, par_defaut: false })
    .select()
    .single()
  relayer(erreurModele, 'Création du modèle impossible')

  const nouvelId = (modele as { id: string }).id

  if (source && source.length > 0) {
    const lignes = source.map((l: Record<string, unknown>) => ({
      modele_id: nouvelId,
      numero: l.numero,
      code: l.code,
      libelle: l.libelle,
      objectif: l.objectif,
      responsable: l.responsable,
      sla_heures: l.sla_heures,
      documents_requis: l.documents_requis,
      champs: l.champs,
    }))
    const { error } = await supabase.from('modeles_etapes_lignes').insert(lignes)
    relayer(error, 'Copie des étapes impossible')
  }

  return nouvelId
}

/** Un modèle par défaut et un seul : bascule atomique côté application. */
export async function definirModeleParDefaut(
  modeleId: string,
  organisationId: string,
): Promise<void> {
  const { error: reset } = await supabase
    .from('modeles_etapes')
    .update({ par_defaut: false })
    .eq('organisation_id', organisationId)
  relayer(reset, 'Mise à jour du modèle par défaut impossible')

  const { error } = await supabase
    .from('modeles_etapes')
    .update({ par_defaut: true })
    .eq('id', modeleId)
  relayer(error, 'Mise à jour du modèle par défaut impossible')
}
