/**
 * Implementação do Storage usando filesystem nativo do Electron.
 *
 * Usado pela versão **multiusuário Windows**. Salva tudo em
 * `C:\ProgramData\RadioIbizaPlayer\` que é compartilhado entre todos os
 * usuários Windows do mesmo PC.
 *
 * IMPORTANTE: este arquivo NÃO é importado diretamente pelo bundle do PWA.
 * Ele depende de APIs Node.js (`fs`, `path`) que só existem em Electron.
 *
 * A comunicação com o filesystem real acontece via IPC (preload script):
 * - O processo de RENDER (esse código aqui) chama `window.electronAPI.storage.*`
 * - O processo MAIN (electron/main.ts) recebe via IPC e executa o I/O
 *
 * Por que assim? Em Electron moderno, a UI roda com `nodeIntegration: false`
 * por segurança. Não dá pra fazer `require('fs')` direto na UI.
 *
 * STATUS: ponte IPC implementada (`electron/preload.mjs`, `electron/storage-handlers.mjs`).
 * Empacotamento/installer: Etapa 3B.5.
 */

import type {
  SessaoLocal,
  ConfigsLocal,
  ExecucaoPendente,
  MusicaCacheada,
} from '../types/webservice';
import { type Storage, SESSAO_INICIAL, CONFIGS_INICIAL } from './Storage';

/**
 * Tipo da API exposta pelo preload do Electron.
 * Esse objeto fica em `window.electronAPI` quando rodando em Electron.
 *
 * Veja `electron/preload.mjs` — implementação da Etapa 3B.
 */
export interface ElectronAPI {
  /** UUID estável por máquina (ProgramData) — multiusuário Windows. */
  getMachineDeviceId: () => string;
  /** Caminhos no disco (diagnóstico modo TI). */
  getStorageDiag?: () => {
    storageRoot: string;
    sessaoPath: string;
    sessaoExists: boolean;
    sessaoHasToken: boolean;
    chromiumUserData: string;
    appData: string;
    isPackaged: boolean;
  };
  storage: {
    // Operações sobre arquivo único de JSON (sessao.json, configs.json)
    readJson<T>(file: string): Promise<T | null>;
    writeJson<T>(file: string, data: T): Promise<void>;
    /** Gravação atómica no main (modo TI — login em ProgramData). */
    patchJson<T>(file: string, patch: Partial<T>): { ok: boolean; data?: T; error?: string };
    /** Linha de diagnóstico em storage-audit.log (modo TI). */
    logEvent?(msg: string): void;

    // Operações sobre o "diretório" de execuções pendentes
    // (cada uma é um arquivo .json em pending-executions/)
    listExecucoes(): Promise<ExecucaoPendente[]>;
    addExecucao(exec: ExecucaoPendente): Promise<number>; // retorna id gerado
    updateExecucao(id: number, patch: Partial<ExecucaoPendente>): Promise<void>;
    removeExecucao(id: number): Promise<void>;
    clearExecucoes(): Promise<void>;

    // Operações sobre arquivos de áudio em audio/
    saveAudio(musica_id: number, data: ArrayBuffer): Promise<void>;
    audioExists(musica_id: number): Promise<boolean>;
    /** Retorna o path absoluto do arquivo (será convertido pra file:// na URL) */
    getAudioPath(musica_id: number): Promise<string | null>;
    removeAudio(musica_id: number): Promise<void>;
    clearAllAudio(): Promise<void>;

    // Metadados das músicas baixadas (musicas-index.json)
    listMusicas(): Promise<MusicaCacheada[]>;
    upsertMusica(m: MusicaCacheada): Promise<void>;
    removeMusicaIndex(musica_id: number): Promise<void>;
    clearMusicasIndex(): Promise<void>;
  };
}

// Type augmentation para o globalThis.window
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const SESSAO_FILE = 'sessao.json';
const CONFIGS_FILE = 'configs.json';

export class FileSystemStorage implements Storage {
  private get api(): ElectronAPI {
    if (!window.electronAPI) {
      throw new Error(
        'FileSystemStorage requer Electron. window.electronAPI não está disponível.',
      );
    }
    return window.electronAPI;
  }

  // ----- Sessão -----

