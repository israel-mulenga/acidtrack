import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Loader2 } from 'lucide-react'
import { definirNouveauMotDePasse } from '@/lib/auth'
import { Bouton, Carte, Champ, Encart, Etiquette } from '@/components/ui'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'

export function ReinitialiserMotDePasse() {
  const navigate = useNavigate()
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.')
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      await definirNouveauMotDePasse(motDePasse)
      navigate('/', { replace: true })
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Mise à jour impossible.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ardoise-50 px-4 py-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex justify-end">
          <LanguageSwitcher className="shadow-sm" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="grid size-11 place-items-center rounded-xl bg-ardoise-900">
            <Container className="size-6 text-ambre-500" strokeWidth={2.5} />
          </span>
          <p className="text-lg font-semibold tracking-tight text-ardoise-900">AcidTrack</p>
        </div>

        <Carte className="p-5">
          <h1 className="mb-4 text-base font-semibold text-ardoise-900">
            Nouveau mot de passe
          </h1>

          {erreur && (
            <Encart ton="erreur" className="mb-4">
              {erreur}
            </Encart>
          )}

          <form onSubmit={(e) => void soumettre(e)} className="space-y-3.5">
            <div>
              <Etiquette htmlFor="mdp" obligatoire>
                Nouveau mot de passe
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
            <div>
              <Etiquette htmlFor="confirmation" obligatoire>
                Confirmer le mot de passe
              </Etiquette>
              <Champ
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>

            <Bouton type="submit" className="w-full" disabled={envoi}>
              {envoi && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Bouton>
          </form>
        </Carte>
      </div>
    </div>
  )
}
