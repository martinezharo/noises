import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from 'vite-plugin-pwa'

// The brown noise sample is ~5.5 MB, so the precache budget has to be raised
// well above Workbox's 2 MiB default for the app to work fully offline.
const MAX_PRECACHE_BYTES = 12 * 1024 * 1024

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done from src/registerServiceWorker.js so it can be
      // skipped inside the Capacitor shell.
      injectRegister: null,
      // Vite's `base` stays relative for the Capacitor build, but the service
      // worker and the manifest have to be rooted at the origin to install.
      base: '/',
      buildBase: '/',
      manifest: {
        id: '/',
        name: 'Noises',
        short_name: 'Noises',
        description: 'Brown & white noise player',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['health', 'lifestyle', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app, audio included: there is nothing to fetch at
        // runtime, so once installed it is fully offline.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest,wav,mp3}'],
        maximumFileSizeToCacheInBytes: MAX_PRECACHE_BYTES,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  base: './',
  build: {
    target: ['chrome61', 'safari12'],
    cssTarget: ['chrome61', 'safari12'],
  },
})
