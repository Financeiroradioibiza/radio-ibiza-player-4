/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versão npm do pacote (semver) — ping `versao_player` / webservice. */
  readonly VITE_PACKAGE_VERSION: string;
  /** Shell do PWA no Netlify (`ibizaShellVersion`); só `/version.json` e auto-update de UI. */
  readonly VITE_IBIZA_SHELL_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
