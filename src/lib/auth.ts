/**
 * Authentification Supabase — connexion, inscription et invitations.
 *
 * Deux façons de rejoindre une organisation :
 *  1. `inscrireOrganisation` : self-service, crée une nouvelle organisation
 *     et son premier compte ADMIN.
 *  2. `rejoindreInvitation` : un administrateur a déjà créé la ligne
 *     `utilisateurs` (via `inviterUtilisateur`) ; la personne invitée
 *     s'inscrit avec la même adresse e-mail puis réclame son compte.
 *
 * Ces deux chemins passent par des fonctions Postgres SECURITY DEFINER
 * (cf. supabase/04_auth_rls.sql) : la table `organisations` n'accepte
 * aucune insertion directe, ce qui empêche un compte quelconque de
 * rattacher ses données à une organisation qui n'est pas la sienne.
 */

import type { RoleUtilisateur } from './types'
import { supabase } from './supabase'
import { ErreurMetier } from './actions'

export class ErreurAuth extends ErreurMetier {}

function relayer(erreur: { message: string } | null): void {
  if (erreur) throw new ErreurAuth(erreur.message)
}

export async function connecter(email: string, motDePasse: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
  relayer(error)
}

export async function deconnecter(): Promise<void> {
  await supabase.auth.signOut()
}

/** Crée le compte Auth, puis l'organisation et son administrateur. */
export async function inscrireOrganisation(params: {
  nomOrganisation: string
  nomUtilisateur: string
  email: string
  motDePasse: string
}): Promise<void> {
  const { error: erreurInscription, data } = await supabase.auth.signUp({
    email: params.email,
    password: params.motDePasse,
  })
  relayer(erreurInscription)

  if (!data.session) {
    throw new ErreurAuth(
      "Compte créé, mais aucune session n'a été ouverte. Vérifiez que la " +
        "confirmation par e-mail est désactivée pour la démo (Authentication > " +
        'Providers > Email > Confirm email), puis reconnectez-vous.',
    )
  }

  const { error } = await supabase.rpc('creer_organisation', {
    p_nom_org: params.nomOrganisation,
    p_nom_utilisateur: params.nomUtilisateur,
  })
  relayer(error)
}

/** Crée le compte Auth d'une personne déjà invitée, puis réclame son accès. */
export async function rejoindreInvitation(params: {
  email: string
  motDePasse: string
}): Promise<void> {
  const { error: erreurInscription, data } = await supabase.auth.signUp({
    email: params.email,
    password: params.motDePasse,
  })
  relayer(erreurInscription)

  if (!data.session) {
    throw new ErreurAuth(
      "Compte créé, mais aucune session n'a été ouverte. Vérifiez que la " +
        'confirmation par e-mail est désactivée pour la démo, puis reconnectez-vous.',
    )
  }

  await reclamerInvitation()
}

/** Réclame une invitation en attente pour l'utilisateur déjà connecté. */
export async function reclamerInvitation(): Promise<void> {
  const { error } = await supabase.rpc('rejoindre_organisation')
  relayer(error)
}

export async function demanderReinitialisation(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
  })
  relayer(error)
}

export async function definirNouveauMotDePasse(motDePasse: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: motDePasse })
  relayer(error)
}

/** Invitation d'un utilisateur par un administrateur (§ organisation). */
export async function inviterUtilisateur(params: {
  email: string
  nom: string
  role: RoleUtilisateur
  clientId?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('inviter_utilisateur', {
    p_email: params.email,
    p_nom: params.nom,
    p_role: params.role,
    p_client_id: params.clientId ?? null,
  })
  relayer(error)
}
