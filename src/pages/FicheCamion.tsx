/**
 * Fiche d'un dossier camion : chronologie, détails, incidents.
 * Écran commun aux trois profils, dont le contenu s'adapte aux droits.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  MapPin,
  Phone,
  ShieldAlert,
  Truck,
  User,
} from 'lucide-react'
import type { EtapeEvenement, EtapeReferentiel, Incident } from '@/lib/types'
import { useDossierCamion, type PortefeuilleComplet } from '@/hooks/useDonnees'
import { useSession } from '@/session'
import {
  ErreurMetier,
  rejeterEvenement,
  resoudreIncident,
  validerEvenement,
} from '@/lib/actions'
import {
  depassementSla,
  estEnRetard,
  progressionCamion,
} from '@/lib/workflow'
import { depuis, formatDateHeure, formatTonnage, jusqua } from '@/lib/utils'
import {
  BadgeCamion,
  BadgeGravite,
  Bouton,
  Carte,
  Encart,
  EtatVide,
  Modale,
  Progression,
  Squelette,
  ZoneTexte,
} from '@/components/ui'
import { Chronologie } from '@/components/Chronologie'
import { ModaleEtape } from '@/components/ModaleEtape'
import { ModaleIncident } from '@/components/ModaleIncident'
import { useToast } from '@/components/Toast'

export function FicheCamion({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { id } = useParams<{ id: string }>()
  const { profil, peut, estClient } = useSession()
  const toast = useToast()

  const dossier = useDossierCamion(id)
  const [etapeEnEdition, setEtapeEnEdition] = useState<EtapeReferentiel | null>(null)
  const [evenementARejeter, setEvenementARejeter] = useState<EtapeEvenement | null>(null)
  const [motifRejet, setMotifRejet] = useState('')
  const [incidentOuvert, setIncidentOuvert] = useState(false)
  const [traitement, setTraitement] = useState(false)

  const camion = portefeuille.camions.find((c) => c.id === id)
  const lot = portefeuille.lots.find((l) => l.id === camion?.lot_id)
  const commande = portefeuille.commandes.find((c) => c.id === lot?.commande_id)

  if (portefeuille.chargement) {
    return (
      <div className="space-y-3">
        <Squelette className="h-28" />
        <Squelette className="h-96" />
      </div>
    )
  }

  if (!camion || !lot) {
    return (
      <EtatVide
        icone={<Truck className="size-10" />}
        titre="Dossier camion introuvable"
        description="Ce dossier n’existe pas ou ne fait pas partie de votre périmètre."
        action={
          <Link to="/">
            <Bouton variante="secondaire">
              <ArrowLeft className="size-4" />
              Retour
            </Bouton>
          </Link>
        }
      />
    )
  }

  const progression = progressionCamion(camion)
  const enRetard = estEnRetard(camion, portefeuille.referentiel)
  const incidentsOuverts = dossier.incidents.filter((i) => i.statut === 'OUVERT')
  const documentsVisibles = estClient
    ? dossier.documents.filter((d) => d.visible_client)
    : dossier.documents

  /* --- Actions ------------------------------------------------------ */

  const rafraichir = async () => {
    await Promise.all([dossier.recharger(), portefeuille.recharger()])
  }

  const approuver = async (evenement: EtapeEvenement) => {
    setTraitement(true)
    try {
      await validerEvenement(evenement.id, camion, evenement.etape_numero, profil.nom)
      toast.succes(`Étape ${evenement.etape_numero} approuvée. Le camion progresse.`)
      await rafraichir()
    } catch (e) {
      toast.erreur(e instanceof ErreurMetier ? e.message : String(e))
    } finally {
      setTraitement(false)
    }
  }

  const confirmerRejet = async () => {
    if (!evenementARejeter) return
    setTraitement(true)
    try {
      await rejeterEvenement(evenementARejeter.id, camion.id, motifRejet, profil.nom)
      toast.succes('Soumission rejetée. L’auteur doit reprendre l’étape.')
      setEvenementARejeter(null)
      setMotifRejet('')
      await rafraichir()
    } catch (e) {
      toast.erreur(e instanceof ErreurMetier ? e.message : String(e))
    } finally {
      setTraitement(false)
    }
  }

  const cloturerIncident = async (incident: Incident, resolution: string) => {
    setTraitement(true)
    try {
      await resoudreIncident(incident.id, resolution)
      toast.succes('Incident résolu, le camion est débloqué.')
      await rafraichir()
    } catch (e) {
      toast.erreur(e instanceof ErreurMetier ? e.message : String(e))
    } finally {
      setTraitement(false)
    }
  }

  /* --- Rendu -------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <Link
        to={estClient ? '/' : `/lots/${lot.id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-ardoise-500 transition-colors hover:text-ardoise-900"
      >
        <ChevronLeft className="size-4" />
        {lot.reference}
      </Link>

      {/* En-tête du dossier */}
      <Carte className="overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-ardoise-900">
                {camion.reference}
              </h1>
              <p className="mt-0.5 text-sm text-ardoise-500">
                {lot.corridor} · {formatTonnage(camion.tonnage_net_t)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <BadgeCamion statut={camion.statut} />
              {enRetard && camion.statut !== 'BLOQUE' && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                  Retard {depassementSla(camion, portefeuille.referentiel)} h
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Progression
              valeur={progression}
              className="h-2.5 flex-1"
              couleur={
                camion.statut === 'BLOQUE'
                  ? 'bg-red-500'
                  : camion.statut === 'TERMINE'
                    ? 'bg-emerald-500'
                    : enRetard
                      ? 'bg-orange-500'
                      : 'bg-ardoise-900'
              }
            />
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ardoise-900">
              {progression}%
            </span>
          </div>
        </div>

        {/* Bandeau d'informations */}
        <dl className="grid grid-cols-2 gap-px border-t border-ardoise-200 bg-ardoise-200 sm:grid-cols-4">
          <Info
            libelle="Position"
            valeur={camion.derniere_position_lib ?? '—'}
            detail={depuis(camion.derniere_maj_at)}
            icone={<MapPin className="size-3.5" />}
          />
          <Info
            libelle="ETA"
            valeur={camion.eta ? formatDateHeure(camion.eta) : '—'}
            detail={camion.eta ? jusqua(camion.eta) : undefined}
          />
          <Info
            libelle="Chauffeur"
            valeur={camion.chauffeur_nom ?? '—'}
            detail={estClient ? undefined : (camion.chauffeur_tel ?? undefined)}
            icone={<User className="size-3.5" />}
          />
          <Info
            libelle="Plaques"
            valeur={camion.plaque_tracteur}
            detail={camion.plaque_citerne ?? undefined}
            icone={<Truck className="size-3.5" />}
          />
        </dl>
      </Carte>

      {/* Contact chauffeur — action rapide sur mobile */}
      {!estClient && camion.chauffeur_tel && (
        <a href={`tel:${camion.chauffeur_tel}`} className="block sm:hidden">
          <Bouton variante="secondaire" className="w-full">
            <Phone className="size-4" />
            Appeler {camion.chauffeur_nom}
          </Bouton>
        </a>
      )}

      {/* Incidents ouverts */}
      {incidentsOuverts.length > 0 && (
        <div className="space-y-2">
          {incidentsOuverts.map((incident) => (
            <CarteIncident
              key={incident.id}
              incident={incident}
              vueClient={estClient}
              peutResoudre={peut('resoudre_incident')}
              onResoudre={cloturerIncident}
              traitement={traitement}
            />
          ))}
        </div>
      )}

      {/* Chronologie */}
      <Carte className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold tracking-tight text-ardoise-900">
            Chronologie du dossier
          </h2>
          {peut('ouvrir_incident') && camion.statut !== 'TERMINE' && (
            <Bouton variante="secondaire" taille="sm" onClick={() => setIncidentOuvert(true)}>
              <ShieldAlert className="size-4" />
              <span className="hidden sm:inline">Signaler un incident</span>
              <span className="sm:hidden">Incident</span>
            </Bouton>
          )}
        </div>

        {dossier.chargement ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Squelette key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <Chronologie
            camion={camion}
            referentiel={portefeuille.referentiel}
            evenements={dossier.evenements}
            documents={documentsVisibles}
            vueClient={estClient}
            peutSaisir={peut('saisir_etape')}
            peutValider={peut('valider_etape')}
            onMettreAJour={setEtapeEnEdition}
            onValider={(e) => void approuver(e)}
            onRejeter={setEvenementARejeter}
          />
        )}
      </Carte>

      {/* Informations commerciales — jamais exposées au client */}
      {!estClient && commande && (
        <Carte className="p-4 sm:p-5">
          <h2 className="mb-3 font-semibold tracking-tight text-ardoise-900">Rattachement</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <LigneInfo libelle="Commande" valeur={commande.reference} />
            <LigneInfo libelle="Lot" valeur={lot.reference} />
            <LigneInfo libelle="Transporteur" valeur={camion.transporteur ?? '—'} />
            <LigneInfo libelle="Scellés" valeur={camion.numeros_scelles ?? '—'} />
          </dl>
        </Carte>
      )}

      {/* --- Modales --- */}

      {etapeEnEdition && (
        <ModaleEtape
          ouverte
          onFermer={() => setEtapeEnEdition(null)}
          camion={camion}
          lot={lot}
          etape={etapeEnEdition}
          documents={dossier.documents.filter(
            (d) => d.etape_numero === etapeEnEdition.numero,
          )}
          dernierEvenement={dossier.evenements
            .filter((e) => e.etape_numero === etapeEnEdition.numero)
            .at(-1)}
          auteurNom={profil.nom}
          auteurRole={profil.role}
          autoValidation={peut('valider_etape')}
          onSucces={(message) => {
            toast.succes(message)
            void rafraichir()
          }}
        />
      )}

      <ModaleIncident
        ouverte={incidentOuvert}
        onFermer={() => setIncidentOuvert(false)}
        camion={camion}
        auteur={profil.nom}
        onSucces={(message) => {
          toast.succes(message)
          void rafraichir()
        }}
      />

      {/* Rejet motivé (AC-04) */}
      <Modale
        ouverte={!!evenementARejeter}
        onFermer={() => setEvenementARejeter(null)}
        titre="Rejeter la soumission"
        sousTitre={`Étape ${evenementARejeter?.etape_numero} · ${camion.reference}`}
        pied={
          <div className="flex gap-2">
            <Bouton
              variante="secondaire"
              className="flex-1"
              onClick={() => setEvenementARejeter(null)}
            >
              Annuler
            </Bouton>
            <Bouton
              variante="danger"
              className="flex-1"
              disabled={traitement || !motifRejet.trim()}
              onClick={() => void confirmerRejet()}
            >
              Confirmer le rejet
            </Bouton>
          </div>
        }
      >
        <div className="space-y-3">
          <Encart ton="alerte">
            L’étape retournera à l’état « à traiter ». Le motif sera visible par l’auteur de la
            saisie et conservé dans l’historique.
          </Encart>
          <div>
            <label htmlFor="motif" className="mb-1.5 block text-sm font-medium text-ardoise-700">
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <ZoneTexte
              id="motif"
              value={motifRejet}
              onChange={(e) => setMotifRejet(e.target.value)}
              placeholder="Ex. : le numéro de déclaration ne correspond pas à la quittance jointe."
              autoFocus
            />
          </div>
        </div>
      </Modale>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                     */
/* ------------------------------------------------------------------ */

function Info({
  libelle,
  valeur,
  detail,
  icone,
}: {
  libelle: string
  valeur: string
  detail?: string
  icone?: React.ReactNode
}) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-ardoise-400">
        {icone}
        {libelle}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ardoise-900">{valeur}</dd>
      {detail && <dd className="truncate text-xs text-ardoise-400">{detail}</dd>}
    </div>
  )
}

