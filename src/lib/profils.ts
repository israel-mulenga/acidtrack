/**
 * Comptes de démonstration.
 *
 * L'authentification est réelle (Supabase Auth). En développement, un
 * sélecteur permet néanmoins de basculer rapidement d'un rôle à l'autre :
 * il ne fait rien de plus que se connecter avec l'un de ces comptes,
 * seedés par `supabase/05_seed_auth.sql` avec un mot de passe commun.
 * La matrice de droits (session.tsx) et la RLS restent les mêmes qu'en
 * production — la bascule exerce donc un vrai rôle, pas une simulation.
 */

import type { RoleUtilisateur } from './types'

/** Mot de passe commun aux comptes de démonstration (cf. 05_seed_auth.sql). */
export const MOT_DE_PASSE_DEMO = 'AcidTrack2024!'

export interface CompteDemo {
  email: string
  nom: string
  role: RoleUtilisateur
  intitule: string
}

export const PROFILS: CompteDemo[] = [
  {
    email: 'admin@sulfachem.cd',
    nom: 'Sarah Ilunga',
    role: 'ADMIN',
    intitule: 'Administratrice',
  },
  {
    email: 'ops@sulfachem.cd',
    nom: 'Joseph Kabeya',
    role: 'OPS',
    intitule: 'Responsable opérations',
  },
  {
    email: 'terrain@sulfachem.cd',
    nom: 'Alain Tshibangu',
    role: 'TERRAIN',
    intitule: 'Agent terrain / transitaire',
  },
  {
    email: 'finance@sulfachem.cd',
    nom: 'Nadine Kalonji',
    role: 'FINANCE',
    intitule: 'Finance',
  },
  {
    email: 'patrick@kcc.cd',
    nom: 'Patrick Mwamba',
    role: 'CLIENT',
    intitule: 'Client — Kamoto Copper Company',
  },
]
