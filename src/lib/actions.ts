/**
 * Écritures métier.
 *
 * Règle structurante : la table `etape_evenements` est APPEND-ONLY (§12.5).
 * Une correction ne modifie jamais une ligne existante, elle crée une
 * nouvelle version. L'historique constitue de fait le journal d'audit.
 */

import { BUCKET_PREUVES, supabase } from './supabase'
import type { Camion, EtapeReferentiel, GraviteIncident, RoleUtilisateur } from './types'
import { NB_ETAPES, champsManquants, controleDocumentaire } from './workflow'
import type { Document } from './types'

export class ErreurMetier extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'ErreurMetier'
    this.details = details
  }
}

/* ------------------------------------------------------------------ */
/* Dépôt d'une preuve dans Supabase Storage                            */
/* ------------------------------------------------------------------ */

export interface PreuveALoader {
  type: string
  fichier: File
}

async function deposerPreuve(
  camion: Camion,
  etapeNumero: number,
  preuve: PreuveALoader,
  auteur: string,
  evenementId: string | null,
) {
  const extension = preuve.fichier.name.split('.').pop() ?? 'bin'
  const chemin = `${camion.organisation_id}/${camion.reference}/E${etapeNumero}-${preuve.type}-${Date.now()}.${extension}`

  const { error: erreurUpload } = await supabase.storage
    .from(BUCKET_PREUVES)
    .upload(chemin, preuve.fichier, { upsert: false, contentType: preuve.fichier.type })

  if (erreurUpload) {
    throw new ErreurMetier(`Le dépôt du document a échoué : ${erreurUpload.message}`)
  }

  const { data: publique } = supabase.storage.from(BUCKET_PREUVES).getPublicUrl(chemin)

  const { error } = await supabase.from('documents').insert({
    organisation_id: camion.organisation_id,
    camion_id: camion.id,
    evenement_id: evenementId,
    etape_numero: etapeNumero,
    type: preuve.type,
    nom_fichier: preuve.fichier.name,
    chemin_storage: chemin,
    url: publique.publicUrl,
    mime: preuve.fichier.type,
    taille_octets: preuve.fichier.size,
    // Les pièces financières et douanières ne sont pas exposées au client
    visible_client: !['AVIS_BANCAIRE', 'QUITTANCE', 'FACTURE_FINALE', 'PREUVE_SOLDE'].includes(
      preuve.type,
    ),
    depose_par: auteur,
  })

  if (error) throw new ErreurMetier(`Enregistrement du document impossible : ${error.message}`)
}

/* ------------------------------------------------------------------ */
/* Soumission d'une mise à jour d'étape                                */
/* ------------------------------------------------------------------ */

export interface SoumissionEtape {
  camion: Camion
  etape: EtapeReferentiel
  valeurs: Record<string, string>
  commentaire: string
  position: { lat: number; lng: number; libelle: string; source: string } | null
  preuves: PreuveALoader[]
  documentsExistants: Document[]
  auteurNom: string
  auteurRole: RoleUtilisateur
  /** true si le rôle possède le droit de valider (l'étape est alors clôturée). */
  autoValidation: boolean
  /** Enregistrer une progression sans clôturer l'étape. */
  brouillon?: boolean
}

export interface ResultatSoumission {
  cloturee: boolean
  enAttenteValidation: boolean
}

/**
 * Cœur du produit. Enchaîne, dans l'ordre :
 *   1. contrôle des champs obligatoires ;
 *   2. contrôle documentaire BLOQUANT (AC-03) ;
 *   3. dépôt des preuves dans Storage ;
 *   4. écriture de l'événement (append-only) ;
 *   5. avancement du camion si l'étape est clôturée.
 */