  async getSessao(): Promise<SessaoLocal> {
    const data = await this.readJsonWithRetry<SessaoLocal>(SESSAO_FILE);
    /**
     * Não gravar SESSAO_INICIAL quando readJson devolve null (ficheiro em escrita
     * noutra instância .exe) — apagava o token partilhado em ProgramData.
     */
    if (!data) {
      return SESSAO_INICIAL;
    }
    return { ...SESSAO_INICIAL, ...data, id: 1 };
  }

  async updateSessao(patch: Partial<SessaoLocal>): Promise<void> {
    const res = this.api.storage.patchJson<SessaoLocal>(SESSAO_FILE, patch);
    if (res?.ok) return;
    const atual = await this.readJsonWithRetry<SessaoLocal>(SESSAO_FILE);
    await this.api.storage.writeJson(SESSAO_FILE, { ...(atual ?? SESSAO_INICIAL), ...patch, id: 1 });
  }

  async limparSessao(): Promise<void> {
    await this.api.storage.writeJson(SESSAO_FILE, SESSAO_INICIAL);
    await this.api.storage.clearExecucoes();
    await this.api.storage.clearMusicasIndex();
    // Áudio em si é limpo separadamente via limparTodosAudios()
  }

  /** Releituras curtas — outra instância .exe TI pode estar a gravar sessao.json. */
  private async readJsonWithRetry<T>(file: string, attempts = 8): Promise<T | null> {
    for (let i = 0; i < attempts; i++) {
      const data = await this.api.storage.readJson<T>(file);
      if (data) return data;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 40 * (i + 1)));
      }
    }
    return null;
  }

  // ----- Configurações -----

  async getConfigs(): Promise<ConfigsLocal> {
    const data = await this.readJsonWithRetry<ConfigsLocal>(CONFIGS_FILE);
    if (!data) {
      return CONFIGS_INICIAL;
    }
    return { ...CONFIGS_INICIAL, ...data, id: 1 };
  }

  async updateConfigs(patch: Partial<ConfigsLocal>): Promise<void> {
    const atual = await this.getConfigs();
    await this.api.storage.writeJson(CONFIGS_FILE, { ...atual, ...patch, id: 1 });
  }

  // ----- Execuções pendentes -----

  async enfileirarExecucao(
    exec: Omit<ExecucaoPendente, 'id' | 'tentativas'>,
  ): Promise<void> {
    await this.api.storage.addExecucao({ ...exec, tentativas: 0 });
  }

  async listarExecucoesPendentes(limit = 50): Promise<ExecucaoPendente[]> {
    const lista = await this.api.storage.listExecucoes();
    return lista.slice(0, limit);
  }

  async removerExecucao(id: number): Promise<void> {
    await this.api.storage.removeExecucao(id);
  }

  async incrementarTentativaExecucao(id: number): Promise<void> {
    const lista = await this.api.storage.listExecucoes();
    const e = lista.find((x) => x.id === id);
    if (e) await this.api.storage.updateExecucao(id, { tentativas: e.tentativas + 1 });
  }

  // ----- Metadados de música -----

  async registrarMusicaCacheada(m: MusicaCacheada): Promise<void> {
    await this.api.storage.upsertMusica(m);
  }

  async isMusicaCacheada(musica_id: number): Promise<boolean> {
    return this.api.storage.audioExists(musica_id);
  }

  async listarMusicasCacheadas(): Promise<MusicaCacheada[]> {
    return this.api.storage.listMusicas();
  }

  async removerMusicaCacheada(musica_id: number): Promise<void> {
    await this.api.storage.removeMusicaIndex(musica_id);
  }

  // ----- Áudio binário -----

  async salvarAudio(musica_id: number, audio: Blob): Promise<void> {
    const buffer = await audio.arrayBuffer();
    await this.api.storage.saveAudio(musica_id, buffer);
  }

  async obterAudioUrl(musica_id: number): Promise<string | null> {
    const path = await this.api.storage.getAudioPath(musica_id);
    if (!path) return null;
    // O Electron permite usar `file://` URLs diretamente em <audio>.
    // Normalização Windows → POSIX-ish para a URL.
    return `file:///${path.replace(/\\/g, '/')}`;
  }

  async removerAudio(musica_id: number): Promise<void> {
    await this.api.storage.removeAudio(musica_id);
  }

  async limparTodosAudios(): Promise<void> {
    await this.api.storage.clearAllAudio();
  }
}
