import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertTriangle, Eye, LayoutDashboard, Package, Settings, Truck } from 'lucide-react'
import { usePortefeuille } from '@/hooks/useDonnees'
import { useSession } from '@/session'
import { Coquille } from '@/components/Coquille'
import { Encart } from '@/components/ui'
import { TourDeControle } from '@/pages/TourDeControle'
import { VueLot } from '@/pages/VueLot'
import { FicheCamion } from '@/pages/FicheCamion'
import { PortailClient } from '@/pages/PortailClient'
import { MesTaches } from '@/pages/MesTaches'
import { Administration } from '@/pages/Administration'

export default function App() {
  const portefeuille = usePortefeuille()
  const { estClient, profil, peut } = useSession()

  const ongletAdmin = {
    vers: '/administration',
    libelle: 'Administration',
    icone: <Settings className="size-5 sm:size-4" />,
  }

  // La navigation dépend du profil : le client n'accède qu'à son portail.
  const onglets = estClient
    ? [{ vers: '/', libelle: 'Mes livraisons', icone: <Eye className="size-5 sm:size-4" /> }]
    : profil.role === 'TERRAIN'
      ? [
          { vers: '/', libelle: 'Mes tâches', icone: <Truck className="size-5 sm:size-4" /> },
          {
            vers: '/controle',
            libelle: 'Tour de contrôle',
            icone: <LayoutDashboard className="size-5 sm:size-4" />,
            pastille: portefeuille.nbExceptions,
          },
        ]
      : [
          {
            vers: '/',
            libelle: 'Tour de contrôle',
            icone: <LayoutDashboard className="size-5 sm:size-4" />,
            pastille: portefeuille.nbExceptions,
          },
          { vers: '/taches', libelle: 'Mes tâches', icone: <Package className="size-5 sm:size-4" /> },
          ...(peut('administrer_commercial') || peut('administrer_referentiel')
            ? [ongletAdmin]
            : []),
        ]

  return (
    <Coquille onglets={onglets}>
      {portefeuille.erreur && (
        <div className="mb-4">
          <Encart
            ton="erreur"
            titre="Connexion à la base impossible"
            icone={<AlertTriangle className="size-4" />}
          >
            {portefeuille.erreur}
          </Encart>
        </div>
      )}

      <Routes>
        {estClient ? (
          <>
            <Route path="/" element={<PortailClient portefeuille={portefeuille} />} />
            <Route path="/camions/:id" element={<FicheCamion portefeuille={portefeuille} />} />
          </>
        ) : (
          <>
            <Route
              path="/"
              element={
                profil.role === 'TERRAIN' ? (
                  <MesTaches portefeuille={portefeuille} />
                ) : (
                  <TourDeControle portefeuille={portefeuille} />
                )
              }
            />
            <Route path="/controle" element={<TourDeControle portefeuille={portefeuille} />} />
            <Route path="/taches" element={<MesTaches portefeuille={portefeuille} />} />
            <Route path="/lots/:id" element={<VueLot portefeuille={portefeuille} />} />
            <Route path="/camions/:id" element={<FicheCamion portefeuille={portefeuille} />} />
            <Route
              path="/administration"
              element={<Administration portefeuille={portefeuille} />}
            />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Coquille>
  )
}
