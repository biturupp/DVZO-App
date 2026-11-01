import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const commit = (process.env.COMMIT_REF ?? '').slice(0, 7) || 'lokal';
const built = new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`${built} · ${commit}`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DVZO-App',
        short_name: 'DVZO',
        description: 'Fahrgastzählung, Fahrpläne und Dienstpläne für den Oldtimerbetrieb DVZO',
        lang: 'de-CH',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#eef3ef',
        theme_color: '#1d6b50',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            // Kartenkacheln für unterwegs zwischenspeichern (Funklöcher auf der Strecke)
            urlPattern: /^https:\/\/wmts\.geo\.admin\.ch\//,
            handler: 'CacheFirst',
            options: { cacheName: 'karten', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
