/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versão npm do pacote (semver) — ping `versao_player` / webservice. */
  readonly VITE_PACKAGE_VERSION: string;
  /** Só dev: `1` força shell/layout touch (ecrã cheio) — ver `npm run dev:shell-mobile`. */
  readonly VITE_IBIZA_DEV_FORCE_TOUCH_SHELL?: string;
  /** HTTPS origin apenas ( Worker / Nginx público ): mesmo path/query get_musica que o cloud — ver `docs/MP3_PREFETCH_FORA_NETLIFY.md`. */
  readonly VITE_IBIZA_MP3_CORS_BRIDGE_ORIGIN?: string;
  /** Quando infra expõe CORS no próprio GET get_musica do cloud/proxy antes do CakePHP — `1` prefetch directo primeiro. */
  readonly VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST?: string;
  /** Pré-prod: `1` omite `/ws-get_musica_cloud` no prefetch e no retry de `play()` — ver `prefetchGetMusicaNetlifyFallbackDesligadoNaBuild`. */
  readonly VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK?: string;
  /** Só uso interno: com rede debug ligado — logs de prefetch com query `get_musica` incluindo token (nunca em produção pública sem confiança total). */
  readonly VITE_IBIZA_DIAG_PREFETCH_TOKEN_COMPLETO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
