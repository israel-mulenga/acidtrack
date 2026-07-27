/**
 * Notifications Web Push — gestion de l'abonnement côté client.
 *
 * L'utilisateur active les notifications depuis le menu compte : on demande
 * la permission, on s'abonne au `PushManager` avec la clé publique VAPID,
 * puis on enregistre l'abonnement dans `push_subscriptions`. L'Edge Function
 * `envoyer-push` s'appuie sur cette table pour joindre tous les appareils
 * de l'organisation (cf. supabase/06_notifications.sql).
 */

import { supabase } from './supabase'

/** Vrai si le navigateur sait recevoir des notifications push. */
export function pushEstSupporte(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** État courant de la permission de notification du navigateur. */
export function permissionNotification(): NotificationPermission | 'indisponible' {
  if (!pushEstSupporte()) return 'indisponible'
  return Notification.permission
}

/**
 * La clé VAPID est transmise à `subscribe` sous forme d'Uint8Array.
 * Conversion depuis la représentation base64url exposée par
 * `import.meta.env.VITE_VAPID_PUBLIC_KEY`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const donnees = atob(base64)
  const tableau = new Uint8Array(new ArrayBuffer(donnees.length))
  for (let i = 0; i < donnees.length; i += 1) {
    tableau[i] = donnees.charCodeAt(i)
  }
  return tableau
}

async function registrationSW(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready
}

/**
 * Active les notifications pour le compte connecté : demande la permission,
 * s'abonne au PushManager et enregistre (upsert) l'abonnement.
 * Renvoie `true` si l'abonnement est effectif.
 */
export async function activerNotifications(
  organisationId: string,
  authId: string,
  utilisateurId: string,
): Promise<boolean> {
  if (!pushEstSupporte()) {
    throw new Error('Les notifications push ne sont pas prises en charge par ce navigateur.')
  }

  const cleVapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!cleVapid) {
    throw new Error(
      'Clé VAPID absente : renseignez VITE_VAPID_PUBLIC_KEY dans .env.local (voir README).',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await registrationSW()

  // Réutilise l'abonnement existant s'il y en a un, sinon en crée un.
  const abonnement =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cleVapid),
    }))

  const brut = abonnement.toJSON()
  const p256dh = brut.keys?.p256dh
  const auth = brut.keys?.auth
  if (!brut.endpoint || !p256dh || !auth) {
    throw new Error('Abonnement push incomplet.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      organisation_id: organisationId,
      auth_id: authId,
      utilisateur_id: utilisateurId,
      endpoint: brut.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error

  return true
}

/** Désactive les notifications : désabonnement navigateur + suppression de la ligne. */
export async function desactiverNotifications(): Promise<void> {
  if (!pushEstSupporte()) return
  const registration = await registrationSW()
  const abonnement = await registration.pushManager.getSubscription()
  if (!abonnement) return

  await supabase.from('push_subscriptions').delete().eq('endpoint', abonnement.endpoint)
  await abonnement.unsubscribe()
}

/** Vrai si un abonnement push est déjà actif dans ce navigateur. */
export async function estAbonne(): Promise<boolean> {
  if (!pushEstSupporte()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return false
  return (await registration.pushManager.getSubscription()) !== null
}
