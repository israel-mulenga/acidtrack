/// <reference lib="webworker" />

/**
 * Service worker personnalisé (stratégie injectManifest).
 *
 * Il reprend le comportement précédemment généré par Workbox
 * (précache de la coquille + runtime caching Supabase / Storage) et lui
 * ajoute la réception des notifications Web Push, afin que l'organisation
 * soit prévenue de toute opération CRUD même application fermée.
 */

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// Injecté par vite-plugin-pwa (injectManifest) : liste des ressources
// préchargées de la coquille applicative.
precacheAndRoute(self.__WB_MANIFEST)

// Repli de navigation : l'application s'ouvre hors ligne sur index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Lectures Supabase : le réseau d'abord, le cache en secours. Les données
// affichées hors ligne sont donc les dernières connues.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/rest/v1/'),
  new NetworkFirst({
    cacheName: 'donnees-supabase',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
)

// Pièces jointes déjà consultées : inutile de les retélécharger.
registerRoute(
  ({ url }) => url.pathname.includes('/storage/v1/object/'),
  new CacheFirst({
    cacheName: 'documents',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
)

/* ------------------------------------------------------------------ */
/* Notifications Web Push                                              */
/* ------------------------------------------------------------------ */

interface ChargePush {
  titre?: string
  corps?: string
  url?: string
}

self.addEventListener('push', (evenement: PushEvent) => {
  let charge: ChargePush
  try {
    charge = (evenement.data?.json() as ChargePush) ?? {}
  } catch {
    charge = { corps: evenement.data?.text() }
  }

  const titre = charge.titre ?? 'AcidTrack'
  const url = charge.url ?? '/'

  evenement.waitUntil(
    self.registration.showNotification(titre, {
      body: charge.corps ?? '',
      data: { url },
      icon: '/icone-192.png',
      badge: '/icone-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (evenement: NotificationEvent) => {
  evenement.notification.close()
  const url = (evenement.notification.data as { url?: string } | undefined)?.url ?? '/'

  evenement.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((fenetres) => {
        for (const fenetre of fenetres) {
          if ('focus' in fenetre) {
            void fenetre.focus()
            if ('navigate' in fenetre) void (fenetre as WindowClient).navigate(url)
            return
          }
        }
        return self.clients.openWindow(url)
      }),
  )
})

// Active immédiatement le nouveau SW lorsque l'application le demande
// (bandeau « Mettre à jour » de src/components/PWA.tsx).
self.addEventListener('message', (evenement: ExtendableMessageEvent) => {
  if (evenement.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
