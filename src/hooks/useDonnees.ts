/**
 * Accès aux données Supabase.
 *
 * Deux hooks seulement :
 *  - `usePortefeuille` : tout le contexte de navigation (lots, camions, ...),
 *    rafraîchi en temps réel. Le volume du MVP (quelques dizaines de camions)
 *    rend un chargement global plus rapide et plus simple qu'une pagination.
 *  - `useDossierCamion` : le détail d'un camion (événements, documents,
 *    incidents), chargé à l'ouverture de la fiche.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { estEnRetard } from '@/lib/workflow'
import type {
  Camion,
  Client,
  Commande,
  Document,
  EtapeEvenement,
  EtapeReferentiel,
  Incident,
  Itineraire,
  Lot,
  ModeleEtapes,
  Organisation,
  PointChargement,
  Utilisateur,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Portefeuille global                                                 */
/* ------------------------------------------------------------------ */

export interface Portefeuille {
  /** Étapes du modèle par défaut — repli quand un lot n'en précise aucun. */
  referentiel: EtapeReferentiel[]
  /** Toutes les étapes, indexées par modèle. */
  etapesParModele: Record<string, EtapeReferentiel[]>
  modeles: ModeleEtapes[]
  itineraires: Itineraire[]
  pointsChargement: PointChargement[]
  organisations: Organisation[]
  utilisateurs: Utilisateur[]
  clients: Client[]
  commandes: Commande[]
  lots: Lot[]
  camions: Camion[]
  incidentsOuverts: Incident[]
  evenementsAValider: EtapeEvenement[]
}

const PORTEFEUILLE_VIDE: Portefeuille = {
  referentiel: [],
  etapesParModele: {},
  modeles: [],
  itineraires: [],
  pointsChargement: [],
  organisations: [],
  utilisateurs: [],
  clients: [],
  commandes: [],
  lots: [],
  camions: [],
  incidentsOuverts: [],
  evenementsAValider: [],
}

export function usePortefeuille() {
  const [donnees, setDonnees] = useState<Portefeuille>(PORTEFEUILLE_VIDE)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const reponses = await Promise.all([
        supabase.from('modeles_etapes').select('*').order('nom'),
        supabase.from('modeles_etapes_lignes').select('*').order('numero'),
        supabase.from('itineraires').select('*').order('nom'),
        supabase.from('points_chargement').select('*').order('nom'),
        supabase.from('organisations').select('*').order('nom'),
        supabase.from('utilisateurs').select('*').order('nom'),
        supabase.from('clients').select('*').order('raison_sociale'),
        supabase.from('commandes').select('*').order('created_at', { ascending: false }),
        supabase.from('lots').select('*').order('reference'),
        supabase.from('camions').select('*').order('reference'),
        supabase
          .from('incidents')
          .select('*')
          .eq('statut', 'OUVERT')
          .order('created_at', { ascending: false }),
        supabase
          .from('etape_evenements')
          .select('*')
          .eq('statut', 'EN_ATTENTE_VALIDATION')
          .order('created_at', { ascending: false }),
      ])

      const premiereErreur = reponses.map((r) => r.error).find(Boolean)
      if (premiereErreur) throw premiereErreur

      const [
        modeles,
        lignes,
        itineraires,
        pointsChargement,
        organisations,
        utilisateurs,
        clients,
        commandes,
        lots,
        camions,
        incidents,
        aValider,
      ] = reponses

      // Indexation des étapes par modèle
      const etapesParModele: Record<string, EtapeReferentiel[]> = {}
      for (const ligne of (lignes.data ?? []) as EtapeReferentiel[]) {
        ;(etapesParModele[ligne.modele_id] ??= []).push(ligne)
      }
      for (const liste of Object.values(etapesParModele)) {
        liste.sort((a, b) => a.numero - b.numero)
      }

      const listeModeles = (modeles.data ?? []) as ModeleEtapes[]
      const modeleParDefaut = listeModeles.find((m) => m.par_defaut) ?? listeModeles[0]

      setDonnees({
        referentiel: modeleParDefaut ? (etapesParModele[modeleParDefaut.id] ?? []) : [],
        etapesParModele,
        modeles: listeModeles,
        itineraires: (itineraires.data ?? []) as Itineraire[],
        pointsChargement: (pointsChargement.data ?? []) as PointChargement[],
        organisations: (organisations.data ?? []) as Organisation[],
        utilisateurs: (utilisateurs.data ?? []) as Utilisateur[],
        clients: (clients.data ?? []) as Client[],
        commandes: (commandes.data ?? []) as Commande[],
        lots: (lots.data ?? []) as Lot[],
        camions: (camions.data ?? []) as Camion[],
        incidentsOuverts: (incidents.data ?? []) as Incident[],
        evenementsAValider: (aValider.data ?? []) as EtapeEvenement[],
      })
      setErreur(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErreur(
        message.includes('does not exist') || message.includes('schema cache')
          ? 'Tables introuvables. Exécutez, dans l’éditeur SQL de Supabase : ' +
            '01_schema.sql, puis 02_seed.sql, puis 03_crud.sql.'
          : message,
      )
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    // Chargement initial puis abonnement : l'effet synchronise bien React
    // avec un système externe (Supabase). `charger` est asynchrone, aucun
    // setState n'a lieu pendant le rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()

    // Temps réel : le portail client et la tour de contrôle se mettent à jour
    // dès qu'un agent terrain valide une étape depuis son téléphone.
    const canal = supabase
      .channel('portefeuille')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camions' }, () => void charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etape_evenements' }, () => void charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => void charger())
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [charger])

  /**
   * Étapes applicables à un lot : celles de son modèle, à défaut celles du
   * modèle porté par son itinéraire, à défaut le modèle par défaut.
   */
  const etapesDuLot = useCallback(
    (lot: Lot | undefined): EtapeReferentiel[] => {
      if (!lot) return donnees.referentiel
      const itineraire = donnees.itineraires.find((i) => i.id === lot.itineraire_id)
      const modeleId = lot.modele_etapes_id ?? itineraire?.modele_etapes_id
      return (modeleId && donnees.etapesParModele[modeleId]) || donnees.referentiel
    },
    [donnees.referentiel, donnees.itineraires, donnees.etapesParModele],
  )

  /** Jalons réellement empruntés par le lot (masquage AC-06). */
  const jalonsDuLot = useCallback(
    (lot: Lot | undefined): string[] => {
      if (!lot) return []
      return donnees.itineraires.find((i) => i.id === lot.itineraire_id)?.jalons ?? []
    },
    [donnees.itineraires],
  )

  /** Étapes applicables à un camion, via son lot. */
  const etapesDuCamion = useCallback(
    (camion: Camion): EtapeReferentiel[] =>
      etapesDuLot(donnees.lots.find((l) => l.id === camion.lot_id)),
    [etapesDuLot, donnees.lots],
  )

  /** Retard SLA évalué avec le modèle d'étapes propre au camion. */
  const camionEnRetard = useCallback(
    (camion: Camion): boolean => estEnRetard(camion, etapesDuCamion(camion)),
    [etapesDuCamion],
  )

  /** Camions bloqués ou en retard — alimente la pastille de navigation. */
  const nbExceptions = donnees.camions.filter(
    (c) => c.statut === 'BLOQUE' || camionEnRetard(c),
  ).length

  return {
    ...donnees,
    chargement,
    erreur,
    recharger: charger,
    etapesDuLot,
    etapesDuCamion,
    jalonsDuLot,
    camionEnRetard,
    nbExceptions,
  }
}