function LigneInfo({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-ardoise-400">{libelle}</dt>
      <dd className="truncate font-medium text-ardoise-800">{valeur}</dd>
    </div>
  )
}

function CarteIncident({
  incident,
  vueClient,
  peutResoudre,
  onResoudre,
  traitement,
}: {
  incident: Incident
  vueClient: boolean
  peutResoudre: boolean
  onResoudre: (incident: Incident, resolution: string) => void
  traitement: boolean
}) {
  const [ouverte, setOuverte] = useState(false)
  const [resolution, setResolution] = useState('')

  const critique = incident.gravite === 'CRITIQUE'

  return (
    <>
      <Carte
        className={
          critique ? 'border-red-200 bg-red-50/60 p-4' : 'border-ambre-200 bg-ambre-50/50 p-4'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <BadgeGravite gravite={incident.gravite} />
          <span className="text-xs font-medium uppercase tracking-wide text-ardoise-500">
            {incident.categorie}
          </span>
          <span className="text-xs text-ardoise-400">{depuis(incident.created_at)}</span>
        </div>

        <p className="mt-2 text-sm text-ardoise-800">{incident.description}</p>

        {!vueClient && incident.plan_action && (
          <p className="mt-2 text-sm text-ardoise-600">
            <span className="font-medium">Plan d’action :</span> {incident.plan_action}
          </p>
        )}
        {!vueClient && incident.responsable && (
          <p className="mt-1 text-xs text-ardoise-500">Responsable : {incident.responsable}</p>
        )}

        {peutResoudre && (
          <Bouton
            variante="secondaire"
            taille="sm"
            className="mt-3"
            onClick={() => setOuverte(true)}
          >
            Résoudre l’incident
          </Bouton>
        )}
      </Carte>

      <Modale
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre="Résoudre l’incident"
        sousTitre={incident.categorie}
        pied={
          <Bouton
            variante="succes"
            className="w-full"
            disabled={traitement || !resolution.trim()}
            onClick={() => {
              onResoudre(incident, resolution)
              setOuverte(false)
            }}
          >
            Marquer comme résolu
          </Bouton>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ardoise-600">{incident.description}</p>
          {critique && (
            <Encart ton="info">
              Cet incident est critique : sa résolution débloquera automatiquement le camion.
            </Encart>
          )}
          <div>
            <label
              htmlFor="resolution"
              className="mb-1.5 block text-sm font-medium text-ardoise-700"
            >
              Résolution <span className="text-red-500">*</span>
            </label>
            <ZoneTexte
              id="resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Ex. : re-pesée contradictoire effectuée, déclaration rectificative acceptée."
              autoFocus
            />
          </div>
        </div>
      </Modale>
    </>
  )
}
