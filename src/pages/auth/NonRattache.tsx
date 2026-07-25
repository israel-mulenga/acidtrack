/**
 * Compte authentifié mais non rattaché à une organisation : soit
 * l'invitation n'a pas encore été réclamée (délai, mauvaise manip), soit
 * il n'existe aucune invitation pour cette adresse e-mail.
 */

import { useState } from 'react'
import { Container, Loader2 } from 'lucide-react'
import { reclamerInvitation } from '@/lib/auth'
import { useSession } from '@/session'
import { Bouton, Carte, Encart } from '@/components/ui'

export function NonRattache() {
  const { deconnecter, rafraichirProfil, session } = useSession()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const reessayer = async () => {
    setEnvoi(true)
    setErreur(null)
    try {
      await reclamerInvitation()
      await rafraichirProfil()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Aucune invitation trouvée.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ardoise-50 px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2">
          <span className="grid size-11 place-items-center rounded-xl bg-ardoise-900">
            <Container className="size-6 text-ambre-500" strokeWidth={2.5} />
          </span>
          <p className="text-lg font-semibold tracking-tight text-ardoise-900">AcidTrack</p>
        </div>

        <Carte className="p-5 text-center">
          <p className="text-base font-semibold text-ardoise-900">Compte non rattaché</p>
          <p className="mt-2 text-sm text-ardoise-500">
            {session?.user.email} est connecté mais n’est rattaché à aucune organisation. Si vous
            venez d’être invité(e), réessayez ci-dessous.
          </p>

          {erreur && (
            <Encart ton="erreur" className="mt-4 text-left">
              {erreur}
            </Encart>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <Bouton onClick={() => void reessayer()} disabled={envoi}>
              {envoi && <Loader2 className="size-4 animate-spin" />}
              Réessayer de rejoindre mon invitation
            </Bouton>
            <Bouton variante="secondaire" onClick={() => void deconnecter()}>
              Se déconnecter
            </Bouton>
          </div>
        </Carte>
      </div>
    </div>
  )
}
