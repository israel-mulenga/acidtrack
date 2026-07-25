import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // « prompt » et non « autoUpdate » : un agent qui remplit un
      // formulaire au poste frontière ne doit jamais voir sa page se
      // recharger sous ses doigts. La mise à jour est proposée, pas subie.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AcidTrack — suivi du corridor',
        short_name: 'AcidTrack',
        description:
          'Suivi des livraisons d’acide sulfurique du corridor Zambie → RDC, étape par étape.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#101828',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Fond plein et sujet dans la zone sûre : utilisable en masqué
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Mes tâches', short_name: 'Tâches', url: '/taches' },
          { name: 'Tour de contrôle', short_name: 'Contrôle', url: '/controle' },
        ],
      },
      workbox: {
        // Coquille applicative préchargée : l'application s'ouvre même
        // sans réseau, ce qui arrive sur la route entre Ndola et Kolwezi.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Lectures Supabase : le réseau d'abord, le cache en secours.
            // Les données affichées hors ligne sont donc les dernières
            // connues — l'interface le signale explicitement.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'donnees-supabase',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Pièces jointes déjà consultées : inutile de les retélécharger.
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'documents',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: {
        // Permet de tester l'installation sans passer par un build
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
