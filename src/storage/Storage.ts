/**
 * Camada de Storage abstrata.
 *
 * O resto da aplicação NUNCA acessa IndexedDB ou filesystem diretamente —
 * tudo passa por essa interface. Isso permite ter:
 *
 * - PWA: implementação via IndexedDB + Cache Storage (`IndexedDBStorage`)
 * - Electron: implementação via filesystem em C:\ProgramData\ (`FileSystemStorage`)
 *
 * No build, a fábrica `createStorage()` escolhe qual usar baseado no ambiente.
 *
 * REGRA DE OURO: se aparecer dependência do Dexie ou do `fs` fora desta pasta,
 * é bug. Só os adaptadores podem conhecer detalhes da implementação.
 */

import type {
  SessaoLocal,
  ConfigsLocal,
  ExecucaoPendente,
  MusicaCacheada,
} from '../types/webservice';

/**
 * Contrato que toda implementação de Storage deve cumprir.
 * Operações são todas async — implementações síncronas viram async trivialmente.
 */
export interface Storage {
  // ----- Sessão (registro único — token, PDV ativo, etc.) -----
  getSessao(): Promise<SessaoLocal>;
  updateSessao(patch: Partial<SessaoLocal>): Promise<void>;
  limparSessao(): Promise<void>;

  // ----- Configurações do usuário (auto-restart, etc.) -----
  getConfigs(): Promise<ConfigsLocal>;
  updateConfigs(patch: Partial<ConfigsLocal>): Promise<void>;

  // ----- Fila de execuções pendentes (analytics offline) -----
  enfileirarExecucao(exec: Omit<ExecucaoPendente, 'id' | 'tentativas'>): Promise<void>;
  listarExecucoesPendentes(limit?: number): Promise<ExecucaoPendente[]>;
  removerExecucao(id: number): Promise<void>;
  incrementarTentativaExecucao(id: number): Promise<void>;

  // ----- Metadados de músicas baixadas -----
  registrarMusicaCacheada(m: MusicaCacheada): Promise<void>;
  isMusicaCacheada(musica_id: number): Promise<boolean>;
  listarMusicasCacheadas(): Promise<MusicaCacheada[]>;
  removerMusicaCacheada(musica_id: number): Promise<void>;

  // ----- Áudio binário (cache do MP3) -----
  // Aqui o "como" muda muito entre PWA e Electron, então a interface é
  // mínima: você dá um id e um Blob, ou pede de volta como URL pra <audio>.
  salvarAudio(musica_id: number, audio: Blob): Promise<void>;
  /** Retorna URL utilizável em <audio src="..."> ou null se não estiver cacheado */
  obterAudioUrl(musica_id: number): Promise<string | null>;
  removerAudio(musica_id: number): Promise<void>;
  /** Remove TODOS os áudios — usar no logout */
  limparTodosAudios(): Promise<void>;
}

/**
 * Estado inicial do registro único de sessão.
 * Equivale ao registro padrão da tabela `playlists` (rowid=1) do AS3.
 */
export const SESSAO_INICIAL: SessaoLocal = {
  id: 1,
  token: null,
  cliente_id: null,
  cliente: null,
  pdv: null,
  playlists_data: null,
  agendas_data: null,
  ping_times: 0,
  last_update: null,
  primeiro_acesso: true,
  install_device_id: null,
  install_serial: null,
  programacao_pendente_playlist: null,
  programacao_pendente_agendas: null,
};

export const CONFIGS_INICIAL: ConfigsLocal = {
  id: 1,
  restart_player: false,
  time_restart_player: '',
};
