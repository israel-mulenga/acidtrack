/**
 * Panneau de supervision plateforme (super-admin).
 *
 * Écran autonome, sans contexte d'organisation : le superviseur n'appartient
 * à aucune organisation et ne voit que cette vue. Les données transverses
 * proviennent des fonctions SECURITY DEFINER `admin_tableau_bord()` et
 * `admin_utilisateurs()` (cf. supabase/07_super_admin.sql), en lecture seule.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Clock,
  Container,
  LogOut,
  Package,
  ShieldAlert,
  Truck,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/session'
import type { RoleUtilisateur } from '@/lib/types'
import { formatTonnage } from '@/lib/utils'
import { Carte, EtatVide, Encart, Squelette, Statistique } from '@/components/ui'

interface LigneTableauBord {
  organisation_id: string
  organisation_nom: string
  organisation_statut: string
  organisation_plan: string
  nb_utilisateurs: number | string
  nb_lots: number | string
  camions_actifs: number | string
  camions_en_transit: number | string
  camions_livres: number | string
  camions_bloques: number | string
  camions_en_retard: number | string
  tonnage_total: number | string
  tonnage_livre: number | string
}

interface LigneUtilisateur {
  organisation_id: string
  organisation_nom: string
  utilisateur_id: string
  nom: string
  role: RoleUtilisateur
  email: string | null
  telephone: string | null
  statut: string
  created_at: string
}

const n = (v: number | string): number => Number(v ?? 0)

export function PanneauAdmin() {
  const { session, deconnecter } = useSession()
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [organisations, setOrganisations] = useState<LigneTableauBord[]>([])
  const [utilisateurs, setUtilisateurs] = useState<LigneUtilisateur[]>([])

  useEffect(() => {
    let actif = true
    void (async () => {
      setChargement(true)
      const [tb, us] = await Promise.all([
        supabase.rpc('admin_tableau_bord'),
        supabase.rpc('admin_utilisateurs'),
      ])
      if (!actif) return
      if (tb.error || us.error) {
        setErreur(tb.error?.message ?? us.error?.message ?? 'Erreur inconnue')
      } else {
        setOrganisations((tb.data as LigneTableauBord[]) ?? [])
        setUtilisateurs((us.data as LigneUtilisateur[]) ?? [])
      }
      setChargement(false)
    })()
    return () => {
      actif = false
    }
  }, [])

  const totaux = useMemo(() => {
    return organisations.reduce(
      (acc, o) => ({
        actifs: acc.actifs + n(o.camions_actifs),
        transit: acc.transit + n(o.camions_en_transit),
        livres: acc.livres + n(o.camions_livres),
        bloques: acc.bloques + n(o.camions_bloques),
        retard: acc.retard + n(o.camions_en_retard),
        tonnage: acc.tonnage + n(o.tonnage_total),
        tonnageLivre: acc.tonnageLivre + n(o.tonnage_livre),
      }),
      { actifs: 0, transit: 0, livres: 0, bloques: 0, retard: 0, tonnage: 0, tonnageLivre: 0 },
    )
  }, [organisations])

  const parOrganisation = useMemo(() => {
    const groupes = new Map<string, { nom: string; membres: LigneUtilisateur[] }>()
    for (const u of utilisateurs) {
      const g = groupes.get(u.organisation_id) ?? { nom: u.organisation_nom, membres: [] }
      g.membres.push(u)
      groupes.set(u.organisation_id, g)
    }
    return [...groupes.values()].sort((a, b) => a.nom.localeCompare(b.nom))
  }, [utilisateurs])

  return (
    <div className="flex min-h-dvh flex-col bg-ardoise-50">
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
              <p className="truncate text-[11px] leading-tight text-ambre-300">
                Supervision plateforme
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden truncate text-xs text-ardoise-400 sm:block">
              {session?.user.email}
            </span>
            <button
              onClick={() => void deconnecter()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ardoise-800 px-2.5 py-1.5 text-sm font-medium text-ardoise-100 transition-colors hover:bg-ardoise-700"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ardoise-900">
            Supervision multi-organisations
          </h1>
          <p className="text-sm text-ardoise-500">
            {organisations.length} organisation{organisations.length > 1 ? 's' : ''} ·{' '}
            {utilisateurs.length} utilisateur{utilisateurs.length > 1 ? 's' : ''}
          </p>
        </div>

        {erreur && (
          <Encart ton="erreur" titre="Chargement impossible" icone={<AlertTriangle className="size-4" />}>
            {erreur}
          </Encart>
        )}

        {chargement ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Squelette key={i} className="h-24" />
              ))}
            </div>
            <Squelette className="h-64" />
          </div>
        ) : (
          <>
            {/* Indicateurs globaux */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Statistique
                libelle="Tonnage total"
                valeur={formatTonnage(totaux.tonnage)}
                icone={<Truck className="size-4" />}
              />
              <Statistique
                libelle="Tonnage livré"
                valeur={formatTonnage(totaux.tonnageLivre)}
                ton="succes"
                icone={<Package className="size-4" />}
              />
              <Statistique
                libelle="Camions en retard"
                valeur={totaux.retard}
                ton={totaux.retard > 0 ? 'alerte' : 'neutre'}
                icone={<Clock className="size-4" />}
              />
              <Statistique
                libelle="Camions bloqués"
                valeur={totaux.bloques}
                ton={totaux.bloques > 0 ? 'danger' : 'neutre'}
                icone={<ShieldAlert className="size-4" />}
              />
            </div>

            {/* Par organisation */}
            <section>
              <h2 className="mb-2.5 flex items-center gap-2 font-semibold tracking-tight text-ardoise-900">
                <Building2 className="size-4 text-ardoise-500" />
                Organisations
              </h2>
              {organisations.length === 0 ? (
                <EtatVide titre="Aucune organisation" />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {organisations.map((o) => (
                    <Carte key={o.organisation_id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold tracking-tight text-ardoise-900">
                            {o.organisation_nom}
                          </p>
                          <p className="mt-0.5 text-xs text-ardoise-500">
                            {o.organisation_plan} · {n(o.nb_utilisateurs)} utilisateur
                            {n(o.nb_utilisateurs) > 1 ? 's' : ''} · {n(o.nb_lots)} lot
                            {n(o.nb_lots) > 1 ? 's' : ''}
                          </p>
                        </div>
                        <span
                          className={
                            o.organisation_statut === 'ACTIF'
                              ? 'shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200'
                              : 'shrink-0 rounded-full bg-ardoise-100 px-2 py-0.5 text-xs font-medium text-ardoise-500 ring-1 ring-inset ring-ardoise-200'
                          }
                        >
                          {o.organisation_statut}
                        </span>
                      </div>

                      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ardoise-100 pt-3 text-center">
                        <Mini libelle="Actifs" valeur={n(o.camions_actifs)} />
                        <Mini libelle="En transit" valeur={n(o.camions_en_transit)} />
                        <Mini libelle="Livrés" valeur={n(o.camions_livres)} />
                        <Mini
                          libelle="En retard"
                          valeur={n(o.camions_en_retard)}
                          alerte={n(o.camions_en_retard) > 0}
                        />
                        <Mini
                          libelle="Bloqués"
                          valeur={n(o.camions_bloques)}
                          danger={n(o.camions_bloques) > 0}
                        />
                        <Mini libelle="Tonnage" valeur={formatTonnage(n(o.tonnage_total))} />
                      </dl>
                    </Carte>
                  ))}
                </div>
              )}
            </section>

            {/* Utilisateurs par organisation */}
            <section>
              <h2 className="mb-2.5 flex items-center gap-2 font-semibold tracking-tight text-ardoise-900">
                <Users className="size-4 text-ardoise-500" />
                Utilisateurs
              </h2>
              {parOrganisation.length === 0 ? (
                <EtatVide titre="Aucun utilisateur" />
              ) : (
                <div className="space-y-4">
                  {parOrganisation.map((groupe) => (
                    <Carte key={groupe.nom} className="overflow-hidden">
                      <div className="border-b border-ardoise-100 bg-ardoise-50/60 px-4 py-2.5">
                        <p className="text-sm font-semibold text-ardoise-900">{groupe.nom}</p>
                        <p className="text-xs text-ardoise-500">
                          {groupe.membres.length} utilisateur{groupe.membres.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <ul className="divide-y divide-ardoise-100">
                        {groupe.membres.map((u) => (
                          <li
                            key={u.utilisateur_id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ardoise-900">{u.nom}</p>
                              <p className="truncate text-xs text-ardoise-500">
                                {u.email ?? 'sans e-mail'}
                                {u.telephone ? ` · ${u.telephone}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-ardoise-100 px-2 py-0.5 text-xs font-medium text-ardoise-600">
                                {u.role}
                              </span>
                              <span
                                className={
                                  u.statut === 'ACTIF'
                                    ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                                    : 'rounded-full bg-ambre-50 px-2 py-0.5 text-xs font-medium text-ambre-700'
                                }
                              >
                                {u.statut}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Carte>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Mini({
  libelle,
  valeur,
  alerte,
  danger,
}: {
  libelle: string
  valeur: number | string
  alerte?: boolean
  danger?: boolean
}) {
  return (
    <div className="min-w-0">
      <dd
        className={
          danger
            ? 'text-base font-semibold tabular-nums text-red-600'
            : alerte
              ? 'text-base font-semibold tabular-nums text-ambre-600'
              : 'text-base font-semibold tabular-nums text-ardoise-900'
        }
      >
        {valeur}
      </dd>
      <dt className="text-[11px] uppercase tracking-wide text-ardoise-400">{libelle}</dt>
    </div>
  )
}
