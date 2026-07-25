/**
 * Session applicative — authentification Supabase réelle.
 *
 * `profil` est dérivé de la ligne `utilisateurs` rattachée au compte
 * Supabase Auth connecté (via `auth_id`). Le modèle de droits ci-dessous
 * est celui qui pilote l'affichage ; la RLS (supabase/04_auth_rls.sql)
 * applique la même logique côté base, pour que l'isolation des données
 * ne repose jamais uniquement sur le front.
 *
 * En développement, un sélecteur permet de se connecter directement avec
 * l'un des comptes de démonstration (cf. lib/profils.ts) — il s'agit
 * d'une vraie connexion Supabase Auth, pas d'une simulation.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { RoleUtilisateur, Utilisateur } from './lib/types'
import { MOT_DE_PASSE_DEMO } from './lib/profils'
import { connecter, deconnecter } from './lib/auth'

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
  | 'administrer_referentiel' // clients, itinéraires, modèles d'étapes
  | 'administrer_commercial' // commandes, lots, dossiers camions
  | 'administrer_utilisateurs' // organisations, comptes et rôles

const DROITS: Record<RoleUtilisateur, Permission[]> = {
  ADMIN: [
    'voir_operations',
    'saisir_etape',
    'valider_etape',
    'ouvrir_incident',
    'resoudre_incident',
    'voir_documents_sensibles',
    'voir_finance',
    'administrer_referentiel',
    'administrer_commercial',
    'administrer_utilisateurs',
  ],
  // Les opérations pilotent le commercial et le référentiel, mais ne
  // gèrent pas les comptes utilisateurs (§7).
  OPS: [
    'voir_operations',
    'saisir_etape',
    'valider_etape',
    'ouvrir_incident',
    'resoudre_incident',
    'voir_documents_sensibles',
    'voir_finance',
    'administrer_referentiel',
    'administrer_commercial',
  ],
  // L'agent terrain saisit mais ne valide pas son propre travail (§7)
  TERRAIN: ['voir_operations', 'saisir_etape', 'ouvrir_incident'],
  FINANCE: ['voir_operations', 'saisir_etape', 'voir_documents_sensibles', 'voir_finance'],
  // Le client est en lecture seule et ne voit aucune pièce sensible
  CLIENT: [],
}

/** Activable en développement pour afficher le sélecteur de compte démo. */
const BASCULE_DEMO_ACTIVE =
  import.meta.env.DEV && import.meta.env.VITE_DEV_PROFILE_SWITCH === 'true'

interface SessionContexte {
  chargement: boolean
  session: Session | null
  /** null tant que le compte connecté n'est pas rattaché à une organisation. */
  profil: Utilisateur | null
  peut: (permission: Permission) => boolean
  estClient: boolean
  deconnecter: () => Promise<void>
  rafraichirProfil: () => Promise<void>
  basculeDemoActive: boolean
  basculerProfilDemo: (email: string) => Promise<void>
}

const Contexte = createContext<SessionContexte | null>(null)

async function chargerProfil(authId: string): Promise<Utilisateur | null> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle()
  if (error) {
    console.error('Chargement du profil impossible', error)
    return null
  }
  return data as Utilisateur | null
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [chargement, setChargement] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Utilisateur | null>(null)

  const rafraichirProfil = async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) setProfil(await chargerProfil(data.session.user.id))
  }

  useEffect(() => {
    let actif = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!actif) return
      setSession(data.session)
      if (data.session) setProfil(await chargerProfil(data.session.user.id))
      setChargement(false)
    })

    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, nouvelleSession) => {
      setSession(nouvelleSession)
      if (nouvelleSession) {
        chargerProfil(nouvelleSession.user.id).then((p) => {
          if (actif) setProfil(p)
        })
      } else {
        setProfil(null)
      }
      setChargement(false)
    })

    return () => {
      actif = false
      abonnement.subscription.unsubscribe()
    }
  }, [])

  const valeur = useMemo<SessionContexte>(
    () => ({
      chargement,
      session,
      profil,
      peut: (permission) => (profil ? DROITS[profil.role].includes(permission) : false),
      estClient: profil?.role === 'CLIENT',
      deconnecter,
      rafraichirProfil,
      basculeDemoActive: BASCULE_DEMO_ACTIVE,
      basculerProfilDemo: async (email: string) => {
        await connecter(email, MOT_DE_PASSE_DEMO)
      },
    }),
    [chargement, session, profil],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionContexte {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useSession doit être utilisé dans un SessionProvider')
  return contexte
}

/**
 * Variante du profil garantie non nulle, pour les écrans qui ne sont
 * jamais rendus avant qu'un utilisateur ne soit rattaché à une
 * organisation (tout ce qui vit sous `<Application>`, cf. App.tsx).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useUtilisateur(): Utilisateur {
  const { profil } = useSession()
  if (!profil) throw new Error('Aucun utilisateur rattaché à la session.')
  return profil
}
