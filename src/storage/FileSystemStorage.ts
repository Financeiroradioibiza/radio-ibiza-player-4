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
  storage: {
    // Operações sobre arquivo único de JSON (sessao.json, configs.json)
    readJson<T>(file: string): Promise<T | null>;
    writeJson<T>(file: string, data: T): Promise<void>;

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
    const data = await this.api.storage.readJson<SessaoLocal>(SESSAO_FILE);
    if (!data) {
      await this.api.storage.writeJson(SESSAO_FILE, SESSAO_INICIAL);
      return SESSAO_INICIAL;
    }
    return { ...SESSAO_INICIAL, ...data, id: 1 };
  }

  async updateSessao(patch: Partial<SessaoLocal>): Promise<void> {
    const atual = await this.getSessao();
    await this.api.storage.writeJson(SESSAO_FILE, { ...atual, ...patch, id: 1 });
  }

  async limparSessao(): Promise<void> {
    await this.api.storage.writeJson(SESSAO_FILE, SESSAO_INICIAL);
    await this.api.storage.clearExecucoes();
    await this.api.storage.clearMusicasIndex();
    // Áudio em si é limpo separadamente via limparTodosAudios()
  }

  // ----- Configurações -----

  async getConfigs(): Promise<ConfigsLocal> {
    const data = await this.api.storage.readJson<ConfigsLocal>(CONFIGS_FILE);
    if (!data) {
      await this.api.storage.writeJson(CONFIGS_FILE, CONFIGS_INICIAL);
      return CONFIGS_INICIAL;
    }
    return data;
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
