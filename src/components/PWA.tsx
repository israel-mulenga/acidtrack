/**
 * Intégration progressive : installation, mise à jour et perte de réseau.
 *
 * Le terrain est le cas d'usage dimensionnant. Un agent au poste frontière
 * de Kasumbalesa perd le réseau régulièrement : l'application doit s'ouvrir
 * malgré tout, afficher les dernières données connues, et le dire.
 */

import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { CloudOff, Download, RefreshCw, Share, SquarePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton } from './ui'

const CLE_INSTALL_REFUSEE = 'acidtrack.installation.refusee'

/** Évènement Chromium, absent des types DOM standard. */
interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/* ------------------------------------------------------------------ */
/* Bandeau générique, ancré au-dessus de la navigation mobile          */
/* ------------------------------------------------------------------ */

function Bandeau({
  ton,
  icone,
  titre,
  detail,
  actions,
}: {
  ton: 'sombre' | 'alerte'
  icone: React.ReactNode
  titre: string
  detail?: string
  actions?: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-xl px-3.5 py-3 shadow-lg ring-1',
        ton === 'sombre'
          ? 'bg-ardoise-900 text-white ring-ardoise-700'
          : 'bg-ambre-50 text-ambre-700 ring-ambre-200',
      )}
    >
      <span className="shrink-0">{icone}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{titre}</p>
        {detail && (
          <p
            className={cn(
              'mt-0.5 text-xs leading-snug',
              ton === 'sombre' ? 'text-ardoise-300' : 'text-ambre-700/80',
            )}
          >
            {detail}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Perte de réseau                                                     */
/* ------------------------------------------------------------------ */

function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(() => navigator.onLine)

  useEffect(() => {
    const majEnLigne = () => setEnLigne(true)
    const majHorsLigne = () => setEnLigne(false)
    window.addEventListener('online', majEnLigne)
    window.addEventListener('offline', majHorsLigne)
    return () => {
      window.removeEventListener('online', majEnLigne)
      window.removeEventListener('offline', majHorsLigne)
    }
  }, [])

  return enLigne
}

/* ------------------------------------------------------------------ */
/* Invite d'installation                                               */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line react-refresh/only-export-components
export function useInstallation() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null)
  const [refusee, setRefusee] = useState(
    () => localStorage.getItem(CLE_INSTALL_REFUSEE) === '1',
  )

  useEffect(() => {
    const capturer = (e: Event) => {
      // Sans preventDefault, Chrome affiche sa propre invite, moins explicite
      e.preventDefault()
      setEvenement(e as EvenementInstallation)
    }
    const installee = () => setEvenement(null)

    window.addEventListener('beforeinstallprompt', capturer)
    window.addEventListener('appinstalled', installee)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturer)
      window.removeEventListener('appinstalled', installee)
    }
  }, [])

  const installer = async () => {
    if (!evenement) return
    await evenement.prompt()
    await evenement.userChoice
    setEvenement(null)
  }

  const refuser = () => {
    localStorage.setItem(CLE_INSTALL_REFUSEE, '1')
    setRefusee(true)
  }

  return {
    // Pilote le bandeau automatique : masqué une fois refusé.
    disponible: !!evenement && !refusee,
    // Pilote une action déclenchée manuellement (menu compte) : reste
    // possible même après un refus, tant que Chrome garde l'évènement.
    peutDeclencher: !!evenement,
    installer,
    refuser,
  }
}

