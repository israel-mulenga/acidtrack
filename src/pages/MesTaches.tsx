/**
 * Vue agent terrain : la liste des camions dont l'étape courante attend une
 * action, triés par urgence. Conçue pour un usage à une main sur téléphone.
 */

import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { CheckCircle2, ListTodo } from 'lucide-react'
import { estEnRetard, heuresDepuis } from '@/lib/workflow'
import { EtatVide, Squelette } from '@/components/ui'
import { CarteCamion } from '@/components/CarteCamion'
import { IndicateurTempsReel } from '@/components/Coquille'

export function MesTaches({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  if (portefeuille.chargement) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Squelette key={i} className="h-40" />
        ))}
      </div>
    )
  }

  const { camions, lots, referentiel, evenementsAValider } = portefeuille

  const enAttenteValidation = new Set(evenementsAValider.map((e) => e.camion_id))

  // À traiter : camion actif dont l'étape courante n'est pas en validation
  const aTraiter = camions
    .filter(
      (c) =>
        c.statut !== 'TERMINE' &&
        c.statut !== 'ANNULE' &&
        !enAttenteValidation.has(c.id),
    )
    .sort((a, b) => {
      // Bloqués puis retards puis les plus anciens sans mise à jour
      const score = (id: typeof a) =>
        (id.statut === 'BLOQUE' ? 2000 : 0) +
        (estEnRetard(id, referentiel) ? 1000 : 0) +
        heuresDepuis(id.derniere_maj_at)
      return score(b) - score(a)
    })

  const soumis = camions.filter((c) => enAttenteValidation.has(c.id))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ardoise-900">Mes tâches</h1>
          <p className="text-sm text-ardoise-500">
            {aTraiter.length} camion{aTraiter.length > 1 ? 's' : ''} en attente d’une mise à jour
          </p>
        </div>
        <IndicateurTempsReel />
      </div>

      {aTraiter.length === 0 ? (
        <EtatVide
          icone={<CheckCircle2 className="size-10" />}
          titre="Rien à traiter"
          description="Toutes vos étapes sont à jour."
        />
      ) : (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 font-semibold tracking-tight text-ardoise-900">
            <ListTodo className="size-4 text-ambre-600" />À traiter
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {aTraiter.map((camion) => (
              <CarteCamion
                key={camion.id}
                camion={camion}
                lot={lots.find((l) => l.id === camion.lot_id)}
                referentiel={referentiel}
              />
            ))}
          </div>
        </section>
      )}

      {soumis.length > 0 && (
        <section>
          <h2 className="mb-2.5 font-semibold tracking-tight text-ardoise-900">
            En attente de validation
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {soumis.map((camion) => (
              <CarteCamion
                key={camion.id}
                camion={camion}
                lot={lots.find((l) => l.id === camion.lot_id)}
                referentiel={referentiel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
