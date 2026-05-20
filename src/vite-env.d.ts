/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versão npm do pacote (semver) — ping `versao_player` / webservice. */
  readonly VITE_PACKAGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
