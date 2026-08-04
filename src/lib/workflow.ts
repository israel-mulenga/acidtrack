/**
 * Règles métier du workflow AcidTrack.
 *
 * Ce module centralise TOUTE la logique dérivée : progression, SLA, statut
 * effectif d'une étape, jalons par destination et complétude documentaire.
 * Aucun de ces éléments n'est saisi manuellement (cf. §12.6 du cahier des
 * charges : « la progression du lot est dérivée des camions »).
 */

import { t } from 'i18next'
import type {
  Camion,
  Document,
  EtapeEvenement,
  RoleUtilisateur,
  EtapeReferentiel,
  StatutCamion,
  StatutEtape,
} from './types'

export const NB_ETAPES = 7

/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

/** Affichage interne (équipes opérations / terrain / finance). */
export const LIBELLE_STATUT_ETAPE: Record<StatutEtape, string> = {
  PLANIFIE: t('workflow:statuts.etape.PLANIFIE', { defaultValue: 'Planifié' }),
  EN_ATTENTE_ACTION: t('workflow:statuts.etape.EN_ATTENTE_ACTION', { defaultValue: 'En attente d’action' }),
  EN_COURS: t('workflow:statuts.etape.EN_COURS', { defaultValue: 'En cours' }),
  EN_ATTENTE_VALIDATION: t('workflow:statuts.etape.EN_ATTENTE_VALIDATION', { defaultValue: 'En attente de validation' }),
  TERMINE: t('workflow:statuts.etape.TERMINE', { defaultValue: 'Terminé' }),
  BLOQUE: t('workflow:statuts.etape.BLOQUE', { defaultValue: 'Bloqué' }),
  EN_RETARD: t('workflow:statuts.etape.EN_RETARD', { defaultValue: 'En retard' }),
  ANNULE: t('workflow:statuts.etape.ANNULE', { defaultValue: 'Annulé' }),
}

/**
 * Affichage client (§6.2) : le vocabulaire interne n'est jamais exposé tel
 * quel au client, qui voit une formulation neutre et rassurante.
 */
export const LIBELLE_STATUT_CLIENT: Record<StatutEtape, string> = {
  PLANIFIE: t('workflow:statuts.client.PLANIFIE', { defaultValue: 'À venir' }),
  EN_ATTENTE_ACTION: t('workflow:statuts.client.EN_ATTENTE_ACTION', { defaultValue: 'À traiter' }),
  EN_COURS: t('workflow:statuts.client.EN_COURS', { defaultValue: 'En cours' }),
  EN_ATTENTE_VALIDATION: t('workflow:statuts.client.EN_ATTENTE_VALIDATION', { defaultValue: 'En vérification' }),
  TERMINE: t('workflow:statuts.client.TERMINE', { defaultValue: 'Terminé' }),
  BLOQUE: t('workflow:statuts.client.BLOQUE', { defaultValue: 'Attention requise' }),
  EN_RETARD: t('workflow:statuts.client.EN_RETARD', { defaultValue: 'En retard' }),
  ANNULE: t('workflow:statuts.client.ANNULE', { defaultValue: 'Annulé' }),
}

export const LIBELLE_STATUT_CAMION: Record<StatutCamion, string> = {
  EN_COURS: t('workflow:statuts.camion.EN_COURS', { defaultValue: 'En cours' }),
  TERMINE: t('workflow:statuts.camion.TERMINE', { defaultValue: 'Terminé' }),
  BLOQUE: t('workflow:statuts.camion.BLOQUE', { defaultValue: 'Bloqué' }),
  ANNULE: t('workflow:statuts.camion.ANNULE', { defaultValue: 'Annulé' }),
}

/** Intitulé affiché pour chaque rôle (en-tête, sélecteur de compte). */
export const INTITULES_ROLE: Record<RoleUtilisateur, string> = {
  ADMIN: t('workflow:roles.ADMIN', { defaultValue: 'Administrateur' }),
  OPS: t('workflow:roles.OPS', { defaultValue: 'Responsable opérations' }),
  TERRAIN: t('workflow:roles.TERRAIN', { defaultValue: 'Agent terrain' }),
  FINANCE: t('workflow:roles.FINANCE', { defaultValue: 'Finance' }),
  CLIENT: t('workflow:roles.CLIENT', { defaultValue: 'Client' }),
}

