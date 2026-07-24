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

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  Camion,
  Client,
  Commande,
  Document,
  EtapeEvenement,
  EtapeReferentiel,
  Incident,
  Lot,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Portefeuille global                                                 */
/* ------------------------------------------------------------------ */

export interface Portefeuille {
  referentiel: EtapeReferentiel[]
  clients: Client[]
  commandes: Commande[]
  lots: Lot[]
  camions: Camion[]
  incidentsOuverts: Incident[]
  evenementsAValider: EtapeEvenement[]
}

const PORTEFEUILLE_VIDE: Portefeuille = {
  referentiel: [],
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
      const [referentiel, clients, commandes, lots, camions, incidents, aValider] =
        await Promise.all([
          supabase.from('etapes_referentiel').select('*').order('numero'),
          supabase.from('clients').select('*').order('raison_sociale'),
          supabase.from('commandes').select('*').order('created_at', { ascending: false }),
          supabase.from('lots').select('*').order('reference'),
          supabase.from('camions').select('*').order('reference'),
          supabase.from('incidents').select('*').eq('statut', 'OUVERT').order('created_at', { ascending: false }),
          supabase
            .from('etape_evenements')
            .select('*')
            .eq('statut', 'EN_ATTENTE_VALIDATION')
            .order('created_at', { ascending: false }),
        ])

      const premiereErreur = [referentiel, clients, commandes, lots, camions, incidents, aValider]
        .map((r) => r.error)
        .find(Boolean)

      if (premiereErreur) throw premiereErreur

      setDonnees({
        referentiel: (referentiel.data ?? []) as EtapeReferentiel[],
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
          ? "Les tables sont introuvables. Exécutez supabase/01_schema.sql puis 02_seed.sql dans l'éditeur SQL de Supabase."
          : message,
      )
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
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

  return { ...donnees, chargement, erreur, recharger: charger }
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
    setChargement(true)
    void charger()
  }, [charger])

  return { ...dossier, chargement, recharger: charger }
}
