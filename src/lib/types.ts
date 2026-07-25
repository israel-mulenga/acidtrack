/**
 * Types du domaine AcidTrack — miroir du schéma Postgres (supabase/01_schema.sql).
 */

export type StatutEtape =
  | 'PLANIFIE'
  | 'EN_ATTENTE_ACTION'
  | 'EN_COURS'
  | 'EN_ATTENTE_VALIDATION'
  | 'TERMINE'
  | 'BLOQUE'
  | 'EN_RETARD'
  | 'ANNULE'

export type StatutCamion = 'EN_COURS' | 'TERMINE' | 'BLOQUE' | 'ANNULE'

export type RoleUtilisateur = 'ADMIN' | 'OPS' | 'TERRAIN' | 'FINANCE' | 'CLIENT'

export type GraviteIncident = 'FAIBLE' | 'MOYENNE' | 'ELEVEE' | 'CRITIQUE'

export type TypeChamp = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea'

export interface ChampEtape {
  cle: string
  libelle: string
  type: TypeChamp
  obligatoire: boolean
  unite?: string
  options?: string[]
}

/**
 * Une macro-étape telle que définie dans un modèle. Le référentiel n'est
 * plus figé : chaque itinéraire peut porter sa propre séquence.
 */
export interface EtapeReferentiel {
  id: string
  modele_id: string
  numero: number
  code: string
  libelle: string
  objectif: string
  responsable: string
  sla_heures: number
  documents_requis: string[]
  champs: ChampEtape[]
}

export interface ModeleEtapes {
  id: string
  organisation_id: string
  nom: string
  description: string | null
  par_defaut: boolean
  actif: boolean
}

export interface PointChargement {
  id: string
  organisation_id: string
  nom: string
  ville: string | null
  pays: string
  contact_nom: string | null
  contact_tel: string | null
  actif: boolean
}

export interface Itineraire {
  id: string
  organisation_id: string
  nom: string
  point_chargement_id: string | null
  origine: string
  destination: string
  corridor: string
  /** Points de contrôle réellement empruntés — pilote le masquage AC-06. */
  jalons: string[]
  distance_km: number | null
  duree_estimee_h: number | null
  modele_etapes_id: string | null
  actif: boolean
}

export interface Organisation {
  id: string
  nom: string
  plan: string
  langue: string
  fuseau: string
  devise: string
  logo_url: string | null
  statut: 'ACTIF' | 'SUSPENDU'
}

export interface Utilisateur {
  id: string
  organisation_id: string
  nom: string
  role: RoleUtilisateur
  email: string | null
  telephone: string | null
  client_id: string | null
  /** Rattachement au compte Supabase Auth ; null tant que l'invitation n'est pas réclamée. */
  auth_id: string | null
  statut: 'INVITE' | 'ACTIF' | 'SUSPENDU'
}

export interface Client {
  id: string
  organisation_id: string
  raison_sociale: string
  mine: string | null
  ville: string | null
  contact_nom: string | null
  contact_tel: string | null
  actif: boolean
}

export interface Commande {
  id: string
  organisation_id: string
  client_id: string
  reference: string
  produit: string
  concentration: string | null
  quantite_commandee_t: number
  prix_unitaire_usd: number | null
  origine: string
  destination: string
  conditions_paiement: string | null
  statut: string
}

export interface Lot {
  id: string
  organisation_id: string
  commande_id: string
  reference: string
  corridor: string
  destination: string
  quantite_planifiee_t: number
  nb_camions_prevu: number
  periode_debut: string | null
  periode_fin: string | null
  statut: string
  itineraire_id: string | null
  modele_etapes_id: string | null
}

export interface Camion {
  id: string
  organisation_id: string
  lot_id: string
  reference: string
  plaque_tracteur: string
  plaque_citerne: string | null
  transporteur: string | null
  chauffeur_nom: string | null
  chauffeur_tel: string | null
  capacite_t: number | null
  tonnage_net_t: number
  numeros_scelles: string | null
  etape_courante: number
  statut: StatutCamion
  eta: string | null
  derniere_position_lat: number | null
  derniere_position_lng: number | null
  derniere_position_lib: string | null
  derniere_maj_at: string
  derniere_maj_par: string | null
  created_at: string
}

export interface EtapeEvenement {
  id: string
  organisation_id: string
  camion_id: string
  etape_numero: number
  statut: StatutEtape
  commentaire: string | null
  donnees: Record<string, string>
  position_lat: number | null
  position_lng: number | null
  position_lib: string | null
  position_source: string | null
  auteur_nom: string
  auteur_role: RoleUtilisateur
  valide_par: string | null
  valide_at: string | null
  motif_rejet: string | null
  version: number
  created_at: string
}

export interface Document {
  id: string
  organisation_id: string
  camion_id: string
  evenement_id: string | null
  etape_numero: number | null
  type: string
  nom_fichier: string
  chemin_storage: string | null
  url: string | null
  mime: string | null
  taille_octets: number | null
  visible_client: boolean
  statut: string
  depose_par: string | null
  created_at: string
}

export interface Incident {
  id: string
  organisation_id: string
  camion_id: string
  etape_numero: number | null
  categorie: string
  gravite: GraviteIncident
  description: string
  responsable: string | null
  plan_action: string | null
  statut: string
  ouvert_par: string | null
  resolu_at: string | null
  resolution: string | null
  created_at: string
}

export interface Paiement {
  id: string
  organisation_id: string
  commande_id: string
  camion_id: string | null
  type: string
  montant: number
  devise: string
  reference: string | null
  date_valeur: string | null
  statut: string
}

/** Camion enrichi des données de contexte nécessaires aux écrans. */
export interface CamionEnrichi extends Camion {
  lot: Lot
  commande: Commande
  client: Client
}