/** Portefeuille + état de chargement, tel que consommé par les écrans. */
export type PortefeuilleComplet = ReturnType<typeof usePortefeuille>

/* ------------------------------------------------------------------ */
/* Notifications temps réel (complément aux notifications push)        */
/* ------------------------------------------------------------------ */

export interface NotificationRealtime {
  id: string
  organisation_id: string
  titre: string
  corps: string
  table_source: string
  operation: string
}

/**
 * Écoute les insertions de `notifications` (Realtime) et invoque `surNouvelle`
 * pour chacune. Sert à afficher un toast in-app aux utilisateurs qui ont
 * l'application ouverte, en complément des notifications push (application
 * fermée). La RLS restreint déjà le flux à l'organisation du compte connecté.
 */
export function useNotificationsRealtime(
  surNouvelle: (notification: NotificationRealtime) => void,
) {
  const rappel = useRef(surNouvelle)

  useEffect(() => {
    rappel.current = surNouvelle
  }, [surNouvelle])

  useEffect(() => {
    const canal = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (charge) => rappel.current(charge.new as NotificationRealtime),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [])
}

/* ------------------------------------------------------------------ */
/* Dossier d'un camion                                                 */
/* ------------------------------------------------------------------ */

export interface DossierCamion {
  evenements: EtapeEvenement[]
  documents: Document[]
  incidents: Incident[]
}

export function useDossierCamion(camionId: string | undefined) {
  const [dossier, setDossier] = useState<DossierCamion>({
    evenements: [],
    documents: [],
    incidents: [],
  })
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    if (!camionId) return
    const [evenements, documents, incidents] = await Promise.all([
      supabase
        .from('etape_evenements')
        .select('*')
        .eq('camion_id', camionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('documents')
        .select('*')
        .eq('camion_id', camionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('incidents')
        .select('*')
        .eq('camion_id', camionId)
        .order('created_at', { ascending: false }),
    ])

    setDossier({
      evenements: (evenements.data ?? []) as EtapeEvenement[],
      documents: (documents.data ?? []) as Document[],
      incidents: (incidents.data ?? []) as Incident[],
    })
    setChargement(false)
  }, [camionId])

  useEffect(() => {
    // Rechargement à chaque changement de camion : même justification que
    // pour le portefeuille, l'effet suit une dépendance externe (l'URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChargement(true)
    void charger()
  }, [charger])

  return { ...dossier, chargement, recharger: charger }
}
