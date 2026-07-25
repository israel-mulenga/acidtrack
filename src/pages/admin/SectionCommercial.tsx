/**
 * Hiérarchie commerciale : commandes et lots.
 *
 * Les contrôles de cohérence quantitative (§5) sont appliqués à la saisie :
 * on ne peut pas planifier plus que ce qui a été commandé, ni réduire une
 * commande en dessous de ce qui est déjà planifié.
 */

import { Link } from 'react-router-dom'
import { ExternalLink, Truck } from 'lucide-react'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { useUtilisateur } from '@/session'
import {
  controleQuantiteLot,
  creer,
  modifier,
  supprimer,
  tonnageAffecte,
  tonnagePlanifie,
} from '@/lib/crud'
import { prochaineReferenceCommande, prochaineReferenceLot } from '@/lib/references'
import type { Commande, Lot } from '@/lib/types'
import { formatDate, formatTonnage } from '@/lib/utils'
import { CrudRessource } from '@/components/CrudRessource'
import type { ValeursFormulaire } from '@/components/CrudRessource'
import { useToast } from '@/components/Toast'

const texte = (v: unknown) => String(v ?? '').trim()
const texteOuNull = (v: unknown) => texte(v) || null
const nombreOuNull = (v: unknown) => (texte(v) === '' ? null : Number(v))

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export function SectionCommandes({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const profil = useUtilisateur()
  const toast = useToast()

  return (
    <CrudRessource<Commande>
      titre="Commandes"
      description="Engagement commercial avec un client. La quantité commandée plafonne le total des lots."
      libelleCreation="Nouvelle commande"
      elements={portefeuille.commandes}
      rechercheDans={(c) =>
        `${c.reference} ${c.destination} ${
          portefeuille.clients.find((x) => x.id === c.client_id)?.raison_sociale ?? ''
        }`
      }
      libelleElement={(c) => c.reference}
      colonnes={[
        {
          cle: 'reference',
          libelle: 'Référence',
          rendu: (c) => <span className="font-medium text-ardoise-900">{c.reference}</span>,
        },
        {
          cle: 'client',
          libelle: 'Client',
          rendu: (c) =>
            portefeuille.clients.find((x) => x.id === c.client_id)?.raison_sociale ?? '—',
        },
        {
          cle: 'quantite',
          libelle: 'Commandé',
          rendu: (c) => formatTonnage(c.quantite_commandee_t),
          masquerMobile: true,
        },
        {
          cle: 'planifie',
          libelle: 'Planifié',
          rendu: (c) => {
            const planifie = tonnagePlanifie(c.id, portefeuille.lots)
            const complet = planifie >= Number(c.quantite_commandee_t) - 0.001
            return (
              <span className={complet ? 'text-emerald-600' : 'text-ardoise-600'}>
                {formatTonnage(planifie)}
              </span>
            )
          },
          masquerMobile: true,
        },
        { cle: 'destination', libelle: 'Destination', rendu: (c) => c.destination },
      ]}
      champs={() => [
        {
          cle: 'client_id',
          libelle: 'Client',
          type: 'liste',
          obligatoire: true,
          options: portefeuille.clients
            .filter((c) => c.actif)
            .map((c) => ({ valeur: c.id, libelle: c.raison_sociale })),
        },
        {
          cle: 'reference',
          libelle: 'Référence',
          type: 'texte',
          obligatoire: true,
          aide: 'Proposée automatiquement, modifiable.',
        },
        { cle: 'produit', libelle: 'Produit', type: 'texte', obligatoire: true },
        { cle: 'concentration', libelle: 'Concentration', type: 'texte' },
        {
          cle: 'quantite_commandee_t',
          libelle: 'Quantité commandée',
          type: 'nombre',
          unite: 't',
          obligatoire: true,
        },
        { cle: 'prix_unitaire_usd', libelle: 'Prix unitaire', type: 'nombre', unite: 'USD/t' },
        { cle: 'origine', libelle: 'Origine', type: 'texte', obligatoire: true },
        { cle: 'destination', libelle: 'Destination', type: 'texte', obligatoire: true },
        {
          cle: 'conditions_paiement',
          libelle: 'Conditions de paiement',
          type: 'texte',
          pleineLargeur: true,
        },
      ]}
      valeursInitiales={(c) => ({
        client_id: c?.client_id ?? '',
        reference: c?.reference ?? prochaineReferenceCommande(portefeuille.commandes),
        produit: c?.produit ?? 'Acide sulfurique H2SO4',
        concentration: c?.concentration ?? '98%',
        quantite_commandee_t: c?.quantite_commandee_t?.toString() ?? '',
        prix_unitaire_usd: c?.prix_unitaire_usd?.toString() ?? '',
        origine: c?.origine ?? 'Zambie',
        destination: c?.destination ?? '',
        conditions_paiement: c?.conditions_paiement ?? '',
      })}
      valider={(v: ValeursFormulaire, element) => {
        const erreurs: string[] = []
        const quantite = Number(v.quantite_commandee_t)
        if (!Number.isFinite(quantite) || quantite <= 0) {
          erreurs.push('La quantité commandée doit être supérieure à zéro.')
        } else if (element) {
          // On ne peut pas réduire une commande sous le total déjà planifié
          const planifie = tonnagePlanifie(element.id, portefeuille.lots)
          if (quantite < planifie - 0.001) {
            erreurs.push(
              `${planifie.toLocaleString('fr-FR')} t sont déjà planifiées en lots : ` +
                'la quantité commandée ne peut pas être inférieure.',
            )
          }
        }
        return erreurs
      }}
      onEnregistrer={async (v, element) => {
        const ligne = {
          organisation_id: profil.organisation_id,
          client_id: texte(v.client_id),
          reference: texte(v.reference),
          produit: texte(v.produit),
          concentration: texteOuNull(v.concentration),
          quantite_commandee_t: Number(v.quantite_commandee_t),
          prix_unitaire_usd: nombreOuNull(v.prix_unitaire_usd),
          origine: texte(v.origine),
          destination: texte(v.destination),
          conditions_paiement: texteOuNull(v.conditions_paiement),
        }
        if (element) await modifier('commandes', element.id, ligne)
        else await creer('commandes', ligne)
        toast.succes(element ? 'Commande mise à jour.' : `Commande ${ligne.reference} créée.`)
        await portefeuille.recharger()
      }}
      onSupprimer={async (c) => {
        await supprimer('commandes', c.id)
        toast.succes('Commande supprimée.')
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Lots                                                                */
/* ------------------------------------------------------------------ */

export function SectionLots({
  portefeuille,
  onAjouterCamions,
}: {
  portefeuille: PortefeuilleComplet
  onAjouterCamions: (lot: Lot) => void
}) {
  const profil = useUtilisateur()
  const toast = useToast()

  return (
    <CrudRessource<Lot>
      titre="Lots"
      description="Découpage opérationnel d’une commande. L’itinéraire choisi détermine les jalons proposés au terrain."
      libelleCreation="Nouveau lot"
      elements={portefeuille.lots}
      rechercheDans={(l) => `${l.reference} ${l.destination} ${l.corridor}`}
      libelleElement={(l) => l.reference}
      colonnes={[
        {
          cle: 'reference',
          libelle: 'Référence',
          rendu: (l) => <span className="font-medium text-ardoise-900">{l.reference}</span>,
        },
        {
          cle: 'commande',
          libelle: 'Commande',
          rendu: (l) =>
            portefeuille.commandes.find((c) => c.id === l.commande_id)?.reference ?? '—',
          masquerMobile: true,
        },
        { cle: 'destination', libelle: 'Destination', rendu: (l) => l.destination },
        {
          cle: 'tonnage',
          libelle: 'Affecté / planifié',
          rendu: (l) => {
            const affecte = tonnageAffecte(l.id, portefeuille.camions)
            return (
              <span className="tabular-nums">
                {formatTonnage(affecte)}{' '}
                <span className="text-ardoise-400">/ {formatTonnage(l.quantite_planifiee_t)}</span>
              </span>
            )
          },
        },
        {
          cle: 'camions',
          libelle: 'Camions',
          rendu: (l) => {
            const nombre = portefeuille.camions.filter((c) => c.lot_id === l.id).length
            return (
              <span className="tabular-nums">
                {nombre} <span className="text-ardoise-400">/ {l.nb_camions_prevu}</span>
              </span>
            )
          },
          masquerMobile: true,
        },
        {
          cle: 'periode',
          libelle: 'Période',
          rendu: (l) =>
            l.periode_debut ? (
              <span className="text-xs text-ardoise-500">
                {formatDate(l.periode_debut)} → {l.periode_fin ? formatDate(l.periode_fin) : '…'}
              </span>
            ) : (
              '—'
            ),
          masquerMobile: true,
        },
      ]}
      actionsSupplementaires={(lot) => (
        <>
          <button
            onClick={() => onAjouterCamions(lot)}
            aria-label={`Ajouter des camions au lot ${lot.reference}`}
            title="Ajouter des dossiers camions"
            className="rounded-md p-1.5 text-ardoise-400 transition-colors hover:bg-ambre-50 hover:text-ambre-700"
          >
            <Truck className="size-4" />
          </button>
          <Link
            to={`/lots/${lot.id}`}
            aria-label={`Ouvrir le lot ${lot.reference}`}
            title="Ouvrir la vue lot"
            className="rounded-md p-1.5 text-ardoise-400 transition-colors hover:bg-ardoise-100 hover:text-ardoise-900"
          >
            <ExternalLink className="size-4" />
          </Link>
        </>
      )}
      champs={(lot) => [
        {
          cle: 'commande_id',
          libelle: 'Commande',
          type: 'liste',
          obligatoire: true,
          options: portefeuille.commandes.map((c) => {
            const restant =
              Number(c.quantite_commandee_t) -
              tonnagePlanifie(c.id, portefeuille.lots, lot?.id)
            return {
              valeur: c.id,
              libelle: `${c.reference} — ${formatTonnage(restant)} disponibles`,
            }
          }),
        },
        { cle: 'reference', libelle: 'Référence', type: 'texte', obligatoire: true },
        {
          cle: 'itineraire_id',
          libelle: 'Itinéraire',
          type: 'liste',
          options: portefeuille.itineraires
            .filter((i) => i.actif)
            .map((i) => ({
              valeur: i.id,
              libelle: `${i.nom} (${i.jalons.length} jalons)`,
            })),
          aide: 'Détermine les points de contrôle proposés lors des mises à jour terrain.',
          pleineLargeur: true,
        },
        {
          cle: 'corridor',
          libelle: 'Corridor',
          type: 'texte',
          aide: 'Repris de l’itinéraire si laissé vide.',
        },
        {
          cle: 'destination',
          libelle: 'Destination',
          type: 'texte',
          aide: 'Reprise de l’itinéraire si laissée vide.',
        },
        {
          cle: 'quantite_planifiee_t',
          libelle: 'Quantité planifiée',
          type: 'nombre',
          unite: 't',
          obligatoire: true,
        },
        { cle: 'nb_camions_prevu', libelle: 'Camions prévus', type: 'nombre' },
        { cle: 'periode_debut', libelle: 'Début de période', type: 'date' },
        { cle: 'periode_fin', libelle: 'Fin de période', type: 'date' },
      ]}
      valeursInitiales={(l) => {
        const commande =
          portefeuille.commandes.find((c) => c.id === l?.commande_id) ??
          portefeuille.commandes[0]
        return {
          commande_id: l?.commande_id ?? commande?.id ?? '',
          reference:
            l?.reference ??
            (commande ? prochaineReferenceLot(commande, portefeuille.lots) : ''),
          itineraire_id: l?.itineraire_id ?? '',
          corridor: l?.corridor ?? '',
          destination: l?.destination ?? commande?.destination ?? '',
          quantite_planifiee_t: l?.quantite_planifiee_t?.toString() ?? '',
          nb_camions_prevu: l?.nb_camions_prevu?.toString() ?? '',
          periode_debut: l?.periode_debut ?? '',
          periode_fin: l?.periode_fin ?? '',
        }
      }}
      valider={(v: ValeursFormulaire, element) => {
        const erreurs: string[] = []
        const quantite = Number(v.quantite_planifiee_t)
        const commande = portefeuille.commandes.find((c) => c.id === texte(v.commande_id))
        const itineraire = portefeuille.itineraires.find((i) => i.id === texte(v.itineraire_id))

        // Corridor et destination viennent de l'itinéraire, sinon ils sont exigés
        if (!itineraire && (!texte(v.corridor) || !texte(v.destination))) {
          erreurs.push(
            'Choisissez un itinéraire, ou renseignez manuellement le corridor et la destination.',
          )
        }

        if (!Number.isFinite(quantite) || quantite <= 0) {
          erreurs.push('La quantité planifiée doit être supérieure à zéro.')
        } else if (commande) {
          const message = controleQuantiteLot(
            commande,
            portefeuille.lots,
            quantite,
            element?.id,
          )
          if (message) erreurs.push(message)
        }

        if (element) {
          const affecte = tonnageAffecte(element.id, portefeuille.camions)
          if (Number.isFinite(quantite) && quantite < affecte - 0.001) {
            erreurs.push(
              `${affecte.toLocaleString('fr-FR')} t sont déjà affectées à des camions : ` +
                'la quantité planifiée ne peut pas être inférieure.',
            )
          }
        }

        if (v.periode_debut && v.periode_fin && v.periode_fin < v.periode_debut) {
          erreurs.push('La fin de période doit suivre son début.')
        }
        return erreurs
      }}
      onEnregistrer={async (v, element) => {
        const itineraire = portefeuille.itineraires.find(
          (i) => i.id === texte(v.itineraire_id),
        )
        const ligne = {
          organisation_id: profil.organisation_id,
          commande_id: texte(v.commande_id),
          reference: texte(v.reference),
          itineraire_id: texteOuNull(v.itineraire_id),
          // Le modèle d'étapes suit l'itinéraire choisi
          modele_etapes_id:
            itineraire?.modele_etapes_id ??
            portefeuille.modeles.find((m) => m.par_defaut)?.id ??
            null,
          corridor: texte(v.corridor) || itineraire?.corridor || '',
          destination: texte(v.destination) || itineraire?.destination || '',
          quantite_planifiee_t: Number(v.quantite_planifiee_t),
          nb_camions_prevu: Number(v.nb_camions_prevu || 0),
          periode_debut: texteOuNull(v.periode_debut),
          periode_fin: texteOuNull(v.periode_fin),
        }
        if (element) await modifier('lots', element.id, ligne)
        else await creer('lots', ligne)
        toast.succes(element ? 'Lot mis à jour.' : `Lot ${ligne.reference} créé.`)
        await portefeuille.recharger()
      }}
      onSupprimer={async (l) => {
        await supprimer('lots', l.id)
        toast.succes('Lot supprimé.')
        await portefeuille.recharger()
      }}
    />
  )
}
