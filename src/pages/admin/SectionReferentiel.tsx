/**
 * Référentiel : clients, points de chargement, itinéraires, comptes.
 * Chaque ressource se déclare en colonnes + champs ; la mécanique de
 * création, d'édition et de suppression vient de `CrudRessource`.
 */

import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { useSession } from '@/session'
import { creer, modifier, supprimer } from '@/lib/crud'
import type {
  Client,
  Itineraire,
  Organisation,
  PointChargement,
  Utilisateur,
} from '@/lib/types'
import { CrudRessource } from '@/components/CrudRessource'
import type { ValeursFormulaire } from '@/components/CrudRessource'
import { useToast } from '@/components/Toast'

/** Découpe une saisie « a, b, c » en tableau exploitable. */
function versListe(valeur: unknown): string[] {
  return String(valeur ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

const texte = (v: unknown) => String(v ?? '').trim()
const texteOuNull = (v: unknown) => texte(v) || null
const nombreOuNull = (v: unknown) => (texte(v) === '' ? null : Number(v))

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export function SectionClients({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { profil } = useSession()
  const toast = useToast()

  return (
    <CrudRessource<Client>
      titre="Clients"
      description="Mines et sociétés destinataires des livraisons."
      libelleCreation="Nouveau client"
      elements={portefeuille.clients}
      rechercheDans={(c) => `${c.raison_sociale} ${c.mine ?? ''} ${c.ville ?? ''}`}
      libelleElement={(c) => c.raison_sociale}
      colonnes={[
        { cle: 'nom', libelle: 'Raison sociale', rendu: (c) => (
          <span className="font-medium text-ardoise-900">{c.raison_sociale}</span>
        ) },
        { cle: 'mine', libelle: 'Mine', rendu: (c) => c.mine ?? '—', masquerMobile: true },
        { cle: 'ville', libelle: 'Ville', rendu: (c) => c.ville ?? '—', masquerMobile: true },
        {
          cle: 'contact',
          libelle: 'Contact',
          rendu: (c) => c.contact_nom ?? '—',
          masquerMobile: true,
        },
        {
          cle: 'actif',
          libelle: 'État',
          rendu: (c) =>
            c.actif ? (
              <span className="text-emerald-600">Actif</span>
            ) : (
              <span className="text-ardoise-400">Inactif</span>
            ),
        },
      ]}
      champs={() => [
        { cle: 'raison_sociale', libelle: 'Raison sociale', type: 'texte', obligatoire: true },
        { cle: 'mine', libelle: 'Mine', type: 'texte' },
        { cle: 'ville', libelle: 'Ville', type: 'texte' },
        { cle: 'contact_nom', libelle: 'Contact', type: 'texte' },
        { cle: 'contact_tel', libelle: 'Téléphone', type: 'tel' },
        { cle: 'actif', libelle: 'Client actif', type: 'booleen' },
      ]}
      valeursInitiales={(c) => ({
        raison_sociale: c?.raison_sociale ?? '',
        mine: c?.mine ?? '',
        ville: c?.ville ?? '',
        contact_nom: c?.contact_nom ?? '',
        contact_tel: c?.contact_tel ?? '',
        actif: c?.actif ?? true,
      })}
      onEnregistrer={async (v, element) => {
        const ligne = {
          organisation_id: profil.organisation_id,
          raison_sociale: texte(v.raison_sociale),
          mine: texteOuNull(v.mine),
          ville: texteOuNull(v.ville),
          contact_nom: texteOuNull(v.contact_nom),
          contact_tel: texteOuNull(v.contact_tel),
          actif: v.actif === true,
        }
        if (element) await modifier('clients', element.id, ligne)
        else await creer('clients', ligne)
        toast.succes(element ? 'Client mis à jour.' : 'Client créé.')
        await portefeuille.recharger()
      }}
      onSupprimer={async (c) => {
        await supprimer('clients', c.id)
        toast.succes('Client supprimé.')
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Points de chargement                                                */
/* ------------------------------------------------------------------ */

export function SectionPointsChargement({
  portefeuille,
}: {
  portefeuille: PortefeuilleComplet
}) {
  const { profil } = useSession()
  const toast = useToast()

  return (
    <CrudRessource<PointChargement>
      titre="Points de chargement"
      description="Usines et terminaux où les camions sont chargés."
      libelleCreation="Nouveau point"
      elements={portefeuille.pointsChargement}
      rechercheDans={(p) => `${p.nom} ${p.ville ?? ''} ${p.pays}`}
      libelleElement={(p) => p.nom}
      colonnes={[
        { cle: 'nom', libelle: 'Nom', rendu: (p) => (
          <span className="font-medium text-ardoise-900">{p.nom}</span>
        ) },
        { cle: 'ville', libelle: 'Ville', rendu: (p) => p.ville ?? '—' },
        { cle: 'pays', libelle: 'Pays', rendu: (p) => p.pays, masquerMobile: true },
        {
          cle: 'contact',
          libelle: 'Contact',
          rendu: (p) => p.contact_nom ?? '—',
          masquerMobile: true,
        },
      ]}
      champs={() => [
        { cle: 'nom', libelle: 'Nom du point', type: 'texte', obligatoire: true },
        { cle: 'ville', libelle: 'Ville', type: 'texte' },
        { cle: 'pays', libelle: 'Pays', type: 'texte', obligatoire: true },
        { cle: 'contact_nom', libelle: 'Contact', type: 'texte' },
        { cle: 'contact_tel', libelle: 'Téléphone', type: 'tel' },
        { cle: 'actif', libelle: 'Point actif', type: 'booleen' },
      ]}
      valeursInitiales={(p) => ({
        nom: p?.nom ?? '',
        ville: p?.ville ?? '',
        pays: p?.pays ?? 'Zambie',
        contact_nom: p?.contact_nom ?? '',
        contact_tel: p?.contact_tel ?? '',
        actif: p?.actif ?? true,
      })}
      onEnregistrer={async (v, element) => {
        const ligne = {
          organisation_id: profil.organisation_id,
          nom: texte(v.nom),
          ville: texteOuNull(v.ville),
          pays: texte(v.pays),
          contact_nom: texteOuNull(v.contact_nom),
          contact_tel: texteOuNull(v.contact_tel),
          actif: v.actif === true,
        }
        if (element) await modifier('points_chargement', element.id, ligne)
        else await creer('points_chargement', ligne)
        toast.succes(element ? 'Point mis à jour.' : 'Point de chargement créé.')
        await portefeuille.recharger()
      }}
      onSupprimer={async (p) => {
        await supprimer('points_chargement', p.id)
        toast.succes('Point supprimé.')
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Itinéraires                                                         */
/* ------------------------------------------------------------------ */

export function SectionItineraires({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { profil } = useSession()
  const toast = useToast()

  return (
    <CrudRessource<Itineraire>
      titre="Itinéraires"
      description="Les jalons saisis ici pilotent les points de contrôle proposés sur le terrain : un itinéraire Lubumbashi ne propose pas les jalons Kolwezi."
      libelleCreation="Nouvel itinéraire"
      elements={portefeuille.itineraires}
      rechercheDans={(i) => `${i.nom} ${i.destination} ${i.corridor}`}
      libelleElement={(i) => i.nom}
      colonnes={[
        { cle: 'nom', libelle: 'Itinéraire', rendu: (i) => (
          <span className="font-medium text-ardoise-900">{i.nom}</span>
        ) },
        { cle: 'destination', libelle: 'Destination', rendu: (i) => i.destination },
        {
          cle: 'jalons',
          libelle: 'Jalons',
          rendu: (i) => (
            <span className="text-xs text-ardoise-500">{i.jalons.join(' → ') || '—'}</span>
          ),
          masquerMobile: true,
        },
        {
          cle: 'modele',
          libelle: 'Modèle d’étapes',
          rendu: (i) =>
            portefeuille.modeles.find((m) => m.id === i.modele_etapes_id)?.nom ?? '—',
          masquerMobile: true,
        },
      ]}
      champs={() => [
        { cle: 'nom', libelle: 'Nom de l’itinéraire', type: 'texte', obligatoire: true },
        { cle: 'origine', libelle: 'Origine', type: 'texte', obligatoire: true },
        { cle: 'destination', libelle: 'Destination', type: 'texte', obligatoire: true },
        { cle: 'corridor', libelle: 'Corridor', type: 'texte', obligatoire: true },
        {
          cle: 'point_chargement_id',
          libelle: 'Point de chargement',
          type: 'liste',
          options: portefeuille.pointsChargement.map((p) => ({
            valeur: p.id,
            libelle: p.nom,
          })),
        },
        {
          cle: 'modele_etapes_id',
          libelle: 'Modèle d’étapes',
          type: 'liste',
          options: portefeuille.modeles.map((m) => ({ valeur: m.id, libelle: m.nom })),
        },
        {
          cle: 'jalons',
          libelle: 'Jalons',
          type: 'texte',
          pleineLargeur: true,
          aide: 'Points de contrôle séparés par des virgules, dans l’ordre du trajet. Ex. : Kasumbalesa, Péage Lubumbashi, Likasi',
        },
        { cle: 'distance_km', libelle: 'Distance', type: 'nombre', unite: 'km' },
        { cle: 'duree_estimee_h', libelle: 'Durée estimée', type: 'nombre', unite: 'h' },
        { cle: 'actif', libelle: 'Itinéraire actif', type: 'booleen' },
      ]}
      valeursInitiales={(i) => ({
        nom: i?.nom ?? '',
        origine: i?.origine ?? 'Zambie',
        destination: i?.destination ?? '',
        corridor: i?.corridor ?? '',
        point_chargement_id: i?.point_chargement_id ?? '',
        modele_etapes_id:
          i?.modele_etapes_id ?? portefeuille.modeles.find((m) => m.par_defaut)?.id ?? '',
        jalons: i?.jalons.join(', ') ?? '',
        distance_km: i?.distance_km?.toString() ?? '',
        duree_estimee_h: i?.duree_estimee_h?.toString() ?? '',
        actif: i?.actif ?? true,
      })}
      onEnregistrer={async (v, element) => {
        const ligne = {
          organisation_id: profil.organisation_id,
          nom: texte(v.nom),
          origine: texte(v.origine),
          destination: texte(v.destination),
          corridor: texte(v.corridor),
          point_chargement_id: texteOuNull(v.point_chargement_id),
          modele_etapes_id: texteOuNull(v.modele_etapes_id),
          jalons: versListe(v.jalons),
          distance_km: nombreOuNull(v.distance_km),
          duree_estimee_h: nombreOuNull(v.duree_estimee_h),
          actif: v.actif === true,
        }
        if (element) await modifier('itineraires', element.id, ligne)
        else await creer('itineraires', ligne)
        toast.succes(element ? 'Itinéraire mis à jour.' : 'Itinéraire créé.')
        await portefeuille.recharger()
      }}
      onSupprimer={async (i) => {
        await supprimer('itineraires', i.id)
        toast.succes('Itinéraire supprimé.')
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

const ROLES = [
  { valeur: 'ADMIN', libelle: 'Administrateur' },
  { valeur: 'OPS', libelle: 'Opérations' },
  { valeur: 'TERRAIN', libelle: 'Agent terrain' },
  { valeur: 'FINANCE', libelle: 'Finance' },
  { valeur: 'CLIENT', libelle: 'Client' },
]

export function SectionUtilisateurs({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { profil } = useSession()
  const toast = useToast()

  return (
    <CrudRessource<Utilisateur>
      titre="Utilisateurs"
      description="Comptes et rôles. Le rôle détermine les actions autorisées : seul un profil habilité valide une étape."
      libelleCreation="Nouvel utilisateur"
      elements={portefeuille.utilisateurs}
      rechercheDans={(u) => `${u.nom} ${u.email ?? ''} ${u.role}`}
      libelleElement={(u) => u.nom}
      colonnes={[
        { cle: 'nom', libelle: 'Nom', rendu: (u) => (
          <span className="font-medium text-ardoise-900">{u.nom}</span>
        ) },
        {
          cle: 'role',
          libelle: 'Rôle',
          rendu: (u) => ROLES.find((r) => r.valeur === u.role)?.libelle ?? u.role,
        },
        { cle: 'email', libelle: 'E-mail', rendu: (u) => u.email ?? '—', masquerMobile: true },
        {
          cle: 'client',
          libelle: 'Client rattaché',
          rendu: (u) =>
            portefeuille.clients.find((c) => c.id === u.client_id)?.raison_sociale ?? '—',
          masquerMobile: true,
        },
      ]}
      champs={() => [
        { cle: 'nom', libelle: 'Nom complet', type: 'texte', obligatoire: true },
        { cle: 'role', libelle: 'Rôle', type: 'liste', obligatoire: true, options: ROLES },
        { cle: 'email', libelle: 'E-mail', type: 'texte' },
        { cle: 'telephone', libelle: 'Téléphone', type: 'tel' },
        {
          cle: 'client_id',
          libelle: 'Client rattaché',
          type: 'liste',
          options: portefeuille.clients.map((c) => ({
            valeur: c.id,
            libelle: c.raison_sociale,
          })),
          aide: 'À renseigner uniquement pour un compte de rôle Client.',
          pleineLargeur: true,
        },
      ]}
      valeursInitiales={(u) => ({
        nom: u?.nom ?? '',
        role: u?.role ?? 'TERRAIN',
        email: u?.email ?? '',
        telephone: u?.telephone ?? '',
        client_id: u?.client_id ?? '',
      })}
      valider={(v: ValeursFormulaire) => {
        const erreurs: string[] = []
        if (v.role === 'CLIENT' && !texte(v.client_id)) {
          erreurs.push('Un compte de rôle Client doit être rattaché à un client.')
        }
        if (v.role !== 'CLIENT' && texte(v.client_id)) {
          erreurs.push('Seul un compte de rôle Client peut être rattaché à un client.')
        }
        return erreurs
      }}
      onEnregistrer={async (v, element) => {
        const ligne = {
          organisation_id: profil.organisation_id,
          nom: texte(v.nom),
          role: texte(v.role),
          email: texteOuNull(v.email),
          telephone: texteOuNull(v.telephone),
          client_id: texteOuNull(v.client_id),
        }
        if (element) await modifier('utilisateurs', element.id, ligne)
        else await creer('utilisateurs', ligne)
        toast.succes(element ? 'Utilisateur mis à jour.' : 'Utilisateur créé.')
        await portefeuille.recharger()
      }}
      onSupprimer={async (u) => {
        await supprimer('utilisateurs', u.id)
        toast.succes('Utilisateur supprimé.')
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Organisations                                                       */
/* ------------------------------------------------------------------ */

export function SectionOrganisations({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const toast = useToast()

  return (
    <CrudRessource<Organisation>
      titre="Organisations"
      description="Chaque organisation est un espace cloisonné : ses données ne sont jamais visibles par une autre."
      libelleCreation="Nouvelle organisation"
      elements={portefeuille.organisations}
      rechercheDans={(o) => o.nom}
      libelleElement={(o) => o.nom}
      colonnes={[
        { cle: 'nom', libelle: 'Nom', rendu: (o) => (
          <span className="font-medium text-ardoise-900">{o.nom}</span>
        ) },
        { cle: 'plan', libelle: 'Plan', rendu: (o) => o.plan },
        { cle: 'fuseau', libelle: 'Fuseau', rendu: (o) => o.fuseau, masquerMobile: true },
        { cle: 'statut', libelle: 'Statut', rendu: (o) => o.statut, masquerMobile: true },
      ]}
      champs={() => [
        { cle: 'nom', libelle: 'Nom', type: 'texte', obligatoire: true },
        {
          cle: 'plan',
          libelle: 'Plan',
          type: 'liste',
          obligatoire: true,
          options: [
            { valeur: 'PILOTE', libelle: 'Pilote' },
            { valeur: 'STANDARD', libelle: 'Standard' },
            { valeur: 'ENTREPRISE', libelle: 'Entreprise' },
          ],
        },
        {
          cle: 'langue',
          libelle: 'Langue',
          type: 'liste',
          options: [
            { valeur: 'fr', libelle: 'Français' },
            { valeur: 'en', libelle: 'Anglais' },
          ],
        },
        { cle: 'fuseau', libelle: 'Fuseau horaire', type: 'texte', obligatoire: true },
      ]}
      valeursInitiales={(o) => ({
        nom: o?.nom ?? '',
        plan: o?.plan ?? 'PILOTE',
        langue: o?.langue ?? 'fr',
        fuseau: o?.fuseau ?? 'Africa/Lubumbashi',
      })}
      onEnregistrer={async (v, element) => {
        const ligne = {
          nom: texte(v.nom),
          plan: texte(v.plan),
          langue: texte(v.langue),
          fuseau: texte(v.fuseau),
        }
        if (element) await modifier('organisations', element.id, ligne)
        else await creer('organisations', ligne)
        toast.succes(element ? 'Organisation mise à jour.' : 'Organisation créée.')
        await portefeuille.recharger()
      }}
    />
  )
}
