/**
 * Coquille applicative : en-tête, sélecteur de profil et navigation.
 * La navigation s'adapte au rôle : le client ne voit que son portail.
 */

import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Container,
  Download,
  Eye,
  LayoutDashboard,
  LogOut,
  Radio,
  Truck,
  X,
} from 'lucide-react'
import { useSession } from '@/session'
import { useNotificationsRealtime } from '@/hooks/useDonnees'
import { PROFILS, type CompteDemo } from '@/lib/profils'
import { INTITULES_ROLE } from '@/lib/workflow'
import { cn, initiales } from '@/lib/utils'
import {
  activerNotifications,
  desactiverNotifications,
  estAbonne,
  permissionNotification,
  pushEstSupporte,
} from '@/lib/push'
import { useToast } from './Toast'
import {
  estAppareilIOS,
  estDejaInstallee,
  IntegrationPWA,
  InstructionsInstallationIOS,
  useInstallation,
} from './PWA'

const ICONE_ROLE: Record<string, ReactNode> = {
  ADMIN: <Check className="size-4" />,
  OPS: <LayoutDashboard className="size-4" />,
  TERRAIN: <Truck className="size-4" />,
  CLIENT: <Eye className="size-4" />,
}

/** Menu du compte connecté : déconnexion, et bascule démo en développement. */
function MenuCompte() {
  const { session, profil, deconnecter, basculeDemoActive, basculerProfilDemo } = useSession()
  const installation = useInstallation()
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [instructionsIOS, setInstructionsIOS] = useState(false)

  const notifsSupportees = pushEstSupporte()
  const [notifsActives, setNotifsActives] = useState(false)
  const [notifsEnCours, setNotifsEnCours] = useState(false)

  useEffect(() => {
    if (!notifsSupportees) return
    let actif = true
    void estAbonne().then((abonne) => {
      if (actif) setNotifsActives(abonne && permissionNotification() === 'granted')
    })
    return () => {
      actif = false
    }
  }, [notifsSupportees])

  const basculerNotifications = async () => {
    if (!profil || notifsEnCours) return
    setNotifsEnCours(true)
    try {
      if (notifsActives) {
        await desactiverNotifications()
        setNotifsActives(false)
        toast.succes('Notifications désactivées.')
        return
      }
      const authId = profil.auth_id ?? session?.user.id
      if (!authId) {
        toast.erreur('Session incomplète : reconnectez-vous pour activer les notifications.')
        return
      }
      const active = await activerNotifications(profil.organisation_id, authId, profil.id)
      if (active) {
        setNotifsActives(true)
        toast.succes('Notifications activées pour cette organisation.')
      } else {
        toast.erreur('Permission de notification refusée par le navigateur.')
      }
    } catch (e) {
      toast.erreur(e instanceof Error ? e.message : 'Activation des notifications impossible.')
    } finally {
      setNotifsEnCours(false)
    }
  }

  if (!profil) return null

  const basculer = async (compte: CompteDemo) => {
    setEnCours(true)
    try {
      await basculerProfilDemo(compte.email)
      setOuvert(false)
    } finally {
      setEnCours(false)
    }
  }

  // Toujours proposée, même après un refus du bandeau automatique : c'est
  // la seule façon de rattraper une installation refusée par erreur.
  const installerApplication = () => {
    if (installation.peutDeclencher) {
      void installation.installer()
      return
    }
    if (estAppareilIOS()) {
      setInstructionsIOS(true)
      return
    }
    toast.succes(
      'Ouvrez le menu de votre navigateur (⋮ ou icône de partage) puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 pl-1.5 pr-2.5 text-left transition-colors hover:bg-white/15"
        aria-haspopup="menu"
        aria-expanded={ouvert}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ambre-500 text-xs font-bold text-ardoise-950">
          {initiales(profil.nom)}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-xs font-medium leading-tight text-white">
            {profil.nom}
          </span>
          <span className="block truncate text-[11px] leading-tight text-ardoise-300">
            {INTITULES_ROLE[profil.role]}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-ardoise-300 transition-transform',
            ouvert && 'rotate-180',
          )}
        />
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} aria-hidden />
          <div className="animate-fade-in absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-ardoise-200 bg-white shadow-xl">
            {basculeDemoActive && (
              <>
                <p className="border-b border-ardoise-100 bg-ardoise-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ardoise-500">
                  Bascule démo (développement)
                </p>
                {PROFILS.map((p) => (
                  <button
                    key={p.email}
                    disabled={enCours}
                    onClick={() => void basculer(p)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ardoise-50 disabled:opacity-50',
                      p.email === profil.email && 'bg-ambre-50/60',
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ardoise-100 text-ardoise-600">
                      {ICONE_ROLE[p.role]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ardoise-900">
                        {p.nom}
                      </span>
                      <span className="block truncate text-xs text-ardoise-500">
                        {p.intitule}
                      </span>
                    </span>
                    {p.email === profil.email && (
                      <Check className="size-4 shrink-0 text-ambre-600" />
                    )}
                  </button>
                ))}
              </>
            )}
            {notifsSupportees && (
              <button
                onClick={() => void basculerNotifications()}
                disabled={notifsEnCours}
                className="flex w-full items-center gap-3 border-t border-ardoise-100 px-3 py-2.5 text-left text-sm font-medium text-ardoise-700 transition-colors hover:bg-ardoise-50 disabled:opacity-50"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ardoise-100 text-ardoise-600">
                  {notifsActives ? <BellOff className="size-4" /> : <Bell className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">
                    {notifsActives ? 'Désactiver les notifications' : 'Activer les notifications'}
                  </span>
                  <span className="block truncate text-xs font-normal text-ardoise-400">
                    {notifsActives
                      ? 'Alertes push activées sur cet appareil'
                      : 'Être alerté des changements de l’organisation'}
                  </span>
                </span>
              </button>
            )}
            {!estDejaInstallee() && !instructionsIOS && (
              <button
                onClick={installerApplication}
                className="flex w-full items-center gap-3 border-t border-ardoise-100 px-3 py-2.5 text-left text-sm font-medium text-ardoise-700 transition-colors hover:bg-ardoise-50"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ardoise-100 text-ardoise-600">
                  <Download className="size-4" />
                </span>
                Installer l’application
              </button>
            )}
            {instructionsIOS && (
              <div className="border-t border-ardoise-100 bg-ardoise-900 p-3.5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Ajouter à l’écran d’accueil</p>
                  <button
                    onClick={() => setInstructionsIOS(false)}
                    aria-label="Fermer"
                    className="rounded-lg p-1 text-ardoise-400 transition-colors hover:bg-ardoise-800 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <InstructionsInstallationIOS />
              </div>
            )}
            <button
              onClick={() => void deconnecter()}
              className="flex w-full items-center gap-3 border-t border-ardoise-100 px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="size-4" />
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface Onglet {
  vers: string
  libelle: string
  icone: ReactNode
  pastille?: number
}

export function Coquille({
  children,
  onglets,
}: {
  children: ReactNode
  onglets: Onglet[]
}) {
  const { estClient } = useSession()
  const { pathname } = useLocation()
  const toast = useToast()

  // Complément in-app aux notifications push : un toast pour les
  // utilisateurs qui ont déjà l'application ouverte.
  useNotificationsRealtime((notification) => {
    toast.succes(`${notification.titre} — ${notification.corps}`)
  })

  return (
    <div className="flex min-h-dvh flex-col bg-ardoise-50">
      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-ardoise-900 shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ambre-500">
              <Container className="size-[18px] text-ardoise-950" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-white">
                AcidTrack
              </p>
              <p className="hidden truncate text-[11px] leading-tight text-ardoise-400 sm:block">
                {estClient ? 'Portail client' : 'Corridor Zambie → RDC'}
              </p>
            </div>
          </div>
          <MenuCompte />
        </div>

        {/* Navigation desktop */}
        {onglets.length > 1 && (
          <nav className="mx-auto hidden max-w-6xl gap-1 px-3 sm:flex">
            {onglets.map((o) => (
              <NavLink
                key={o.vers}
                to={o.vers}
                end={o.vers === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-ambre-500 text-white'
                      : 'border-transparent text-ardoise-400 hover:text-ardoise-200',
                  )
                }
              >
                {o.icone}
                {o.libelle}
                {!!o.pastille && o.pastille > 0 && (
                  <span className="rounded-full bg-ambre-500 px-1.5 text-[11px] font-bold text-ardoise-950">
                    {o.pastille}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Contenu */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 sm:pb-10">{children}</main>

      {/* Navigation mobile */}
      {onglets.length > 1 && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-ardoise-200 bg-white/95 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-6xl">
            {onglets.map((o) => {
              const actif = o.vers === '/' ? pathname === '/' : pathname.startsWith(o.vers)
              return (
                <NavLink
                  key={o.vers}
                  to={o.vers}
                  className={cn(
                    'relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2 text-[11px] font-medium transition-colors',
                    actif ? 'text-ardoise-900' : 'text-ardoise-400',
                  )}
                >
                  <span className="relative">
                    {o.icone}
                    {!!o.pastille && o.pastille > 0 && (
                      <span className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full bg-ambre-500 text-[10px] font-bold text-ardoise-950">
                        {o.pastille}
                      </span>
                    )}
                  </span>
                  {o.libelle}
                </NavLink>
              )
            })}
          </div>
        </nav>
      )}

      {/* Installation, mise à jour et perte de réseau */}
      <IntegrationPWA />
    </div>
  )
}

/** Bandeau discret indiquant que les données sont vivantes. */
export function IndicateurTempsReel() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ardoise-400">
      <Radio className="size-3 text-emerald-500" />
      Synchronisé en temps réel
    </span>
  )
}

export function BandeauAlerte({ nombre }: { nombre: number }) {
  if (nombre === 0) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        <strong className="font-semibold">{nombre}</strong>{' '}
        {nombre > 1 ? 'camions nécessitent' : 'camion nécessite'} une attention immédiate.
      </span>
    </div>
  )
}