export const LIBELLE_DOCUMENT: Record<string, string> = {
  BL: t('workflow:documents.BL', { defaultValue: 'Bon de livraison' }),
  TICKET_PESEE: t('workflow:documents.TICKET_PESEE', { defaultValue: 'Ticket de pesée' }),
  COA: t('workflow:documents.COA', { defaultValue: 'Certificat d’analyse (CoA)' }),
  AVIS_BANCAIRE: t('workflow:documents.AVIS_BANCAIRE', { defaultValue: 'Avis bancaire' }),
  DECLARATION_EXPORT: t('workflow:documents.DECLARATION_EXPORT', { defaultValue: 'Déclaration export' }),
  CMR: t('workflow:documents.CMR', { defaultValue: 'CMR / Lettre de voiture' }),
  DECLARATION_IMPORT: t('workflow:documents.DECLARATION_IMPORT', { defaultValue: 'Déclaration import' }),
  QUITTANCE: t('workflow:documents.QUITTANCE', { defaultValue: 'Quittance douanière' }),
  RECU_PEAGE: t('workflow:documents.RECU_PEAGE', { defaultValue: 'Reçu de péage' }),
  POD: t('workflow:documents.POD', { defaultValue: 'Preuve de livraison (POD)' }),
  TICKET_PESEE_MINE: t('workflow:documents.TICKET_PESEE_MINE', { defaultValue: 'Ticket de pesée mine' }),
  FACTURE_FINALE: t('workflow:documents.FACTURE_FINALE', { defaultValue: 'Facture finale' }),
  PREUVE_SOLDE: t('workflow:documents.PREUVE_SOLDE', { defaultValue: 'Preuve de règlement du solde' }),
  PHOTO: t('workflow:documents.PHOTO', { defaultValue: 'Photo' }),
  AUTRE: t('workflow:documents.AUTRE', { defaultValue: 'Autre document' }),
}

export function libelleDocument(type: string): string {
  return LIBELLE_DOCUMENT[type] ?? type.replaceAll('_', ' ').toLowerCase()
}

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

/**
 * Progression d'un camion : nombre d'étapes achevées sur 7.
 * `etape_courante` vaut 8 lorsque le dossier est clôturé.
 */
export function progressionCamion(camion: Pick<Camion, 'etape_courante'>): number {
  const achevees = Math.min(Math.max(camion.etape_courante - 1, 0), NB_ETAPES)
  return Math.round((achevees / NB_ETAPES) * 100)
}

/**
 * Progression d'un lot, PONDÉRÉE PAR LE TONNAGE (§5) :
 *   somme(tonnage camion × progression camion) ÷ tonnage total du lot
 * Les camions annulés sont exclus du calcul.
 */
export function progressionLot(camions: Camion[]): number {
  const actifs = camions.filter((c) => c.statut !== 'ANNULE')
  const tonnageTotal = actifs.reduce((s, c) => s + Number(c.tonnage_net_t), 0)
  if (tonnageTotal === 0) return 0
  const pondere = actifs.reduce(
    (s, c) => s + Number(c.tonnage_net_t) * progressionCamion(c),
    0,
  )
  return Math.round(pondere / tonnageTotal)
}

/** Tonnage cumulé d'une sélection de camions (hors annulés). */
export function tonnage(camions: Camion[]): number {
  return camions
    .filter((c) => c.statut !== 'ANNULE')
    .reduce((s, c) => s + Number(c.tonnage_net_t), 0)
}

/**
 * Tonnage déjà livré d'un lot : somme du tonnage net des camions dont le
 * dossier est clôturé (statut TERMINE).
 */
export function tonnageLivre(camions: Camion[]): number {
  return camions
    .filter((c) => c.statut === 'TERMINE')
    .reduce((s, c) => s + Number(c.tonnage_net_t), 0)
}

/* ------------------------------------------------------------------ */
/* SLA et retard                                                       */
/* ------------------------------------------------------------------ */

export function heuresDepuis(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 36e5
}

/**
 * Un camion est en retard lorsque son étape courante dépasse le SLA défini
 * au référentiel, sans avoir été soumise à validation (critère AC-05).
 */
export function estEnRetard(
  camion: Camion,
  referentiel: EtapeReferentiel[],
  evenementCourant?: EtapeEvenement,
): boolean {
  if (camion.statut === 'TERMINE' || camion.statut === 'ANNULE') return false
  if (evenementCourant?.statut === 'EN_ATTENTE_VALIDATION') return false
  const etape = referentiel.find((e) => e.numero === camion.etape_courante)
  if (!etape) return false
  return heuresDepuis(camion.derniere_maj_at) > etape.sla_heures
}

