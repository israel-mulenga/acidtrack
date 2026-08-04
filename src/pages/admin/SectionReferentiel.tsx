/**
 * Référentiel : clients, points de chargement, itinéraires, comptes.
 * Chaque ressource se déclare en colonnes + champs ; la mécanique de
 * création, d'édition et de suppression vient de `CrudRessource`.
 */

import { useTranslation } from 'react-i18next'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { useSession, useUtilisateur } from '@/session'
import { creer, modifier, supprimer } from '@/lib/crud'
import type {
  Client,
  Itineraire,
  Organisation,
  PointChargement,
  Utilisateur,
} from '@/lib/types'
import { inviterUtilisateur } from '@/lib/auth'
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
  const profil = useUtilisateur()
  const toast = useToast()
  const { t } = useTranslation(['common', 'workflow'])

  return (
    <CrudRessource<Client>
      titre={t('adminReferentiel.clientsTitle')}
      description={t('adminReferentiel.clientsDescription')}
      libelleCreation={t('adminReferentiel.createClient')}
      elements={portefeuille.clients}
      rechercheDans={(c) => `${c.raison_sociale} ${c.mine ?? ''} ${c.ville ?? ''}`}
      libelleElement={(c) => c.raison_sociale}
      colonnes={[
        { cle: 'nom', libelle: t('adminReferentiel.name'), rendu: (c) => (
          <span className="font-medium text-ardoise-900">{c.raison_sociale}</span>
        ) },
        { cle: 'mine', libelle: t('adminReferentiel.mine'), rendu: (c) => c.mine ?? '—', masquerMobile: true },
        { cle: 'ville', libelle: t('adminReferentiel.city'), rendu: (c) => c.ville ?? '—', masquerMobile: true },
        {
          cle: 'contact',
          libelle: t('adminReferentiel.contact'),
          rendu: (c) => c.contact_nom ?? '—',
          masquerMobile: true,
        },
        {
          cle: 'actif',
          libelle: t('adminReferentiel.state'),
          rendu: (c) =>
            c.actif ? (
              <span className="text-emerald-600">{t('adminReferentiel.active')}</span>
            ) : (
              <span className="text-ardoise-400">{t('adminReferentiel.inactive')}</span>
            ),
        },
      ]}
      champs={() => [
        { cle: 'raison_sociale', libelle: t('adminReferentiel.companyName'), type: 'texte', obligatoire: true },
        { cle: 'mine', libelle: t('adminReferentiel.mine'), type: 'texte' },
        { cle: 'ville', libelle: t('adminReferentiel.city'), type: 'texte' },
        { cle: 'contact_nom', libelle: t('adminReferentiel.contact'), type: 'texte' },
        { cle: 'contact_tel', libelle: t('adminReferentiel.phone'), type: 'tel' },
        { cle: 'actif', libelle: t('adminReferentiel.clientActive'), type: 'booleen' },
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
        toast.succes(element ? t('adminReferentiel.clientUpdated') : t('adminReferentiel.clientCreated'))
        await portefeuille.recharger()
      }}
      onSupprimer={async (c) => {
        await supprimer('clients', c.id)
        toast.succes(t('adminReferentiel.clientDeleted'))
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
  const profil = useUtilisateur()
  const toast = useToast()
  const { t } = useTranslation(['common', 'workflow'])

  return (
    <CrudRessource<PointChargement>
      titre={t('adminReferentiel.pointsTitle')}
      description={t('adminReferentiel.pointsDescription')}
      libelleCreation={t('adminReferentiel.createPoint')}
      elements={portefeuille.pointsChargement}
      rechercheDans={(p) => `${p.nom} ${p.ville ?? ''} ${p.pays}`}
      libelleElement={(p) => p.nom}
      colonnes={[
        { cle: 'nom', libelle: t('adminReferentiel.name'), rendu: (p) => (
          <span className="font-medium text-ardoise-900">{p.nom}</span>
        ) },
        { cle: 'ville', libelle: t('adminReferentiel.city'), rendu: (p) => p.ville ?? '—' },
        { cle: 'pays', libelle: t('adminReferentiel.country'), rendu: (p) => p.pays, masquerMobile: true },
        {
          cle: 'contact',
          libelle: t('adminReferentiel.contact'),
          rendu: (p) => p.contact_nom ?? '—',
          masquerMobile: true,
        },
      ]}
      champs={() => [
        { cle: 'nom', libelle: t('adminReferentiel.pointName'), type: 'texte', obligatoire: true },
        { cle: 'ville', libelle: t('adminReferentiel.city'), type: 'texte' },
        { cle: 'pays', libelle: t('adminReferentiel.country'), type: 'texte', obligatoire: true },
        { cle: 'contact_nom', libelle: t('adminReferentiel.contact'), type: 'texte' },
        { cle: 'contact_tel', libelle: t('adminReferentiel.phone'), type: 'tel' },
        { cle: 'actif', libelle: t('adminReferentiel.active'), type: 'booleen' },
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
        toast.succes(element ? t('adminReferentiel.pointUpdated') : t('adminReferentiel.pointCreated'))
        await portefeuille.recharger()
      }}
      onSupprimer={async (p) => {
        await supprimer('points_chargement', p.id)
        toast.succes(t('adminReferentiel.pointDeleted'))
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Itinéraires                                                         */
/* ------------------------------------------------------------------ */

export function SectionItineraires({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const profil = useUtilisateur()
  const toast = useToast()
  const { t } = useTranslation(['common', 'workflow'])

  return (
    <CrudRessource<Itineraire>
      titre={t('adminReferentiel.itinerariesTitle')}
      description={t('adminReferentiel.itinerariesDescription')}
      libelleCreation={t('adminReferentiel.createItinerary')}
      elements={portefeuille.itineraires}
      rechercheDans={(i) => `${i.nom} ${i.destination} ${i.corridor}`}
      libelleElement={(i) => i.nom}
      colonnes={[
        { cle: 'nom', libelle: t('adminReferentiel.itinerary'), rendu: (i) => (
          <span className="font-medium text-ardoise-900">{i.nom}</span>
        ) },
        { cle: 'destination', libelle: t('adminReferentiel.destination'), rendu: (i) => i.destination },
        {
          cle: 'jalons',
          libelle: t('adminReferentiel.jalons'),
          rendu: (i) => (
            <span className="text-xs text-ardoise-500">{i.jalons.join(' → ') || '—'}</span>
          ),
          masquerMobile: true,
        },
        {
          cle: 'modele',
          libelle: t('adminReferentiel.stepModel'),
          rendu: (i) =>
            portefeuille.modeles.find((m) => m.id === i.modele_etapes_id)?.nom ?? '—',
          masquerMobile: true,
        },
      ]}
      champs={() => [
        { cle: 'nom', libelle: t('adminReferentiel.itineraryName'), type: 'texte', obligatoire: true },
        { cle: 'origine', libelle: t('adminReferentiel.origin'), type: 'texte', obligatoire: true },
        { cle: 'destination', libelle: t('adminReferentiel.destination'), type: 'texte', obligatoire: true },
        { cle: 'corridor', libelle: t('adminReferentiel.corridor'), type: 'texte', obligatoire: true },
        {
          cle: 'point_chargement_id',
          libelle: t('adminReferentiel.loadingPoint'),
          type: 'liste',
          options: portefeuille.pointsChargement.map((p) => ({
            valeur: p.id,
            libelle: p.nom,
          })),
        },
        {
          cle: 'modele_etapes_id',
          libelle: t('adminReferentiel.stepModel'),
          type: 'liste',
          options: portefeuille.modeles.map((m) => ({ valeur: m.id, libelle: m.nom })),
        },
        {
          cle: 'jalons',
          libelle: 'Jalons',
          type: 'texte',
          pleineLargeur: true,
          aide: t('adminReferentiel.routeJalonsHelp'),
        },
        { cle: 'distance_km', libelle: t('adminReferentiel.distance'), type: 'nombre', unite: 'km' },
        { cle: 'duree_estimee_h', libelle: t('adminReferentiel.duration'), type: 'nombre', unite: 'h' },
        { cle: 'actif', libelle: t('adminReferentiel.itineraryActive'), type: 'booleen' },
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
        toast.succes(element ? t('adminReferentiel.itineraryUpdated') : t('adminReferentiel.itineraryCreated'))
        await portefeuille.recharger()
      }}
      onSupprimer={async (i) => {
        await supprimer('itineraires', i.id)
        toast.succes(t('adminReferentiel.itineraryDeleted'))
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

const ROLES = [
  { valeur: 'ADMIN' },
  { valeur: 'OPS' },
  { valeur: 'TERRAIN' },
  { valeur: 'FINANCE' },
  { valeur: 'CLIENT' },
]

const STATUTS_COMPTE = [
  { valeur: 'ACTIF', libelle: 'Actif' },
  { valeur: 'SUSPENDU', libelle: 'Suspendu' },
]

const LIBELLE_STATUT_COMPTE: Record<string, string> = {
  INVITE: 'Invitation en attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
}

export function SectionUtilisateurs({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const toast = useToast()
  const { t } = useTranslation(['common', 'workflow'])

  return (
    <CrudRessource<Utilisateur>
      titre={t('adminReferentiel.usersTitle')}
      description={t('adminReferentiel.usersDescription')}
      libelleCreation={t('adminReferentiel.createUser')}
      elements={portefeuille.utilisateurs}
      rechercheDans={(u) => `${u.nom} ${u.email ?? ''} ${u.role}`}
      libelleElement={(u) => u.nom}
      colonnes={[
        { cle: 'nom', libelle: t('adminReferentiel.name'), rendu: (u) => (
          <span className="font-medium text-ardoise-900">{u.nom}</span>
        ) },
        {
          cle: 'role',
          libelle: t('adminReferentiel.role'),
          rendu: (u) => {
            const role = ROLES.find((r) => r.valeur === u.role)
            return role ? t(`workflow:roles.${role.valeur}`) : u.role
          },
        },
        { cle: 'email', libelle: t('adminReferentiel.email'), rendu: (u) => u.email ?? '—', masquerMobile: true },
        {
          cle: 'client',
          libelle: t('adminReferentiel.client'),
          rendu: (u) =>
            portefeuille.clients.find((c) => c.id === u.client_id)?.raison_sociale ?? '—',
          masquerMobile: true,
        },
        {
          cle: 'statut',
          libelle: t('adminReferentiel.accountStatus'),
          rendu: (u) => (
            <span
              className={
                u.statut === 'ACTIF'
                  ? 'text-emerald-600'
                  : u.statut === 'SUSPENDU'
                    ? 'text-red-600'
                    : 'text-ambre-600'
              }
            >
              {LIBELLE_STATUT_COMPTE[u.statut] ?? u.statut}
            </span>
          ),
          masquerMobile: true,
        },
      ]}
      champs={(element) => [
        { cle: 'nom', libelle: t('adminReferentiel.fullName'), type: 'texte', obligatoire: true },
        { cle: 'role', libelle: t('adminReferentiel.role'), type: 'liste', obligatoire: true, options: ROLES.map((r) => ({ ...r, libelle: t(`workflow:roles.${r.valeur}`) })) },
        {
          cle: 'email',
          libelle: t('adminReferentiel.email'),
          type: 'texte',
          obligatoire: !element,
          lectureSeule: !!element,
          aide: !element ? t('adminReferentiel.userInvitationHelp') : undefined,
        },
        { cle: 'telephone', libelle: t('adminReferentiel.phone'), type: 'tel' },
        {
          cle: 'client_id',
          libelle: t('adminReferentiel.client'),
          type: 'liste',
          options: portefeuille.clients.map((c) => ({
            valeur: c.id,
            libelle: c.raison_sociale,
          })),
          aide: t('adminReferentiel.clientLinkHelp'),
          pleineLargeur: true,
        },
        ...(element && element.statut !== 'INVITE'
          ? [
              {
                cle: 'statut',
                libelle: t('adminReferentiel.accountStatus'),
                type: 'liste' as const,
                options: STATUTS_COMPTE,
                aide: t('adminReferentiel.accountStatusHelp'),
              },
            ]
          : []),
      ]}
      valeursInitiales={(u) => ({
        nom: u?.nom ?? '',
        role: u?.role ?? 'TERRAIN',
        email: u?.email ?? '',
        telephone: u?.telephone ?? '',
        client_id: u?.client_id ?? '',
        statut: u?.statut ?? 'ACTIF',
      })}
      valider={(v: ValeursFormulaire) => {
        const erreurs: string[] = []
        if (v.role === 'CLIENT' && !texte(v.client_id)) {
          erreurs.push(t('adminReferentiel.clientRoleRequired'))
        }
        if (v.role !== 'CLIENT' && texte(v.client_id)) {
          erreurs.push(t('adminReferentiel.clientRoleForbidden'))
        }
        return erreurs
      }}
      onEnregistrer={async (v, element) => {
        if (!element) {
          await inviterUtilisateur({
            email: texte(v.email),
            nom: texte(v.nom),
            role: texte(v.role) as Utilisateur['role'],
            clientId: texteOuNull(v.client_id),
          })
          toast.succes(t('adminReferentiel.userInvitationSuccess'))
        } else {
          await modifier('utilisateurs', element.id, {
            nom: texte(v.nom),
            role: texte(v.role),
            telephone: texteOuNull(v.telephone),
            client_id: texteOuNull(v.client_id),
            ...(element.statut !== 'INVITE' ? { statut: texte(v.statut) } : {}),
          })
          toast.succes(t('adminReferentiel.userUpdated'))
        }
        await portefeuille.recharger()
      }}
      onSupprimer={async (u) => {
        await supprimer('utilisateurs', u.id)
        toast.succes(t('adminReferentiel.userDeleted'))
        await portefeuille.recharger()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Organisations                                                       */
/* ------------------------------------------------------------------ */

export function SectionOrganisations({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const { profil } = useSession()
  const toast = useToast()
  const { t } = useTranslation(['common', 'workflow'])

  // Une organisation ne gère jamais que son propre profil : la création
  // d'une nouvelle organisation se fait exclusivement via la page
  // d'inscription (isolation des données, cf. supabase/04_auth_rls.sql).
  const laMienne = portefeuille.organisations.filter((o) => o.id === profil?.organisation_id)

  return (
    <CrudRessource<Organisation>
      titre={t('adminReferentiel.organisationsTitle')}
      description={t('adminReferentiel.organisationsDescription')}
      pasDeCreation
      elements={laMienne}
      rechercheDans={(o) => o.nom}
      libelleElement={(o) => o.nom}
      colonnes={[
        { cle: 'nom', libelle: t('adminReferentiel.name'), rendu: (o) => (
          <span className="font-medium text-ardoise-900">{o.nom}</span>
        ) },
        { cle: 'plan', libelle: t('adminReferentiel.plan'), rendu: (o) => o.plan },
        { cle: 'devise', libelle: t('adminReferentiel.currency'), rendu: (o) => o.devise, masquerMobile: true },
        { cle: 'fuseau', libelle: t('adminReferentiel.timezone'), rendu: (o) => o.fuseau, masquerMobile: true },
        {
          cle: 'statut',
          libelle: t('adminReferentiel.accountStatus'),
          rendu: (o) => (
            <span className={o.statut === 'ACTIF' ? 'text-emerald-600' : 'text-red-600'}>
              {o.statut === 'ACTIF' ? t('adminReferentiel.active') : t('adminReferentiel.inactive')}
            </span>
          ),
        },
      ]}
      champs={() => [
        { cle: 'nom', libelle: t('adminReferentiel.name'), type: 'texte', obligatoire: true },
        {
          cle: 'plan',
          libelle: t('adminReferentiel.plan'),
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
          libelle: t('adminReferentiel.language'),
          type: 'liste',
          options: [
            { valeur: 'fr', libelle: t('adminReferentiel.french') },
            { valeur: 'en', libelle: t('adminReferentiel.english') },
          ],
        },
        {
          cle: 'devise',
          libelle: t('adminReferentiel.currency'),
          type: 'liste',
          obligatoire: true,
          options: [
            { valeur: 'USD', libelle: 'Dollar (USD)' },
            { valeur: 'ZMW', libelle: 'Kwacha (ZMW)' },
            { valeur: 'CDF', libelle: 'Franc congolais (CDF)' },
          ],
        },
        { cle: 'fuseau', libelle: t('adminReferentiel.timezone'), type: 'texte', obligatoire: true },
        { cle: 'logo_url', libelle: t('adminReferentiel.logoUrl'), type: 'texte', pleineLargeur: true },
        {
          cle: 'statut',
          libelle: 'Statut',
          type: 'liste',
          obligatoire: true,
          options: [
            { valeur: 'ACTIF', libelle: 'Actif' },
            { valeur: 'SUSPENDU', libelle: 'Suspendu' },
          ],
        },
      ]}
      valeursInitiales={(o) => ({
        nom: o?.nom ?? '',
        plan: o?.plan ?? 'PILOTE',
        langue: o?.langue ?? 'fr',
        devise: o?.devise ?? 'USD',
        fuseau: o?.fuseau ?? 'Africa/Lubumbashi',
        logo_url: o?.logo_url ?? '',
        statut: o?.statut ?? 'ACTIF',
      })}
      onEnregistrer={async (v, element) => {
        if (!element) return
        await modifier('organisations', element.id, {
          nom: texte(v.nom),
          plan: texte(v.plan),
          langue: texte(v.langue),
          devise: texte(v.devise),
          fuseau: texte(v.fuseau),
          logo_url: texteOuNull(v.logo_url),
          statut: texte(v.statut),
        })
        toast.succes(t('adminReferentiel.organisationUpdated'))
        await portefeuille.recharger()
      }}
    />
  )
}
