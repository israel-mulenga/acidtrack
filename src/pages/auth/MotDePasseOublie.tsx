import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Container, Loader2 } from 'lucide-react'
import { demanderReinitialisation } from '@/lib/auth'
import { Bouton, Carte, Champ, Encart, Etiquette } from '@/components/ui'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'

export function MotDePasseOublie() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await demanderReinitialisation(email.trim())
      setEnvoye(true)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t('forgotPassword.error'))
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
          <h1 className="mb-4 text-base font-semibold text-ardoise-900">{t('forgotPassword.title')}</h1>

          {envoye ? (
            <Encart ton="succes">
              {t('forgotPassword.success')}
            </Encart>
          ) : (
            <>
              {erreur && (
                <Encart ton="erreur" className="mb-4">
                  {erreur}
                </Encart>
              )}
              <form onSubmit={(e) => void soumettre(e)} className="space-y-3.5">
                <div>
                  <Etiquette htmlFor="email" obligatoire>
                    {t('signup.email')}
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
                <Bouton type="submit" className="w-full" disabled={envoi}>
                  {envoi && <Loader2 className="size-4 animate-spin" />}
                  {t('forgotPassword.submit')}
                </Bouton>
              </form>
            </>
          )}

          <p className="mt-4 text-center text-sm text-ardoise-500">
            <Link to="/connexion" className="font-medium text-ardoise-900 hover:underline">
              {t('forgotPassword.backToLogin')}
            </Link>
          </p>
        </Carte>
      </div>
    </div>
  )
}
