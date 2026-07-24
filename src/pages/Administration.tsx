/**
 * Administration : tout ce qui se créait auparavant en SQL se crée ici.
 *
 * Les sections visibles dépendent des droits du profil : les opérations
 * gèrent le référentiel et le commercial, l'administrateur y ajoute les
 * comptes et les organisations (§7).
 */

import { useState } from 'react'
import {
  Building2,
  ClipboardList,
  MapPin,
  Package,
  Route,
  Users,
  Workflow,
} from 'lucide-react'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { useSession } from '@/session'
import type { Permission } from '@/session'
import type { Lot } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EtatVide, Squelette } from '@/components/ui'
import { AssistantCamions } from '@/components/AssistantCamions'
import { useToast } from '@/components/Toast'
import {
  SectionClients,
  SectionItineraires,
  SectionOrganisations,
  SectionPointsChargement,
  SectionUtilisateurs,
} from './admin/SectionReferentiel'
import { SectionCommandes, SectionLots } from './admin/SectionCommercial'
import { SectionModeles } from './admin/SectionModeles'

type CleSection =
  | 'commandes'
  | 'lots'
  | 'clients'
  | 'points'
  | 'itineraires'
  | 'modeles'
  | 'utilisateurs'
  | 'organisations'

interface Section {
  cle: CleSection
  libelle: string
  icone: React.ReactNode
  droit: Permission
}

const SECTIONS: Section[] = [
  {
    cle: 'commandes',
    libelle: 'Commandes',
    icone: <ClipboardList className="size-4" />,
    droit: 'administrer_commercial',
  },
  {
    cle: 'lots',
    libelle: 'Lots et camions',
    icone: <Package className="size-4" />,
    droit: 'administrer_commercial',
  },
  {
    cle: 'clients',
    libelle: 'Clients',
    icone: <Building2 className="size-4" />,
    droit: 'administrer_referentiel',
  },
  {
    cle: 'points',
    libelle: 'Points de chargement',
    icone: <MapPin className="size-4" />,
    droit: 'administrer_referentiel',
  },
  {
    cle: 'itineraires',
    libelle: 'Itinéraires',
    icone: <Route className="size-4" />,
    droit: 'administrer_referentiel',
  },
  {
    cle: 'modeles',
    libelle: 'Modèles d’étapes',
    icone: <Workflow className="size-4" />,
    droit: 'administrer_referentiel',
  },
  {
    cle: 'utilisateurs',
    libelle: 'Utilisateurs',
    icone: <Users className="size-4" />,
    droit: 'administrer_utilisateurs',
  },
  {
    cle: 'organisations',
    libelle: 'Organisations',
    icone: <Building2 className="size-4" />,
    droit: 'administrer_utilisateurs',
  },
]

export function Administration({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { peut } = useSession()
  const toast = useToast()

  const disponibles = SECTIONS.filter((s) => peut(s.droit))
  const [active, setActive] = useState<CleSection>(disponibles[0]?.cle ?? 'commandes')
  const [lotCible, setLotCible] = useState<Lot | null>(null)

  if (disponibles.length === 0) {
    return (
      <EtatVide
        titre="Accès non autorisé"
        description="Votre profil ne dispose pas des droits d’administration."
      />
    )
  }

  if (portefeuille.chargement) {
    return (
      <div className="space-y-3">
        <Squelette className="h-10" />
        <Squelette className="h-64" />
      </div>
    )
  }

  const rendu = () => {
    switch (active) {
      case 'commandes':
        return <SectionCommandes portefeuille={portefeuille} />
      case 'lots':
        return <SectionLots portefeuille={portefeuille} onAjouterCamions={setLotCible} />
      case 'clients':
        return <SectionClients portefeuille={portefeuille} />
      case 'points':
        return <SectionPointsChargement portefeuille={portefeuille} />
      case 'itineraires':
        return <SectionItineraires portefeuille={portefeuille} />
      case 'modeles':
        return <SectionModeles portefeuille={portefeuille} />
      case 'utilisateurs':
        return <SectionUtilisateurs portefeuille={portefeuille} />
      case 'organisations':
        return <SectionOrganisations portefeuille={portefeuille} />
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ardoise-900">Administration</h1>
        <p className="text-sm text-ardoise-500">
          Référentiel et hiérarchie commerciale. Aucune donnée ne nécessite de script SQL.
        </p>
      </div>

      {/* Sous-navigation */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {disponibles.map((section) => (
          <button
            key={section.cle}
            onClick={() => setActive(section.cle)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active === section.cle
                ? 'bg-ardoise-900 text-white'
                : 'bg-white text-ardoise-600 ring-1 ring-inset ring-ardoise-200 hover:bg-ardoise-50',
            )}
          >
            {section.icone}
            {section.libelle}
          </button>
        ))}
      </div>

      {rendu()}

      {/* Création en série des dossiers camions */}
      <AssistantCamions
        lot={lotCible}
        camions={portefeuille.camions}
        onFermer={() => setLotCible(null)}
        onSucces={(message) => {
          toast.succes(message)
          void portefeuille.recharger()
        }}
      />
    </div>
  )
}
