/**
 * Session applicative — sélecteur de profil.
 *
 * Choix MVP assumé : l'authentification réelle (Supabase Auth) est remplacée
 * par une bascule de profil. Le modèle de droits, lui, est bien réel : chaque
 * écran et chaque action interrogent `peut()` ci-dessous. Le branchement sur
 * Supabase Auth consistera à remplacer la source de `utilisateur` sans
 * toucher aux règles.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RoleUtilisateur } from './lib/types'

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
]

/* ------------------------------------------------------------------ */
/* Matrice de droits (§7 du cahier des charges)                        */
/* ------------------------------------------------------------------ */

export type Permission =
  | 'voir_operations' // tour de contrôle, exceptions, tous les lots
  | 'saisir_etape' // soumettre une mise à jour d'étape
  | 'valider_etape' // approuver ou rejeter une soumission
  | 'ouvrir_incident'
  | 'resoudre_incident'
  | 'voir_documents_sensibles' // avis bancaires, quittances, prix
  | 'voir_finance'

const DROITS: Record<RoleUtilisateur, Permission[]> = {
  ADMIN: [
    'voir_operations',
    'saisir_etape',
    'valider_etape',
    'ouvrir_incident',
    'resoudre_incident',
    'voir_documents_sensibles',
    'voir_finance',
  ],
  OPS: [
    'voir_operations',
    'saisir_etape',
    'valider_etape',
    'ouvrir_incident',
    'resoudre_incident',
    'voir_documents_sensibles',
    'voir_finance',
  ],
  // L'agent terrain saisit mais ne valide pas son propre travail (§7)
  TERRAIN: ['voir_operations', 'saisir_etape', 'ouvrir_incident'],
  FINANCE: ['voir_operations', 'saisir_etape', 'voir_documents_sensibles', 'voir_finance'],
  // Le client est en lecture seule et ne voit aucune pièce sensible
  CLIENT: [],
}

interface SessionContexte {
  profil: Profil
  setProfil: (p: Profil) => void
  peut: (permission: Permission) => boolean
  estClient: boolean
}

const Contexte = createContext<SessionContexte | null>(null)

const CLE_STOCKAGE = 'acidtrack.profil'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profil, setProfilInterne] = useState<Profil>(() => {
    const enregistre = localStorage.getItem(CLE_STOCKAGE)
    return PROFILS.find((p) => p.id === enregistre) ?? PROFILS[0]
  })

  useEffect(() => {
    localStorage.setItem(CLE_STOCKAGE, profil.id)
  }, [profil])

  const valeur = useMemo<SessionContexte>(
    () => ({
      profil,
      setProfil: setProfilInterne,
      peut: (permission) => DROITS[profil.role].includes(permission),
      estClient: profil.role === 'CLIENT',
    }),
    [profil],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionContexte {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useSession doit être utilisé dans un SessionProvider')
  return contexte
}
