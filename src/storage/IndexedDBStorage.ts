/**
 * Implementação do Storage usando IndexedDB (via Dexie) + Cache Storage API.
 *
 * Usado pelo PWA. Tudo fica no perfil do navegador do usuário Windows logado.
 *
 * Estrutura:
 * - IndexedDB: metadados (sessão, configs, fila de execuções, índice de músicas)
 * - Cache Storage: blobs de áudio (chave = ID da música)
 *
 * Cache Storage foi escolhido em vez de Blob no IndexedDB porque:
 * - Service Worker pode interceptar `fetch()` e servir do cache transparentemente
 * - Browsers têm cotas mais generosas pra Cache Storage
 * - O <audio> tag pode usar a URL do cache direto (com Service Worker no meio)
 *
 * Para apps sem Service Worker (durante dev) usamos URL.createObjectURL como fallback.
 */

import Dexie, { type Table } from 'dexie';
import type {
  SessaoLocal,
  ConfigsLocal,
  ExecucaoPendente,
  MusicaCacheada,
} from '../types/webservice';
import { type Storage, SESSAO_INICIAL, CONFIGS_INICIAL } from './Storage';

const AUDIO_CACHE_NAME = 'radio-ibiza-audio-v1';

class RadioIbizaDB extends Dexie {
  sessao!: Table<SessaoLocal, number>;
  configs!: Table<ConfigsLocal, number>;
  execucoes!: Table<ExecucaoPendente, number>;
  musicas!: Table<MusicaCacheada, number>;

  constructor() {
    super('radio_ibiza_player');
    this.version(1).stores({
      sessao: 'id',
      configs: 'id',
      execucoes: '++id, playlists_musica_id, tentativas',
      musicas: 'musica_id, playlist_id, baixada_em',
    });
  }
}

export class IndexedDBStorage implements Storage {
  private db = new RadioIbizaDB();

  // Map em memória de ObjectURLs criadas — pra poder revogar depois
  // (evita vazamento de memória de URL.createObjectURL)
  private objectUrls = new Map<number, string>();

  // ----- Sessão -----

  async getSessao(): Promise<SessaoLocal> {
    const s = await this.db.sessao.get(1);
    if (!s) {
      await this.db.sessao.put(SESSAO_INICIAL);
      return SESSAO_INICIAL;
    }
    return s;
  }

  async updateSessao(patch: Partial<SessaoLocal>): Promise<void> {
    const atual = await this.getSessao();
    await this.db.sessao.put({ ...atual, ...patch, id: 1 });
  }

  async limparSessao(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.sessao, this.db.musicas, this.db.execucoes],
      async () => {
        await this.db.sessao.put(SESSAO_INICIAL);
        await this.db.musicas.clear();
        await this.db.execucoes.clear();
      },
    );
  }

  // ----- Configurações -----

  async getConfigs(): Promise<ConfigsLocal> {
    const c = await this.db.configs.get(1);
    if (!c) {
      await this.db.configs.put(CONFIGS_INICIAL);
      return CONFIGS_INICIAL;
    }
    return c;
  }

  async updateConfigs(patch: Partial<ConfigsLocal>): Promise<void> {
    const atual = await this.getConfigs();
    await this.db.configs.put({ ...atual, ...patch, id: 1 });
  }

  // ----- Execuções pendentes -----

  async enfileirarExecucao(
    exec: Omit<ExecucaoPendente, 'id' | 'tentativas'>,
  ): Promise<void> {
    await this.db.execucoes.add({ ...exec, tentativas: 0 });
  }

  async listarExecucoesPendentes(limit = 50): Promise<ExecucaoPendente[]> {
    return this.db.execucoes.orderBy('id').limit(limit).toArray();
  }

  async removerExecucao(id: number): Promise<void> {
    await this.db.execucoes.delete(id);
  }

  async incrementarTentativaExecucao(id: number): Promise<void> {
    const e = await this.db.execucoes.get(id);
    if (e) await this.db.execucoes.update(id, { tentativas: e.tentativas + 1 });
  }

  // ----- Metadados de música -----

  async registrarMusicaCacheada(m: MusicaCacheada): Promise<void> {
    await this.db.musicas.put(m);
  }

  async isMusicaCacheada(musica_id: number): Promise<boolean> {
    return (await this.db.musicas.get(musica_id)) != null;
  }

  async listarMusicasCacheadas(): Promise<MusicaCacheada[]> {
    return this.db.musicas.toArray();
  }

  async removerMusicaCacheada(musica_id: number): Promise<void> {
    await this.db.musicas.delete(musica_id);
  }

  // ----- Áudio binário (Cache Storage) -----

  /** Chave usada no Cache Storage. Inventamos um path "virtual". */
  private cacheKey(musica_id: number): string {
    return `https://radio-ibiza.local/audio/${musica_id}.mp3`;
  }

  async salvarAudio(musica_id: number, audio: Blob): Promise<void> {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.size),
      },
    });
    await cache.put(this.cacheKey(musica_id), response);
  }

  async obterAudioUrl(musica_id: number): Promise<string | null> {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = await cache.match(this.cacheKey(musica_id));
    if (!response) return null;

    // Revoga URL anterior dessa música (se houver) pra não vazar memória
    const anterior = this.objectUrls.get(musica_id);
    if (anterior) URL.revokeObjectURL(anterior);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(musica_id, url);
    return url;
  }

  async removerAudio(musica_id: number): Promise<void> {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.delete(this.cacheKey(musica_id));

    const url = this.objectUrls.get(musica_id);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(musica_id);
    }
  }

  async limparTodosAudios(): Promise<void> {
    await caches.delete(AUDIO_CACHE_NAME);

    // Revoga todas as ObjectURLs ativas
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
  }
}
