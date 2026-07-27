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
      // Service worker personnalisé (src/sw.ts) : il conserve le
      // préchargement Workbox et le runtime caching ci-dessous, et ajoute
      // la réception des notifications Web Push (handlers 'push' /
      // 'notificationclick').
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
      injectManifest: {
        // Coquille applicative préchargée : l'application s'ouvre même
        // sans réseau, ce qui arrive sur la route entre Ndola et Kolwezi.
        // Le runtime caching (Supabase, Storage) est désormais implémenté
        // dans src/sw.ts.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
