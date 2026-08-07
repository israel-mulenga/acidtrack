/**
 * Portail client (§8.4) — lecture seule.
 *
 * Deux principes non négociables :
 *  1. Le périmètre est filtré sur le client du profil : aucune donnée d'une
 *     autre organisation ou d'un autre client n'est atteignable (AC-09).
 *  2. Aucune donnée sensible n'est exposée : ni prix, ni pièces financières
 *     ou douanières, ni coordonnées internes.
 */

import { Eye, Package, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { useUtilisateur } from '@/session'
import { progressionLot, tonnage } from '@/lib/workflow'
import { formatDateHeure, formatTonnage } from '@/lib/utils'
import { Carte, Encart, EtatVide, Progression, Squelette, Statistique } from '@/components/ui'
import { CarteCamion } from '@/components/CarteCamion'
import { IndicateurTempsReel } from '@/components/Coquille'

export function PortailClient({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { t } = useTranslation(['common', 'workflow'])
  const profil = useUtilisateur()

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

  /* --- Filtrage du périmètre client --------------------------------- */
  const commandes = portefeuille.commandes.filter((c) => c.client_id === profil.client_id)
  const lots = portefeuille.lots.filter((l) =>
    commandes.some((c) => c.id === l.commande_id),
  )
  const camions = portefeuille.camions.filter((c) =>
    lots.some((l) => l.id === c.lot_id),
  )

  const client = portefeuille.clients.find((c) => c.id === profil.client_id)

  const actifs = camions.filter((c) => c.statut !== 'ANNULE')
  const livres = actifs.filter((c) => c.etape_courante > 6)
  const enTransit = actifs.filter((c) => c.etape_courante > 1 && c.etape_courante <= 6)
  const aSurveiller = actifs.filter(
    (c) => c.statut === 'BLOQUE' || portefeuille.camionEnRetard(c),
  )

  // Prochaine arrivée annoncée
  const prochaine = actifs
    .filter((c) => c.eta && c.statut !== 'TERMINE')
    .sort((a, b) => +new Date(a.eta!) - +new Date(b.eta!))[0]

  if (camions.length === 0) {
    return (
      <EtatVide
        icone={<Package className="size-10" />}
        titre={t('clientPortal.empty.title')}
        description={t('clientPortal.empty.description')}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-ardoise-900">
            {client?.raison_sociale ?? t('clientPortal.title')}
          </h1>
          <p className="text-sm text-ardoise-500">
            {t('clientPortal.summary', {
              trucks: actifs.length,
              lots: lots.length,
              s: lots.length > 1 ? 's' : '',
            })}
          </p>
        </div>
        <IndicateurTempsReel />
      </div>

      <Encart ton="info" icone={<Eye className="size-4" />}>
        {t('clientPortal.readOnlyNotice')}
      </Encart>

      {/* Indicateurs client (§9.1) */}
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
          libelle={t('clientPortal.kpi.toWatch')}
          valeur={aSurveiller.length}
          ton={aSurveiller.length > 0 ? 'alerte' : 'neutre'}
        />
        <Statistique
          libelle={t('clientPortal.kpi.nextArrival')}
          valeur={prochaine?.eta ? formatDateHeure(prochaine.eta) : '—'}
        />
      </div>

      {/* Lots */}
      {lots.map((lot) => {
        const camionsLot = camions.filter((c) => c.lot_id === lot.id)
        const progression = progressionLot(camionsLot)
        return (
          <section key={lot.id}>
            <Carte className="mb-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold tracking-tight text-ardoise-900">
                    {lot.reference}
                  </h2>
                  <p className="text-sm text-ardoise-500">
                    {lot.corridor} · {formatTonnage(tonnage(camionsLot))}
                  </p>
                </div>
                <span className="text-xl font-semibold tabular-nums text-ardoise-900">
                  {progression}%
                </span>
              </div>
              <Progression valeur={progression} className="mt-3" />
            </Carte>

            <div className="grid gap-3 md:grid-cols-2">
              {camionsLot.map((camion) => (
                <CarteCamion
                  key={camion.id}
                  camion={camion}
                  lot={lot}
                  referentiel={portefeuille.etapesDuLot(lot)}
                  vueClient
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
