/**
 * Vue lot (§10) : résumé, liste des camions et progression pondérée.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Filter, Package } from 'lucide-react'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { progressionLot, tonnage, tonnageLivre } from '@/lib/workflow'
import { cn, formatDate, formatTonnage } from '@/lib/utils'
import { Carte, EtatVide, Progression, Squelette } from '@/components/ui'
import { CarteCamion } from '@/components/CarteCamion'

type Filtre = 'tous' | 'exceptions' | 'termines'

export function VueLot({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { t } = useTranslation(['common', 'workflow'])
  const { id } = useParams<{ id: string }>()
  const [filtre, setFiltre] = useState<Filtre>('tous')

  if (portefeuille.chargement) {
    return (
      <div className="space-y-3">
        <Squelette className="h-32" />
        <Squelette className="h-40" />
      </div>
    )
  }

  const lot = portefeuille.lots.find((l) => l.id === id)
  if (!lot) {
    return (
      <EtatVide
        icone={<Package className="size-10" />}
        titre={t('lotDetail.notFound.title')}
        description={t('lotDetail.notFound.description')}
      />
    )
  }

  const commande = portefeuille.commandes.find((c) => c.id === lot.commande_id)
  const client = portefeuille.clients.find((c) => c.id === commande?.client_id)
  const camions = portefeuille.camions.filter((c) => c.lot_id === lot.id)
  const progression = progressionLot(camions)
  const livre = tonnageLivre(camions)
  const planifie = Number(lot.quantite_planifiee_t)
  const partLivree = planifie > 0 ? Math.min(Math.round((livre / planifie) * 100), 100) : 0

  const referentiel = portefeuille.etapesDuLot(lot)

  const camionsFiltres = camions.filter((c) => {
    if (filtre === 'exceptions')
      return c.statut === 'BLOQUE' || portefeuille.camionEnRetard(c)
    if (filtre === 'termines') return c.statut === 'TERMINE'
    return true
  })

  const nbExceptions = camions.filter(
    (c) => c.statut === 'BLOQUE' || portefeuille.camionEnRetard(c),
  ).length

  const filtres: { cle: Filtre; libelle: string; compte: number }[] = [
    { cle: 'tous', libelle: t('lotDetail.filters.all'), compte: camions.length },
    { cle: 'exceptions', libelle: t('lotDetail.filters.exceptions'), compte: nbExceptions },
    {
      cle: 'termines',
      libelle: t('lotDetail.filters.completed'),
      compte: camions.filter((c) => c.statut === 'TERMINE').length,
    },
  ]

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-ardoise-500 transition-colors hover:text-ardoise-900"
      >
        <ChevronLeft className="size-4" />
        {t('navigation.controlTour')}
      </Link>

      {/* Résumé du lot */}
      <Carte className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ardoise-900">
              {lot.reference}
            </h1>
            <p className="mt-0.5 text-sm text-ardoise-500">
              {lot.corridor}
              {client && ` · ${client.raison_sociale}`}
            </p>
          </div>
          <span className="text-2xl font-semibold tabular-nums text-ardoise-900">
            {progression}%
          </span>
        </div>

        <Progression valeur={progression} className="mt-4 h-2.5" />
        <p className="mt-1.5 text-xs italic text-ardoise-400">
          Progression pondérée par le tonnage net de chaque camion
        </p>

        {/* Tonnage livré (§10) */}
        <div className="mt-4 rounded-xl bg-ardoise-50 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ardoise-500">
              {t('lotDetail.summary.delivered')}
            </span>
            <span className="text-sm font-semibold tabular-nums text-ardoise-900">
              {t('lotDetail.summary.deliveredSummary', {
                delivered: formatTonnage(livre),
                planned: formatTonnage(planifie),
              })}
            </span>
          </div>
          <Progression valeur={partLivree} className="mt-2 h-2" couleur="bg-emerald-500" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-ardoise-100 pt-4 sm:grid-cols-4">
          <Resume libelle={t('lotDetail.summary.trucks')} valeur={`${camions.length}`} detail={t('lotDetail.summary.expected', { count: lot.nb_camions_prevu })} />
          <Resume
            libelle={t('lotDetail.summary.tonnage')}
            valeur={formatTonnage(tonnage(camions))}
            detail={t('lotDetail.summary.planned', { value: formatTonnage(lot.quantite_planifiee_t) })}
          />
          <Resume libelle={t('lotDetail.summary.destination')} valeur={lot.destination} />
          <Resume
            libelle={t('lotDetail.summary.period')}
            valeur={formatDate(lot.periode_debut)}
            detail={t('lotDetail.summary.toDate', { date: formatDate(lot.periode_fin) })}
          />
        </dl>
      </Carte>

      {/* Filtres */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <Filter className="size-4 shrink-0 text-ardoise-400" />
        {filtres.map((f) => (
          <button
            key={f.cle}
            onClick={() => setFiltre(f.cle)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              filtre === f.cle
                ? 'bg-ardoise-900 text-white'
                : 'bg-white text-ardoise-600 ring-1 ring-inset ring-ardoise-200 hover:bg-ardoise-50',
            )}
          >
            {f.libelle}
            <span className="ml-1.5 tabular-nums opacity-60">{f.compte}</span>
          </button>
        ))}
      </div>

      {/* Camions */}
      {camionsFiltres.length === 0 ? (
        <EtatVide titre={t('lotDetail.empty')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {camionsFiltres.map((camion) => (
            <CarteCamion
              key={camion.id}
              camion={camion}
              lot={lot}
              referentiel={referentiel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Resume({
  libelle,
  valeur,
  detail,
}: {
  libelle: string
  valeur: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-ardoise-400">{libelle}</dt>
      <dd className="truncate text-sm font-semibold text-ardoise-900">{valeur}</dd>
      {detail && <dd className="truncate text-xs text-ardoise-400">{detail}</dd>}
    </div>
  )
}
