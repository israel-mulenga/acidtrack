import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Clock, MapPin, TriangleAlert } from 'lucide-react'
import type { Camion, EtapeReferentiel, Lot } from '@/lib/types'
import {
  NB_ETAPES,
  estEnRetard,
  depassementSla,
  progressionCamion,
} from '@/lib/workflow'
import { cn, depuis, formatTonnage, jusqua } from '@/lib/utils'
import { BadgeCamion, Carte, Progression } from './ui'

/**
 * Vignette d'un dossier camion.
 * Objectif UX : comprendre le statut en moins de cinq secondes (§10).
 */
export function CarteCamion({
  camion,
  lot,
  referentiel,
  vueClient = false,
}: {
  camion: Camion
  lot?: Lot
  referentiel: EtapeReferentiel[]
  vueClient?: boolean
}) {
  const progression = progressionCamion(camion)
  const etape = referentiel.find((e) => e.numero === camion.etape_courante)
  const enRetard = estEnRetard(camion, referentiel)
  const retard = enRetard ? depassementSla(camion, referentiel) : 0

  const couleurBarre =
    camion.statut === 'BLOQUE'
      ? 'bg-red-500'
      : camion.statut === 'TERMINE'
        ? 'bg-emerald-500'
        : enRetard
          ? 'bg-orange-500'
          : 'bg-ardoise-900'

  return (
    <Link to={`/camions/${camion.id}`} className="block">
      <Carte
        className={cn(
          'p-4 transition-all hover:border-ardoise-300 hover:shadow-md active:scale-[0.995]',
          camion.statut === 'BLOQUE' && 'border-red-200 bg-red-50/40',
          enRetard && camion.statut !== 'BLOQUE' && 'border-orange-200',
        )}
      >
        {/* Ligne 1 : référence, plaque, statut */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight text-ardoise-900">
              {camion.reference}
            </p>
            <p className="mt-0.5 truncate text-xs text-ardoise-500">
              {camion.plaque_tracteur}
              {camion.chauffeur_nom && ` · ${camion.chauffeur_nom}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {camion.statut === 'BLOQUE' ? (
              <BadgeCamion statut="BLOQUE" />
            ) : enRetard ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                <Clock className="size-3" />
                En retard
              </span>
            ) : (
              <BadgeCamion statut={camion.statut} />
            )}
            <ChevronRight className="size-4 text-ardoise-300" />
          </div>
        </div>

        {/* Ligne 2 : étape courante */}
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-ardoise-700">
            <span className="font-medium tabular-nums text-ardoise-400">
              {Math.min(camion.etape_courante, NB_ETAPES)}/{NB_ETAPES}
            </span>{' '}
            {etape?.libelle ?? 'Dossier clôturé'}
          </p>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ardoise-900">
            {progression}%
          </span>
        </div>

        <Progression valeur={progression} className="mt-2" couleur={couleurBarre} />

        {/* Ligne 3 : tonnage, position, fraîcheur */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ardoise-500">
          <span className="font-medium text-ardoise-700">{formatTonnage(camion.tonnage_net_t)}</span>
          {lot && <span className="text-ardoise-400">· {lot.destination}</span>}
          {camion.derniere_position_lib && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{camion.derniere_position_lib}</span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {/* La fraîcheur de la donnée est toujours explicite (§12.10) */}
          <span className="text-ardoise-400">Mis à jour {depuis(camion.derniere_maj_at)}</span>
          {camion.eta && camion.statut !== 'TERMINE' && (
            <span className="text-ardoise-400">· ETA {jusqua(camion.eta)}</span>
          )}
        </div>

        {/* Bandeau d'exception */}
        {camion.statut === 'BLOQUE' && (
          <p className="mt-3 flex items-center gap-1.5 rounded-md bg-red-100 px-2 py-1.5 text-xs font-medium text-red-800">
            <TriangleAlert className="size-3.5 shrink-0" />
            {vueClient ? 'Blocage en cours de traitement par nos équipes' : 'Incident critique ouvert'}
          </p>
        )}
        {enRetard && camion.statut !== 'BLOQUE' && (
          <p className="mt-3 flex items-center gap-1.5 rounded-md bg-orange-100 px-2 py-1.5 text-xs font-medium text-orange-800">
            <AlertTriangle className="size-3.5 shrink-0" />
            Délai de l’étape dépassé de {retard} h
          </p>
        )}
      </Carte>
    </Link>
  )
}
