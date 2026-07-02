import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Alvo do proxy de dev (`/api`). Deve bater com produção (HTTPS) em `src/api/config.ts`.
const WEBSERVICE_URL = 'https://cloud.radioibiza.com.br';

const __dirname = dirname(fileURLToPath(import.meta.url));

type PkgJson = {
  version: string;
  ibizaShellVersion?: string;
  ibizaShellVersionMobile?: string;
};

const pkg: PkgJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

/**
 * Versão do shell servida no Netlify (`/version.json`) — só para atualizar UI/cache do PWA.
 * Não entra no ping ao CakePHP (isso usa `pkg.version`).
 */
const IBIZA_SHELL_VERSION =
  typeof pkg.ibizaShellVersion === 'string' && pkg.ibizaShellVersion.trim().length > 0
    ? pkg.ibizaShellVersion.trim()
    : pkg.version;

const IBIZA_SHELL_VERSION_MOBILE =
  typeof pkg.ibizaShellVersionMobile === 'string' && pkg.ibizaShellVersionMobile.trim().length > 0
    ? pkg.ibizaShellVersionMobile.trim()
    : IBIZA_SHELL_VERSION;

function emitVersionJsonPlugin(shellVersion: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'emit-version-json',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const outPath = resolve(__dirname, outDir, 'version.json');
      writeFileSync(
        outPath,
        `${JSON.stringify({ version: shellVersion, versionMobile: IBIZA_SHELL_VERSION_MOBILE, ibizaTarget: TARGET })}\n`,
        'utf8',
      );
      if (TARGET !== 'WEB') {
        writeFileSync(resolve(__dirname, outDir, 'ibiza-build-target.txt'), `${TARGET}\n`, 'utf8');
      }
      /**
       * `public/instalar.html` é copiada sem passar pelo Vite — aqui injetamos
       * `ibizaShellVersion` para conferência em produção (`<meta>` + `INSTALAR_PAGE_REV`)
       * e para cache-bust nos links `/instalar.html?v=…` do app.
       */
      const instalarPath = resolve(__dirname, outDir, 'instalar.html');
      if (existsSync(instalarPath)) {
        const html = readFileSync(instalarPath, 'utf8').replaceAll(
          '__IBIZA_INSTALL_BUILD__',
          shellVersion,
        );
        writeFileSync(instalarPath, html, 'utf8');
      }
      const instalarMPath = resolve(__dirname, outDir, 'm', 'instalar.html');
      if (existsSync(instalarMPath)) {
        const htmlM = readFileSync(instalarMPath, 'utf8').replaceAll(
          '__IBIZA_INSTALL_BUILD__',
          IBIZA_SHELL_VERSION_MOBILE,
        );
        writeFileSync(instalarMPath, htmlM, 'utf8');
      }
    },
  };
}

/**
 * Quando o build é para target Electron (W/M/A/I) em vez de WEB, desligamos
 * o `vite-plugin-pwa`: o `.exe` / `.dmg` empacotado já vive offline-first
 * por natureza, não precisa de Service Worker. Bônus: contorna um bug
 * conhecido em versões antigas do `vite-plugin-pwa` + terser ao gerar o SW com sourcemap.
 */
const TARGET = (process.env.VITE_IBIZA_TARGET ?? 'WEB').toUpperCase();
const PWA_ATIVO = TARGET === 'WEB';
/** Electron empacotado (`file://`): assets relativos — senão ecrã preto no pacote loja. */
const VITE_BASE = PWA_ATIVO ? '/' : './';

export default defineConfig({
  base: VITE_BASE,
  define: {
    /** Sem `VITE_IBIZA_SHELL_VERSION` aqui — a UI lê `ibizaShellVersion` via import do `package.json` em `src/api/config.ts`. */
    'import.meta.env.VITE_PACKAGE_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    emitVersionJsonPlugin(IBIZA_SHELL_VERSION),
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
        /** Nome curto usado no Menu Iniciar / lista de Inicialização do Windows — deve ser fácil de achar. */
        short_name: 'Radio Ibiza',
        description: 'Player de música ambiente — Radio Ibiza',
        lang: 'pt-BR',
        scope: '/',
        theme_color: '#08080a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        categories: ['music', 'entertainment'],
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
        /** `instalar.html` muda com frequência; fora do precache evita SW servir guia antigo. */
        globIgnores: ['**/node_modules/**', '**/instalar.html', '**/m/instalar.html'],
        navigateFallback: '/index.html',
        /**
         * Sem isto, qualquer navegação cai no shell React — `/instalador-desktop/` deixava de mostrar o HTML estático.
         */
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/\.netlify\/functions\//,
          /^\/instalador-desktop/,
          /^\/ws-get_musica_cloud/,
          /^\/instalar\.html/,
          /^\/instalar$/,
          /^\/m\/instalar\.html/,
          /^\/m\/instalar$/,
          /^\/installmobile/,
          /^\/install\//,
          /^\/instalar-exe-indisponivel/,
        ],
        /**
         * Guia de instalação: sempre rede — o SW não deve guardar HTML antigo do guia.
         */
        runtimeCaching: [
          {
            urlPattern: ({ url }) => {
              const p = url.pathname;
              return (
                p === '/instalar.html' ||
                p === '/instalar' ||
                p === '/m/instalar.html' ||
                p === '/m/instalar' ||
                p === '/installmobile' ||
                p.startsWith('/install/')
              );
            },
            handler: 'NetworkOnly',
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        /** Novo deploy assume controlo mais depressa — menos utilizadores presos a bundle antigo. */
        skipWaiting: true,
        clientsClaim: true,
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
      /** Com `netlify dev`, as functions ficam em :8888; sem servidor local as chamadas falham em silêncio (player). */
      '/.netlify/functions': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    /**
     * Manter `false`: em builds antigos, sourcemap + Workbox/terser no SW gerava
     * «Unexpected early exit»; no Netlify os `.map` públicos já são 404 por política.
     */
    sourcemap: false,
  },
});
