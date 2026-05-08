/**
 * Store global da aplicação (Zustand).
 *
 * Mantém em memória o estado acessível por vários componentes:
 * sessão atual, status do player, mensagens de erro, etc.
 *
 * Persistência fica no `storage` abstrato — em PWA é IndexedDB,
 * em Electron é filesystem em C:\ProgramData\. O store não sabe disso.
 */

import { create } from 'zustand';
import type {
  Token,
  PdvData,
  ClienteData,
  PlaylistResponse,
  Agenda,
} from '../types/webservice';
import { storage } from '../storage';
import { getDeviceId, LIMITES } from '../api/config';
import { isCtrlPlayerEnabled } from '../utils/pdvPermissions';

// ============================================================================
// Tipos de estado
// ============================================================================

export type StatusPlayer =
  | 'inicializando'   // boot da aplicação
  | 'login'           // tela de login (sem token)
  | 'selecionar_pdv'  // tem cliente_id, falta escolher PDV
  | 'sincronizando'   // baixando playlists/músicas
  | 'tocando'         // operação normal
  | 'pausado'
  | 'desativado'      // PDV inativo no servidor ou ping bloqueado
  | 'erro';

interface AppState {
  // ----- Sessão -----
  status: StatusPlayer;
  token: Token | null;
  pdv: PdvData | null;
  cliente: ClienteData | null;
  cliente_id: number | null;

  // ----- Conteúdo -----
  playlistData: PlaylistResponse | null;
  agendas: Agenda[] | null;

  /** Cópia em RAM da `install_serial` persistida (reenviada no ping). */
  installSerial: string | null;

  /**
   * Pacote já baixado do servidor, a ser aplicado ao store na **próxima troca de faixa**
   * (não interrompe áudio). Ver `consumirProgramacaoPendente`.
   */
  programacaoPendente: { playlist: PlaylistResponse; agendas: Agenda[] } | null;
  /**
   * Evita o reset completo do loop quando `playlistData` muda por consumo de pendente
   * (mantém a faixa atual até o fim).
   */
  skipDestructivePlaylistReload: boolean;

  // ----- UI -----
  loading: boolean;
  errorMessage: string | null;

  // ----- Conectividade -----
  online: boolean;
  pingTimes: number; // pings consecutivos falhos
  pingBloqueado: boolean;

  // ----- Actions -----
  setStatus: (s: StatusPlayer) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string | null) => void;
  setOnline: (online: boolean) => void;
  setClienteId: (id: number | null) => void;

  hidratar: () => Promise<void>;
  salvarSessao: (data: {
    token: Token;
    pdv: PdvData;
    cliente: ClienteData;
    /** Chave gerada no painel para esta instalação — obrigatória na nova seleção de PDV. */
    installSerial: string;
  }) => Promise<void>;
  atualizarPdv: (pdv: PdvData) => Promise<void>;
  salvarPlaylist: (data: PlaylistResponse) => Promise<void>;
  salvarAgendas: (agendas: Agenda[]) => Promise<void>;
  logout: () => Promise<void>;
  incrementarPingFalho: () => Promise<void>;
  resetarPings: () => Promise<void>;
}

// ============================================================================
// Implementação
// ============================================================================