/** Heures de dépassement du SLA (0 si dans les temps). */
export function depassementSla(
  camion: Camion,
  referentiel: EtapeReferentiel[],
): number {
  const etape = referentiel.find((e) => e.numero === camion.etape_courante)
  if (!etape) return 0
  return Math.max(0, Math.round(heuresDepuis(camion.derniere_maj_at) - etape.sla_heures))
}

/* ------------------------------------------------------------------ */
/* Statut effectif d'une étape (moteur de la chronologie verticale)    */
/* ------------------------------------------------------------------ */

/**
 * Détermine l'état affiché d'une étape donnée pour un camion.
 * Priorité : blocage > étape passée > étape courante > étape future.
 */
export function statutEtape(
  camion: Camion,
  numero: number,
  evenements: EtapeEvenement[],
  referentiel: EtapeReferentiel[],
): StatutEtape {
  if (camion.statut === 'ANNULE') return 'ANNULE'

  const dernierEvenement = dernierEvenementEtape(evenements, numero)

  if (numero < camion.etape_courante) return 'TERMINE'
  if (numero > camion.etape_courante) return 'PLANIFIE'

  // Étape courante
  if (camion.statut === 'BLOQUE') return 'BLOQUE'
  if (dernierEvenement?.statut === 'EN_ATTENTE_VALIDATION') return 'EN_ATTENTE_VALIDATION'
  if (estEnRetard(camion, referentiel, dernierEvenement)) return 'EN_RETARD'
  return dernierEvenement ? 'EN_COURS' : 'EN_ATTENTE_ACTION'
}

/** Dernier événement enregistré pour une étape (la table est append-only). */
export function dernierEvenementEtape(
  evenements: EtapeEvenement[],
  numero: number,
): EtapeEvenement | undefined {
  return evenements
    .filter((e) => e.etape_numero === numero)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]
}

/* ------------------------------------------------------------------ */
/* Contrôle documentaire bloquant (§12.3 — critère AC-03)              */
/* ------------------------------------------------------------------ */

export interface ControleDocumentaire {
  complet: boolean
  manquants: string[]
  presents: string[]
}

/**
 * Une étape ne peut pas être validée sans les preuves obligatoires définies
 * pour l'itinéraire. C'est un contrôle BLOQUANT, pas un avertissement.
 */
export function controleDocumentaire(
  etape: EtapeReferentiel,
  documents: Document[],
  documentsEnCoursDeDepot: string[] = [],
): ControleDocumentaire {
  const presents = new Set<string>([
    ...documents.filter((d) => d.etape_numero === etape.numero).map((d) => d.type),
    ...documentsEnCoursDeDepot,
  ])
  const manquants = etape.documents_requis.filter((t) => !presents.has(t))
  return {
    complet: manquants.length === 0,
    manquants,
    presents: [...presents],
  }
}

/** Champs métier obligatoires non renseignés. */
export function champsManquants(
  etape: EtapeReferentiel,
  valeurs: Record<string, string>,
): string[] {
  return etape.champs
    .filter((c) => c.obligatoire && !String(valeurs[c.cle] ?? '').trim())
    .map((c) => c.libelle)
}

/* ------------------------------------------------------------------ */
/* Variantes par destination (§6.1 — critère AC-06)                    */
/* ------------------------------------------------------------------ */

/**
 * Applique la variante d'itinéraire aux options d'un champ « point atteint ».
 *
 * Les jalons proviennent de l'itinéraire paramétré dans l'application : sur
 * une route Lubumbashi, les jalons Kolwezi ne sont ni proposés ni requis
 * (critère AC-06).
 */
export function optionsChamp(
  cle: string,
  optionsParDefaut: string[] | undefined,
  jalons: string[],
): string[] {
  if (cle === 'point_atteint' && jalons.length > 0) return jalons
  return optionsParDefaut ?? []
}

/* ------------------------------------------------------------------ */
/* Séquence des étapes (§12.2)                                         */
/* ------------------------------------------------------------------ */

/**
 * La séquence est progressive : seule l'étape courante est actionnable.
 * Un saut d'étape exige un rôle habilité et un motif (hors périmètre MVP).
 */
export function etapeActionnable(camion: Camion, numero: number): boolean {
  return camion.statut !== 'ANNULE' && camion.statut !== 'TERMINE' && numero === camion.etape_courante
}