export async function soumettreEtape(s: SoumissionEtape): Promise<ResultatSoumission> {
  const cloture = !s.brouillon

  if (cloture) {
    // 1. Champs métier obligatoires
    const manquants = champsManquants(s.etape, s.valeurs)
    if (manquants.length > 0) {
      throw new ErreurMetier(
        'Renseignez les informations obligatoires avant de valider cette étape.',
        manquants,
      )
    }

    // 2. Preuves obligatoires — contrôle bloquant (§12.3, AC-03)
    const controle = controleDocumentaire(
      s.etape,
      s.documentsExistants,
      s.preuves.map((p) => p.type),
    )
    if (!controle.complet) {
      throw new ErreurMetier(
        "Cette étape ne peut pas être validée : des preuves obligatoires sont manquantes.",
        controle.manquants,
      )
    }
  }

  // 3 & 4. Événement puis preuves rattachées
  const statut = !cloture
    ? 'EN_COURS'
    : s.autoValidation
      ? 'TERMINE'
      : 'EN_ATTENTE_VALIDATION'

  const { data: evenement, error } = await supabase
    .from('etape_evenements')
    .insert({
      organisation_id: s.camion.organisation_id,
      camion_id: s.camion.id,
      etape_numero: s.etape.numero,
      statut,
      commentaire: s.commentaire || null,
      donnees: s.valeurs,
      position_lat: s.position?.lat ?? null,
      position_lng: s.position?.lng ?? null,
      position_lib: s.position?.libelle ?? null,
      position_source: s.position?.source ?? null,
      auteur_nom: s.auteurNom,
      auteur_role: s.auteurRole,
      valide_par: statut === 'TERMINE' ? s.auteurNom : null,
      valide_at: statut === 'TERMINE' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) throw new ErreurMetier(`Enregistrement impossible : ${error.message}`)

  for (const preuve of s.preuves) {
    await deposerPreuve(s.camion, s.etape.numero, preuve, s.auteurNom, evenement.id)
  }

  // 5. Avancement du dossier
  const majCamion: Record<string, unknown> = {
    derniere_maj_at: new Date().toISOString(),
    derniere_maj_par: s.auteurNom,
  }
  if (s.position) {
    majCamion.derniere_position_lat = s.position.lat
    majCamion.derniere_position_lng = s.position.lng
    majCamion.derniere_position_lib = s.position.libelle
  }
  if (statut === 'TERMINE') {
    majCamion.etape_courante = Math.min(s.etape.numero + 1, NB_ETAPES + 1)
    if (s.etape.numero === NB_ETAPES) majCamion.statut = 'TERMINE'
  }

  const { error: erreurCamion } = await supabase
    .from('camions')
    .update(majCamion)
    .eq('id', s.camion.id)

  if (erreurCamion) throw new ErreurMetier(`Mise à jour du camion impossible : ${erreurCamion.message}`)

  return {
    cloturee: statut === 'TERMINE',
    enAttenteValidation: statut === 'EN_ATTENTE_VALIDATION',
  }
}

/* ------------------------------------------------------------------ */
/* Validation / rejet par un rôle habilité (§8.3.5 — AC-04)            */
/* ------------------------------------------------------------------ */

export async function validerEvenement(
  evenementId: string,
  camion: Camion,
  etapeNumero: number,
  valideur: string,
) {
  const { error } = await supabase
    .from('etape_evenements')
    .update({ statut: 'TERMINE', valide_par: valideur, valide_at: new Date().toISOString() })
    .eq('id', evenementId)

  if (error) throw new ErreurMetier(`Validation impossible : ${error.message}`)

  await supabase
    .from('camions')
    .update({
      etape_courante: Math.min(etapeNumero + 1, NB_ETAPES + 1),
      statut: etapeNumero === NB_ETAPES ? 'TERMINE' : camion.statut,
      derniere_maj_at: new Date().toISOString(),
      derniere_maj_par: valideur,
    })
    .eq('id', camion.id)
}

/**
 * Rejet motivé : l'étape revient « à traiter » pour son auteur, le motif
 * reste consultable dans l'historique.
 */
export async function rejeterEvenement(
  evenementId: string,
  camionId: string,
  motif: string,
  valideur: string,
) {
  if (!motif.trim()) throw new ErreurMetier('Le motif de rejet est obligatoire.')

  const { error } = await supabase
    .from('etape_evenements')
    .update({
      statut: 'EN_ATTENTE_ACTION',
      motif_rejet: motif,
      valide_par: valideur,
      valide_at: new Date().toISOString(),
    })
    .eq('id', evenementId)

  if (error) throw new ErreurMetier(`Rejet impossible : ${error.message}`)

  await supabase
    .from('camions')
    .update({ derniere_maj_at: new Date().toISOString(), derniere_maj_par: valideur })
    .eq('id', camionId)
}

/* ------------------------------------------------------------------ */
/* Incidents (§8.9)                                                    */
/* ------------------------------------------------------------------ */

export interface NouvelIncident {
  camion: Camion
  etapeNumero: number
  categorie: string
  gravite: GraviteIncident
  description: string
  responsable: string
  planAction: string
  auteur: string
}

/** Un incident CRITIQUE bascule le camion en BLOQUÉ via un trigger Postgres. */
export async function ouvrirIncident(i: NouvelIncident) {
  if (!i.description.trim()) throw new ErreurMetier('La description de l’incident est obligatoire.')

  const { error } = await supabase.from('incidents').insert({
    organisation_id: i.camion.organisation_id,
    camion_id: i.camion.id,
    etape_numero: i.etapeNumero,
    categorie: i.categorie,
    gravite: i.gravite,
    description: i.description,
    responsable: i.responsable || null,
    plan_action: i.planAction || null,
    ouvert_par: i.auteur,
  })

  if (error) throw new ErreurMetier(`Création de l’incident impossible : ${error.message}`)
}

export async function resoudreIncident(incidentId: string, resolution: string) {
  if (!resolution.trim()) throw new ErreurMetier('Décrivez la résolution de l’incident.')

  const { error } = await supabase
    .from('incidents')
    .update({ statut: 'RESOLU', resolution, resolu_at: new Date().toISOString() })
    .eq('id', incidentId)

  if (error) throw new ErreurMetier(`Résolution impossible : ${error.message}`)
}

/* ------------------------------------------------------------------ */
/* Géolocalisation (§8.7 — capture avec consentement)                  */
/* ------------------------------------------------------------------ */

export function capturerPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new ErreurMetier('La géolocalisation n’est pas disponible sur cet appareil.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () =>
        reject(
          new ErreurMetier(
            'Position refusée ou indisponible. Vous pouvez saisir le lieu manuellement.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
