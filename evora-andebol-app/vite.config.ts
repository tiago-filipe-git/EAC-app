import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'web-app-manifest-192x192.png',
        'web-app-manifest-512x512.png',
      ],
      manifest: {
        name: 'Évora Andebol Clube',
        short_name: 'Évora Andebol',
        description: 'Gestão de multas e assiduidade do Évora Andebol Clube',
        theme_color: '#08080a',
        background_color: '#08080a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'pt-PT',
        icons: [
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            // O chat usa streaming (SSE). Nunca deve ser cacheado nem bufferizado
            // pelo service worker, senão a resposta deixa de chegar token a token.
            urlPattern: /\/api\/chat(\?.*)?$/i,
            handler: 'NetworkOnly',
          },
          {
            // Cache das chamadas de API — network-first (para dados sempre frescos)
            // Aceita tanto o proxy local (/api/*) como o backend em produção (*.onrender.com)
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') ||
              url.hostname.endsWith('.onrender.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // PWA funciona também em dev
      },
    }),
  ],
  server: {
    host: '0.0.0.0', // ← Acede de outros dispositivos na rede
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})