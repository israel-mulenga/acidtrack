/**
 * Profils de démonstration.
 *
 * Choix MVP assumé : l'authentification réelle (Supabase Auth) est remplacée
 * par une bascule de profil. Le branchement consistera à remplacer cette
 * liste par la table `utilisateurs`, sans toucher à la matrice de droits.
 */

import type { RoleUtilisateur } from './types'

export interface Profil {
  id: string
  nom: string
  role: RoleUtilisateur
  intitule: string
  organisation_id: string
  /** Renseigné pour un profil client : restreint la visibilité à ce client. */
  client_id: string | null
}

const ORG = '11111111-1111-1111-1111-111111111111'

export const PROFILS: Profil[] = [
  {
    id: '66666666-6666-6666-6666-666666666601',
    nom: 'Joseph Kabeya',
    role: 'OPS',
    intitule: 'Responsable opérations',
    organisation_id: ORG,
    client_id: null,
  },
  {
    id: '66666666-6666-6666-6666-666666666602',
    nom: 'Alain Tshibangu',
    role: 'TERRAIN',
    intitule: 'Agent terrain / transitaire',
    organisation_id: ORG,
    client_id: null,
  },
  {
    id: '66666666-6666-6666-6666-666666666603',
    nom: 'Patrick Mwamba',
    role: 'CLIENT',
    intitule: 'Client — Kamoto Copper Company',
    organisation_id: ORG,
    client_id: '22222222-2222-2222-2222-222222222221',
  },
  {
    id: '66666666-6666-6666-6666-666666666604',
    nom: 'Sarah Ilunga',
    role: 'ADMIN',
    intitule: 'Administratrice',
    organisation_id: ORG,
    client_id: null,
  },
]