/** Vrai si l'app tourne déjà en mode installé (standalone). */
// eslint-disable-next-line react-refresh/only-export-components
export function estDejaInstallee(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Propriété non standard, propre à Safari iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function estAppareilIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * iOS n'expose pas `beforeinstallprompt` : l'ajout est manuel.
 * Le diagnostic ne dépend que du navigateur, il est donc calculé une fois.
 */
function iosSansInstallation(): boolean {
  const refusee = localStorage.getItem(CLE_INSTALL_REFUSEE) === '1'
  return estAppareilIOS() && !estDejaInstallee() && !refusee
}

/** Étapes d'ajout à l'écran d'accueil, réutilisées par le bandeau et le menu compte. */
export function InstructionsInstallationIOS() {
  return (
    <ol className="space-y-2.5 text-sm text-ardoise-200">
      <li className="flex items-center gap-2.5">
        <Share className="size-5 shrink-0 text-ambre-400" />
        <span>
          Touchez <strong className="text-white">Partager</strong>, en bas de Safari.
        </span>
      </li>
      <li className="flex items-center gap-2.5">
        <SquarePlus className="size-5 shrink-0 text-ambre-400" />
        <span>
          Choisissez <strong className="text-white">Sur l’écran d’accueil</strong>.
        </span>
      </li>
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Composant unique monté dans la coquille                             */
/* ------------------------------------------------------------------ */

export function IntegrationPWA() {
  const enLigne = useEnLigne()
  const installation = useInstallation()
  const [instructionsIOS, setInstructionsIOS] = useState(false)
  const [iosEligible, setIosEligible] = useState(iosSansInstallation)

  const {
    needRefresh: [miseAJourDisponible, setMiseAJourDisponible],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (erreur) => console.error('Service worker non enregistré', erreur),
  })

  const masquerIOS = () => {
    localStorage.setItem(CLE_INSTALL_REFUSEE, '1')
    setInstructionsIOS(false)
    setIosEligible(false)
  }

  const rienAAfficher =
    enLigne && !miseAJourDisponible && !installation.disponible && !iosEligible
  if (rienAAfficher) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-6xl flex-col gap-2 p-3 pb-20 sm:pb-3">
      {/* Hors ligne : prioritaire, car il change la lecture des données */}
      {!enLigne && (
        <Bandeau
          ton="alerte"
          icone={<CloudOff className="size-5" />}
          titre="Mode hors ligne"
          detail="Vous consultez les dernières données reçues. Les mises à jour d’étape ne partiront qu’au retour du réseau."
        />
      )}

      {/* Mise à jour disponible */}
      {miseAJourDisponible && (
        <Bandeau
          ton="sombre"
          icone={<RefreshCw className="size-5 text-ambre-400" />}
          titre="Nouvelle version disponible"
          detail="Vos saisies en cours seront perdues au rechargement."
          actions={
            <>
              <button
                onClick={() => setMiseAJourDisponible(false)}
                aria-label="Plus tard"
                className="rounded-lg p-2 text-ardoise-400 transition-colors hover:bg-ardoise-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
              <Bouton
                variante="secondaire"
                taille="sm"
                onClick={() => void updateServiceWorker(true)}
              >
                Mettre à jour
              </Bouton>
            </>
          }
        />
      )}

      {/* Installation Android et bureau */}
      {installation.disponible && (
        <Bandeau
          ton="sombre"
          icone={<Download className="size-5 text-ambre-400" />}
          titre="Installer AcidTrack"
          detail="Accès en un geste depuis l’écran d’accueil, et ouverture sans réseau."
          actions={
            <>
              <button
                onClick={installation.refuser}
                aria-label="Ne plus proposer"
                className="rounded-lg p-2 text-ardoise-400 transition-colors hover:bg-ardoise-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
              <Bouton
                variante="secondaire"
                taille="sm"
                onClick={() => void installation.installer()}
              >
                Installer
              </Bouton>
            </>
          }
        />
      )}

      {/* Installation iOS : uniquement manuelle */}
      {iosEligible && !instructionsIOS && (
        <Bandeau
          ton="sombre"
          icone={<Download className="size-5 text-ambre-400" />}
          titre="Installer AcidTrack"
          detail="Deux gestes depuis Safari."
          actions={
            <>
              <button
                onClick={masquerIOS}
                aria-label="Ne plus proposer"
                className="rounded-lg p-2 text-ardoise-400 transition-colors hover:bg-ardoise-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
              <Bouton variante="secondaire" taille="sm" onClick={() => setInstructionsIOS(true)}>
                Comment ?
              </Bouton>
            </>
          }
        />
      )}

      {instructionsIOS && (
        <div className="pointer-events-auto rounded-xl bg-ardoise-900 p-4 text-white shadow-lg ring-1 ring-ardoise-700">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">Ajouter à l’écran d’accueil</p>
            <button
              onClick={masquerIOS}
              aria-label="Fermer"
              className="rounded-lg p-1 text-ardoise-400 transition-colors hover:bg-ardoise-800 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <InstructionsInstallationIOS />
        </div>
      )}
    </div>
  )
}