export const useAppStore = create<AppState>((set, get) => ({
  status: 'inicializando',
  token: null,
  pdv: null,
  cliente: null,
  cliente_id: null,
  playlistData: null,
  agendas: null,
  installSerial: null,
  programacaoPendente: null,
  skipDestructivePlaylistReload: false,
  loading: false,
  errorMessage: null,
  online: navigator.onLine,
  pingTimes: 0,
  pingBloqueado: false,

  setStatus: (status) => {
    const s = get();
    if (status === 'pausado' && !isCtrlPlayerEnabled(s.pdv)) return;
    set({ status });
  },
  setLoading: (loading) => set({ loading }),
  setError: (errorMessage) => set({ errorMessage }),
  setOnline: (online) => set({ online }),
  setClienteId: (cliente_id) => set({ cliente_id }),

  hidratar: async () => {
    let sessao = await storage.getSessao();

    const currentDevice = getDeviceId();
    const bound = sessao.install_device_id?.trim() || null;

    if (sessao.token?.token && bound && bound !== currentDevice) {
      await storage.limparSessao();
      set({
        status: 'login',
        token: null,
        pdv: null,
        cliente: null,
        cliente_id: null,
        playlistData: null,
        agendas: null,
        installSerial: null,
        programacaoPendente: null,
        skipDestructivePlaylistReload: false,
        pingTimes: 0,
        pingBloqueado: false,
        errorMessage:
          'Esta instalação já está ativa noutro aparelho ou os dados locais não pertencem a este computador. Entre de novo com a chave do painel ou use este player só na máquina onde foi instalado.',
      });
      return;
    }

    if (sessao.token?.token && !bound) {
      await storage.updateSessao({ install_device_id: currentDevice });
      sessao = { ...sessao, install_device_id: currentDevice };
    }

    set({
      token: sessao.token,
      pdv: sessao.pdv,
      cliente: sessao.cliente,
      cliente_id: sessao.cliente_id,
      playlistData: sessao.playlists_data,
      agendas: sessao.agendas_data,
      installSerial: sessao.install_serial?.trim() || null,
      programacaoPendente: null,
      skipDestructivePlaylistReload: false,
      pingTimes: sessao.ping_times,
      pingBloqueado: sessao.ping_times > LIMITES.LIMIT_TIMES_PING_OFF,
    });

    const pdvServidorInativo = sessao.pdv?.status === 'I';
    const pingExtravazado = sessao.ping_times > LIMITES.LIMIT_TIMES_PING_OFF;

    // Decide o status inicial baseado no que tem salvo
    if (!sessao.token) {
      set({ status: 'login' });
    } else if (!sessao.playlists_data) {
      // PDV inativo (cadastro) ou limite de pings: não finge «só sincronizar» — entra bloqueado como no painel.
      set({ status: pdvServidorInativo || pingExtravazado ? 'desativado' : 'sincronizando' });
    } else {
      // Padrão: pausado para alinhar com política de autoplay do browser (um toque em «Tocar»).
      // PDV com ctrl_player=N não pode ficar pausado pelo painel — mantém «tocando».
      let st: StatusPlayer = isCtrlPlayerEnabled(sessao.pdv) ? 'pausado' : 'tocando';
      if (pdvServidorInativo || pingExtravazado) st = 'desativado';
      set({ status: st });
    }
  },

  salvarSessao: async ({ token, pdv, cliente, installSerial }) => {
    const serial = installSerial.trim();
    const device = getDeviceId();
    await storage.updateSessao({
      token,
      pdv,
      cliente,
      cliente_id: cliente.id,
      primeiro_acesso: false,
      playlists_data: null,
      agendas_data: null,
      ping_times: 0,
      install_device_id: device,
      install_serial: serial,
    });
    set({
      token,
      pdv,
      cliente,
      cliente_id: cliente.id,
      installSerial: serial,
      playlistData: null,
      agendas: null,
      programacaoPendente: null,
      skipDestructivePlaylistReload: false,
      status: 'sincronizando',
      pingTimes: 0,
      pingBloqueado: false,
    });
  },

  atualizarPdv: async (pdvNovo) => {
    // O `/ping/` costuma mandar só um subconjunto de campos; fundimos com o PDV atual
    // para não perder dados vindos do `loginByToken` (ex.: contato extra / aviso codificado).
    const anterior = get().pdv;
    const pdv =
      anterior && pdvNovo ? ({ ...anterior, ...pdvNovo } as PdvData) : pdvNovo;

    await storage.updateSessao({ pdv });
    set((state) => {
      let status = state.status;
      if (pdv.status === 'I' && state.status !== 'desativado') {
        status = 'desativado';
      } else if (pdv.status === 'A' && state.status === 'desativado') {
        status = 'tocando';
      } else if (pdv.ctrl_player === 'N' && state.status === 'pausado') {
        status = 'tocando';
      }
      return { pdv, status };
    });
  },

  salvarPlaylist: async (data) => {
    await storage.updateSessao({
      playlists_data: data,
      last_update: new Date().toISOString(),
    });
    set({ playlistData: data });
  },

  salvarAgendas: async (agendas) => {
    await storage.updateSessao({ agendas_data: agendas });
    set({ agendas });
  },

  logout: async () => {
    /** Última chance de atualizar «% baixado» antes de token sumir (`POST /save_atualizadas/`). */
    try {
      const tokenStr = get().token?.token;
      if (
        typeof window !== 'undefined' &&
        navigator.onLine &&
        tokenStr &&
        get().playlistData != null
      ) {
        const { syncCachedDownloadsReportToServer } = await import('../player/downloadReport');
        await Promise.race([
          syncCachedDownloadsReportToServer(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 12_000);
          }),
        ]);
      }
    } catch (e) {
      console.error('[logout] save_atualizadas', e);
    }
    await storage.limparSessao();
    await storage.limparTodosAudios();
    set({
      status: 'login',
      token: null,
      pdv: null,
      cliente: null,
      cliente_id: null,
      playlistData: null,
      agendas: null,
      installSerial: null,
      programacaoPendente: null,
      skipDestructivePlaylistReload: false,
      pingTimes: 0,
      pingBloqueado: false,
    });
  },

  incrementarPingFalho: async () => {
    const novo = get().pingTimes + 1;
    await storage.updateSessao({ ping_times: novo });
    const bloqueado = novo > LIMITES.LIMIT_TIMES_PING_OFF;
    set({
      pingTimes: novo,
      pingBloqueado: bloqueado,
      ...(bloqueado ? { status: 'desativado' as const } : {}),
    });
  },

  resetarPings: async () => {
    await storage.updateSessao({ ping_times: 0 });
    set((state) => {
      const podeVoltarTocando =
        state.status === 'desativado' && state.pdv?.status === 'A';
      return {
        pingTimes: 0,
        pingBloqueado: false,
        ...(podeVoltarTocando ? { status: 'tocando' as const } : {}),
      };
    });
  },
}));

// ============================================================================
// Listeners de conectividade
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useAppStore.getState().setOnline(true));
  window.addEventListener('offline', () => useAppStore.getState().setOnline(false));
}
