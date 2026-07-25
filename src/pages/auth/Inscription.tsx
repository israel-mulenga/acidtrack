/**
 * Inscription — deux parcours distincts :
 *  1. Créer une organisation (self-service) : devient administrateur.
 *  2. Rejoindre une organisation existante : nécessite d'avoir été invité
 *     par un administrateur avec la même adresse e-mail.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, Loader2 } from 'lucide-react'
import { inscrireOrganisation, rejoindreInvitation } from '@/lib/auth'
import { Bouton, Carte, Champ, Encart, Etiquette } from '@/components/ui'
import { cn } from '@/lib/utils'

type Parcours = 'organisation' | 'invitation'

export function Inscription() {
  const [parcours, setParcours] = useState<Parcours>('organisation')
  const [nomOrganisation, setNomOrganisation] = useState('')
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState(false)

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      if (parcours === 'organisation') {
        await inscrireOrganisation({
          nomOrganisation: nomOrganisation.trim(),
          nomUtilisateur: nomUtilisateur.trim(),
          email: email.trim(),
          motDePasse,
        })
      } else {
        await rejoindreInvitation({ email: email.trim(), motDePasse })
      }
      setSucces(true)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Inscription impossible.')
    } finally {
      setEnvoi(false)
    }
  }

  if (succes) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ardoise-50 px-4">
        <Carte className="w-full max-w-sm p-5 text-center">
          <p className="text-base font-semibold text-ardoise-900">Bienvenue sur AcidTrack !</p>
          <p className="mt-2 text-sm text-ardoise-500">
            Votre compte est prêt. L’application se charge automatiquement.
          </p>
        </Carte>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ardoise-50 px-4 py-8">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2">
          <span className="grid size-11 place-items-center rounded-xl bg-ardoise-900">
            <Container className="size-6 text-ambre-500" strokeWidth={2.5} />
          </span>
          <p className="text-lg font-semibold tracking-tight text-ardoise-900">AcidTrack</p>
        </div>

        <Carte className="p-5">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ardoise-100 p-1">
            <button
              type="button"
              onClick={() => setParcours('organisation')}
              className={cn(
                'rounded-md py-2 text-sm font-medium transition-colors',
                parcours === 'organisation'
                  ? 'bg-white text-ardoise-900 shadow-xs'
                  : 'text-ardoise-500',
              )}
            >
              Nouvelle organisation
            </button>
            <button
              type="button"
              onClick={() => setParcours('invitation')}
              className={cn(
                'rounded-md py-2 text-sm font-medium transition-colors',
                parcours === 'invitation'
                  ? 'bg-white text-ardoise-900 shadow-xs'
                  : 'text-ardoise-500',
              )}
            >
              J’ai été invité(e)
            </button>
          </div>

          {erreur && (
            <Encart ton="erreur" className="mb-4">
              {erreur}
            </Encart>
          )}

          {parcours === 'invitation' && (
            <Encart ton="info" className="mb-4">
              Utilisez la même adresse e-mail que celle communiquée par votre administrateur.
            </Encart>
          )}

          <form onSubmit={(e) => void soumettre(e)} className="space-y-3.5">
            {parcours === 'organisation' && (
              <div>
                <Etiquette htmlFor="org" obligatoire>
                  Nom de l’organisation
                </Etiquette>
                <Champ
                  id="org"
                  required
                  placeholder="Sulfachem Logistics"
                  value={nomOrganisation}
                  onChange={(e) => setNomOrganisation(e.target.value)}
                />
              </div>
            )}
            {parcours === 'organisation' && (
              <div>
                <Etiquette htmlFor="nom" obligatoire>
                  Votre nom complet
                </Etiquette>
                <Champ
                  id="nom"
                  required
                  value={nomUtilisateur}
                  onChange={(e) => setNomUtilisateur(e.target.value)}
                />
              </div>
            )}
            <div>
              <Etiquette htmlFor="email" obligatoire>
                E-mail
              </Etiquette>
              <Champ
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Etiquette htmlFor="mdp" obligatoire>
                Mot de passe
              </Etiquette>
              <Champ
                id="mdp"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
            </div>

            <Bouton type="submit" className="w-full" disabled={envoi}>
              {envoi && <Loader2 className="size-4 animate-spin" />}
              {parcours === 'organisation' ? 'Créer mon organisation' : 'Rejoindre l’organisation'}
            </Bouton>
          </form>

          <p className="mt-4 text-center text-sm text-ardoise-500">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="font-medium text-ardoise-900 hover:underline">
              Se connecter
            </Link>
          </p>
        </Carte>
      </div>
    </div>
  )
}
