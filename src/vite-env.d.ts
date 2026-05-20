/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versão npm do pacote (semver) — ping `versao_player` / webservice. */
  readonly VITE_PACKAGE_VERSION: string;
  /** Só dev: `1` força shell/layout touch (ecrã cheio) — ver `npm run dev:shell-mobile`. */
  readonly VITE_IBIZA_DEV_FORCE_TOUCH_SHELL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
