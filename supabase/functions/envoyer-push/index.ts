// =====================================================================
// AcidTrack — Edge Function « envoyer-push »
// Envoie une notification Web Push à tous les abonnements d'une
// organisation lorsqu'une ligne `notifications` est créée.
//
// Invocation : appelée par le trigger `fn_declencher_push` (pg_net) ou par
// un Database Webhook sur INSERT de `notifications`. Le corps de la requête
// contient soit `{ "notification_id": "<uuid>" }` (trigger pg_net), soit la
// charge d'un Database Webhook `{ "type": "INSERT", "record": { ... } }`.
//
// Secrets requis (supabase secrets set) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// Fournis automatiquement par la plateforme :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

interface LigneNotification {
  id: string
  organisation_id: string
  titre: string
  corps: string
  table_source: string
  operation: string
  record_id: string | null
  payload: Record<string, unknown>
}

interface Abonnement {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@acidtrack.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (requete) => {
  if (requete.method !== 'POST') {
    return reponse({ erreur: 'Méthode non autorisée' }, 405)
  }

  let corpsRequete: Record<string, unknown>
  try {
    corpsRequete = await requete.json()
  } catch {
    return reponse({ erreur: 'Corps JSON invalide' }, 400)
  }

  // Deux formes d'invocation possibles.
  const notificationId =
    (corpsRequete.notification_id as string | undefined) ??
    ((corpsRequete.record as { id?: string } | undefined)?.id)

  if (!notificationId) {
    return reponse({ erreur: 'notification_id manquant' }, 400)
  }

  const { data: notification, error: erreurNotif } = await admin
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single<LigneNotification>()

  if (erreurNotif || !notification) {
    return reponse({ erreur: 'Notification introuvable', details: erreurNotif?.message }, 404)
  }

  const { data: abonnements, error: erreurAbos } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('organisation_id', notification.organisation_id)

  if (erreurAbos) {
    return reponse({ erreur: 'Lecture des abonnements impossible', details: erreurAbos.message }, 500)
  }

  const chargeUtile = JSON.stringify({
    titre: notification.titre,
    corps: notification.corps,
    url: '/',
    table_source: notification.table_source,
    operation: notification.operation,
    record_id: notification.record_id,
  })

  let envoyes = 0
  const perimes: string[] = []

  await Promise.all(
    ((abonnements ?? []) as Abonnement[]).map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          chargeUtile,
        )
        envoyes += 1
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode
        // 404/410 : l'abonnement n'existe plus côté service push -> purge.
        if (statut === 404 || statut === 410) {
          perimes.push(abo.id)
        } else {
          console.error('Échec envoi Web Push', abo.endpoint, e)
        }
      }
    }),
  )

  if (perimes.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', perimes)
  }

  return reponse({ envoyes, purges: perimes.length })
})
