import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// Alvo do proxy de dev (`/api`). Deve bater com produção (HTTPS) em `src/api/config.ts`.
const WEBSERVICE_URL = 'https://cloud.radioibiza.com.br';

/**
 * Quando o build é para target Electron (W/M/A/I) em vez de WEB, desligamos
 * o `vite-plugin-pwa`: o `.exe` / `.dmg` empacotado já vive offline-first
 * por natureza, não precisa de Service Worker. Bônus: contorna um bug
 * conhecido do `vite-plugin-pwa@0.20` + terser que dispara
 * «Unexpected early exit» na escrita do SW quando há sourcemap.
 */
const TARGET = (process.env.VITE_IBIZA_TARGET ?? 'WEB').toUpperCase();
const PWA_ATIVO = TARGET === 'WEB';

export default defineConfig({
  plugins: [
    react(),
    ...(PWA_ATIVO
      ? [VitePWA({
      /** Em dev, não registar SW — evita cache antigo que impede rotas novas (ex.: /sandbox/player-layouts). */
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png',
      ],
      manifest: {
        name: 'Player Radio Ibiza',
        short_name: 'Player Ibiza',
        description: 'Player de música ambiente — Radio Ibiza',
        lang: 'pt-BR',
        theme_color: '#08080a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        /**
         * Só pré-cacheia o shell do app (bundles + HTML + ícones). MP3 não entra —
         * áudio usa outro nome de cache (`radio-ibiza-audio-v1`), populado pela app.
         * O SW do Workbox não deve apagar esse cache nem substituir as URLs falsas `radio-ibiza.local`.
         */
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        /**
         * Sem isto, qualquer navegação cai no shell React — `/instalador-desktop/` deixava de mostrar o HTML estático.
         */
        navigateFallbackDenylist: [/^\/api\//, /^\/instalador-desktop/, /^\/ws-get_musica_cloud/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    })]
      : []),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // Em dev, redireciona /api/* pro webservice de produção, contornando CORS.
      // Em produção, o app faz fetch direto pra URL configurada (precisamos
      // resolver CORS de outra forma: configurar no servidor, ou Cloudflare Worker).
      '/api': {
        target: WEBSERVICE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/services/webservice'),
      },
      '/ws-get_musica_cloud': {
        target: WEBSERVICE_URL,
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/ws-get_musica_cloud/, '/services/webservice/get_musica'),
      },
    },
  },

  build: {
    outDir: 'dist',
    /**
     * Mantemos a geração porque o vite-plugin-pwa quebra com `false` e com
     * `'hidden'` (terser entra em «Unexpected early exit» ao escrever o SW).
     * O acesso público aos `.map` é bloqueado pelo Netlify — ver `netlify.toml`
     * (regra que retorna 404 para `/assets/*.map`).
     *
     * Resultado: localmente o time tem sourcemap (`npm run build && vite preview`);
     * em produção o operador / atacante apanha sempre 404 ao tentar baixar.
     */
    sourcemap: true,
  },
});
