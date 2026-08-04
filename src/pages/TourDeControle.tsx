/**
 * Tour de contrôle opérations (§9.2).
 * Priorité à l'exception : ce qui bloque remonte en haut de l'écran.
 */

import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Clock,
  Package,
  ShieldAlert,
  Truck,
} from 'lucide-react'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { progressionLot, tonnage, tonnageLivre } from '@/lib/workflow'
import { depuis, formatTonnage } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Carte, EtatVide, Progression, Squelette, Statistique } from '@/components/ui'
import { CarteCamion } from '@/components/CarteCamion'
import { IndicateurTempsReel } from '@/components/Coquille'

export function TourDeControle({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { t } = useTranslation(['common', 'workflow'])
  const { camions, lots, referentiel, incidentsOuverts, evenementsAValider } = portefeuille

  if (portefeuille.chargement) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Squelette key={i} className="h-24" />
          ))}
        </div>
        <Squelette className="h-64" />
      </div>
    )
  }

  const actifs = camions.filter((c) => c.statut !== 'ANNULE')
  const enRetard = actifs.filter((c) => portefeuille.camionEnRetard(c))
  const bloques = actifs.filter((c) => c.statut === 'BLOQUE')
  const livres = actifs.filter((c) => c.etape_courante > 6)
  const enTransit = actifs.filter((c) => c.etape_courante > 1 && c.etape_courante <= 6)

  // Exceptions à traiter en priorité : bloqués d'abord, puis retards
  const exceptions = [
    ...bloques,
    ...enRetard.filter((c) => c.statut !== 'BLOQUE'),
  ]

  // Répartition des camions par macro-étape (§9.1)
  const repartition = referentiel.map((etape) => ({
    etape,
    nombre: actifs.filter((c) => c.etape_courante === etape.numero).length,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ardoise-900">
            {t('navigation.controlTour')}
          </h1>
          <p className="text-sm text-ardoise-500">
            {t('dashboard.summary', { count: actifs.length, defaultValue: '{{count}} camion actif · {{lots}} lot en cours' })}
          </p>
        </div>
        <IndicateurTempsReel />
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Statistique
          libelle={t('dashboard.kpi.inTransitTonnage')}
          valeur={formatTonnage(tonnage(enTransit))}
          icone={<Truck className="size-4" />}
        />
        <Statistique
          libelle={t('dashboard.kpi.deliveredTonnage')}
          valeur={formatTonnage(tonnage(livres))}
          ton="succes"
          icone={<Package className="size-4" />}
        />
        <Statistique
          libelle={t('dashboard.kpi.delayedTrucks')}
          valeur={enRetard.length}
          ton={enRetard.length > 0 ? 'alerte' : 'neutre'}
          icone={<Clock className="size-4" />}
        />
        <Statistique
          libelle={t('dashboard.kpi.blockedTrucks')}
          valeur={bloques.length}
          ton={bloques.length > 0 ? 'danger' : 'neutre'}
          icone={<ShieldAlert className="size-4" />}
        />
      </div>

      {/* File de validation */}
      {evenementsAValider.length > 0 && (
        <Carte className="border-violet-200 bg-violet-50/40 p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 shrink-0 text-violet-600" />
            <h2 className="font-semibold tracking-tight text-ardoise-900">
              {t('dashboard.validationQueue.title')}
            </h2>
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-bold text-white">
              {evenementsAValider.length}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {evenementsAValider.map((evenement) => {
              const camion = camions.find((c) => c.id === evenement.camion_id)
              const etape = referentiel.find((e) => e.numero === evenement.etape_numero)
              if (!camion) return null
              return (
                <li key={evenement.id}>
                  <Link
                    to={`/camions/${camion.id}`}
                    className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 transition-colors hover:bg-ardoise-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ardoise-900">
                        {camion.reference} — étape {evenement.etape_numero}
                      </span>
                      <span className="block truncate text-xs text-ardoise-500">
                        {etape?.libelle} · soumis par {evenement.auteur_nom}{' '}
                        {depuis(evenement.created_at)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-ardoise-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Carte>
      )}

      {/* Exceptions */}
      {exceptions.length > 0 && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 font-semibold tracking-tight text-ardoise-900">
            <AlertTriangle className="size-4 text-red-500" />
            {t('dashboard.exceptions.title')}
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {exceptions.length}
            </span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {exceptions.map((camion) => {
              const lot = lots.find((l) => l.id === camion.lot_id)
              return (
                <CarteCamion
                  key={camion.id}
                  camion={camion}
                  lot={lot}
                  referentiel={portefeuille.etapesDuCamion(camion)}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Répartition par étape */}
      <Carte className="p-4">
        <h2 className="mb-3 font-semibold tracking-tight text-ardoise-900">
          {t('dashboard.repartition.title')}
        </h2>
        <div className="space-y-2">
          {repartition.map(({ etape, nombre }) => (
            <div key={etape.numero} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-xs font-medium tabular-nums text-ardoise-400">
                {etape.numero}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ardoise-700">
                {etape.libelle}
              </span>
              <div className="hidden w-32 sm:block">
                <Progression
                  valeur={actifs.length ? (nombre / actifs.length) * 100 : 0}
                  couleur="bg-ambre-500"
                />
              </div>
              <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-ardoise-900">
                {nombre}
              </span>
            </div>
          ))}
        </div>
      </Carte>

      {/* Lots */}
      <section>
        <h2 className="mb-2.5 font-semibold tracking-tight text-ardoise-900">{t('dashboard.lots.title')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {lots.map((lot) => {
            const camionsLot = camions.filter((c) => c.lot_id === lot.id)
            const progression = progressionLot(camionsLot)
            const livre = tonnageLivre(camionsLot)
            return (
              <Link key={lot.id} to={`/lots/${lot.id}`}>
                <Carte className="p-4 transition-all hover:border-ardoise-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight text-ardoise-900">
                        {lot.reference}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ardoise-500">{lot.corridor}</p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold tabular-nums text-ardoise-900">
                      {progression}%
                    </span>
                  </div>

                  <Progression valeur={progression} className="mt-3" />

                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ardoise-500">
                    <span>
                      {t('dashboard.lots.truckCount', { count: camionsLot.length })}
                    </span>
                    <span>· {formatTonnage(tonnage(camionsLot))}</span>
                    <span className="font-medium text-emerald-600">
                      · {formatTonnage(livre)} / {formatTonnage(lot.quantite_planifiee_t)} livré
                    </span>
                    {camionsLot.some((c) => c.statut === 'BLOQUE') && (
                      <span className="font-medium text-red-600">· {t('dashboard.lots.blocked')}</span>
                    )}
                  </div>

                  {/* Progression pondérée par le tonnage (§5) */}
                  <p className="mt-2 text-[11px] italic text-ardoise-400">
                    {t('dashboard.lots.weightedProgress')}
                  </p>
                </Carte>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Incidents ouverts */}
      {incidentsOuverts.length > 0 && (
        <section>
          <h2 className="mb-2.5 font-semibold tracking-tight text-ardoise-900">
            {t('dashboard.incidents.title')}
          </h2>
          <Carte className="divide-y divide-ardoise-100">
            {incidentsOuverts.map((incident) => {
              const camion = camions.find((c) => c.id === incident.camion_id)
              return (
                <Link
                  key={incident.id}
                  to={camion ? `/camions/${camion.id}` : '#'}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ardoise-50"
                >
                  <span
                    className={
                      incident.gravite === 'CRITIQUE'
                        ? 'mt-1.5 size-2 shrink-0 rounded-full bg-red-500'
                        : 'mt-1.5 size-2 shrink-0 rounded-full bg-ambre-500'
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ardoise-900">
                      {camion?.reference} · {incident.categorie}
                    </span>
                    <span className="line-clamp-2 text-xs text-ardoise-500">
                      {incident.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ardoise-400">
                    {depuis(incident.created_at)}
                  </span>
                </Link>
              )
            })}
          </Carte>
        </section>
      )}

      {actifs.length === 0 && (
        <EtatVide
          icone={<Truck className="size-10" />}
          titre={t('dashboard.empty.title')}
          description={t('dashboard.empty.description')}
        />
      )}
    </div>
  )
}

