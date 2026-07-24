/**
 * Vue lot (§10) : résumé, liste des camions et progression pondérée.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Filter, Package } from 'lucide-react'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { progressionLot, tonnage } from '@/lib/workflow'
import { cn, formatDate, formatTonnage } from '@/lib/utils'
import { Carte, EtatVide, Progression, Squelette } from '@/components/ui'
import { CarteCamion } from '@/components/CarteCamion'

type Filtre = 'tous' | 'exceptions' | 'termines'

export function VueLot({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
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
        titre="Lot introuvable"
        description="Ce lot n’existe pas ou ne fait pas partie de votre périmètre."
      />
    )
  }

  const commande = portefeuille.commandes.find((c) => c.id === lot.commande_id)
  const client = portefeuille.clients.find((c) => c.id === commande?.client_id)
  const camions = portefeuille.camions.filter((c) => c.lot_id === lot.id)
  const progression = progressionLot(camions)

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
    { cle: 'tous', libelle: 'Tous', compte: camions.length },
    { cle: 'exceptions', libelle: 'Exceptions', compte: nbExceptions },
    {
      cle: 'termines',
      libelle: 'Terminés',
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
        Tour de contrôle
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

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-ardoise-100 pt-4 sm:grid-cols-4">
          <Resume libelle="Camions" valeur={`${camions.length}`} detail={`sur ${lot.nb_camions_prevu} prévus`} />
          <Resume
            libelle="Tonnage"
            valeur={formatTonnage(tonnage(camions))}
            detail={`planifié ${formatTonnage(lot.quantite_planifiee_t)}`}
          />
          <Resume libelle="Destination" valeur={lot.destination} />
          <Resume
            libelle="Période"
            valeur={formatDate(lot.periode_debut)}
            detail={`au ${formatDate(lot.periode_fin)}`}
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
        <EtatVide titre="Aucun camion dans cette sélection" />
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
