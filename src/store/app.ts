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
import { getDeviceId, isDebugRedeEnabled, LIMITES } from '../api/config';
import { extrairSerialInstalacaoDoPdv, extrairSerialRespostaLogin, serialsInstalacaoIguais } from '../utils/serialInstalacao';
import * as ws from '../api/webservice';

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

  /** Serial vinda do painel no JSON do PDV, gravada na 1.ª sincronização com o servidor. */
  installSerial: string | null;

  /** Serial do painel deixou de coincidir com esta instalação — áudio para e overlay de aviso. */
  bloqueioSerialInstalacao: boolean;

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

  /**
   * «Chamar» o utilizador ao botão play: arranque em pausa (política de autoplay)
   * ou browser bloqueou o primeiro play — animação até voltar a tocar ou pausar manualmente.
   */
  conviteGesturaAudio: boolean;

  // ----- Actions -----
  setStatus: (s: StatusPlayer) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string | null) => void;
  setOnline: (online: boolean) => void;
  setClienteId: (id: number | null) => void;
  /** Após POST /login/ com sucesso: grava `cliente_id` no storage e põe fluxo «escolher PDV». */
  persistirClienteAposLoginEmail: (clienteId: number) => Promise<void>;

  hidratar: () => Promise<void>;
  salvarSessao: (data: { token: Token; pdv: PdvData; cliente: ClienteData }) => Promise<void>;
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
  bloqueioSerialInstalacao: false,
  programacaoPendente: null,
  skipDestructivePlaylistReload: false,
  loading: false,
  errorMessage: null,
  online: navigator.onLine,
  pingTimes: 0,
  pingBloqueado: false,
  conviteGesturaAudio: false,

  setStatus: (status) => {
    if (status === 'tocando') {
      set({ status, conviteGesturaAudio: false });
      return;
    }
    if (status === 'pausado') {
      set({ status, conviteGesturaAudio: false });
      return;
    }
    set({ status, conviteGesturaAudio: false });
  },
  setLoading: (loading) => set({ loading }),
  setError: (errorMessage) => set({ errorMessage }),
  setOnline: (online) => set({ online }),
  setClienteId: (cliente_id) => set({ cliente_id }),

  persistirClienteAposLoginEmail: async (clienteId) => {
    const id = Number(clienteId);
    if (!Number.isFinite(id) || id <= 0) return;
    await storage.updateSessao({ cliente_id: id });
    set({ cliente_id: id, status: 'selecionar_pdv', conviteGesturaAudio: false });
  },

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
        bloqueioSerialInstalacao: false,
        programacaoPendente: null,
        skipDestructivePlaylistReload: false,
        pingTimes: 0,
        pingBloqueado: false,
        conviteGesturaAudio: false,
        errorMessage:
          'Esta instalação já está ativa noutro aparelho ou os dados locais não pertencem a este computador. Entre de novo ou use este player só na máquina onde foi instalado.',
      });
      return;
    }

    if (sessao.token?.token && !bound) {
      await storage.updateSessao({ install_device_id: currentDevice });
      sessao = { ...sessao, install_device_id: currentDevice };
    }

    /**
     * Após «nova chave» no painel, o token na sessão é a fonte de verdade do webservice.
     * Se IndexedDB ficou com install_serial antigo enquanto o token já foi atualizado,
     * alinhar evita falso «Player desativado» ao reabrir o PWA.
     */
    const tokSessao = sessao.token?.token?.trim() || '';
    if (tokSessao) {
      const serialGravada = sessao.install_serial?.trim() || '';
      if (serialGravada && !serialsInstalacaoIguais(serialGravada, tokSessao)) {
        await storage.updateSessao({ install_serial: tokSessao });
        sessao = { ...sessao, install_serial: tokSessao };
        if (isDebugRedeEnabled()) {
          console.info(
            '[ibiza-serial] install_serial alinhada ao token da sessão no arranque (evita drift após nova chave).',
          );
        }
      }
    }

    const pdvServidorInativo = sessao.pdv?.status === 'I';
    const pingGuardadoAlto = sessao.ping_times > LIMITES.LIMIT_TIMES_PING_OFF;
    /**
     * Novo boot com programação cacheada + PDV ativo: reaplicamos o espírito «falhas consecutivas»
     * só dentro da sessão em que o servidor esteve mesmo inacessível. Fechar a aba/PWA durante o
     * ping ou acumular ruído de rede não deve deixar a instalação presa para sempre em «desativado».
     */
    let pingTimesPersistido = sessao.ping_times;
    let pingExtravazado = pingGuardadoAlto;
    if (
      pingGuardadoAlto &&
      sessao.token?.token &&
      sessao.playlists_data != null &&
      sessao.pdv?.status === 'A'
    ) {
      pingTimesPersistido = 0;
      pingExtravazado = false;
      await storage.updateSessao({ ping_times: 0 });
    }

    set({
      token: sessao.token,
      pdv: sessao.pdv,
      cliente: sessao.cliente,
      cliente_id: sessao.cliente_id,
      playlistData: sessao.playlists_data,
      agendas: sessao.agendas_data,
      installSerial: sessao.install_serial?.trim() || null,
      bloqueioSerialInstalacao: false,
      programacaoPendente: null,
      skipDestructivePlaylistReload: false,
      pingTimes: pingTimesPersistido,
      pingBloqueado: pingTimesPersistido > LIMITES.LIMIT_TIMES_PING_OFF,
      conviteGesturaAudio: false,
    });

    // Decide o status inicial baseado no que tem salvo
    if (!sessao.token) {
      const cid = sessao.cliente_id != null ? Number(sessao.cliente_id) : NaN;
      if (Number.isFinite(cid) && cid > 0) {
        /** E-mail já aceite (`/login/`) mas ainda sem token de PDV — continuar em «selecionar PDV». */
        set({ status: 'selecionar_pdv', conviteGesturaAudio: false });
      } else {
        set({ status: 'login', conviteGesturaAudio: false });
      }
    } else if (!sessao.playlists_data) {
      // PDV inativo (cadastro) ou limite de pings: não finge «só sincronizar» — entra bloqueado como no painel.
      set({
        status: pdvServidorInativo || pingExtravazado ? 'desativado' : 'sincronizando',
        conviteGesturaAudio: false,
      });
    } else {
      // Arranque em «tocando»: PDV deve tocar ao abrir; se o browser bloquear autoplay,
      // o loop trata `NotAllowedError` e mostra o convite à gestura (ver `enqueuePlayback`).
      let st: StatusPlayer = 'tocando';
      if (pdvServidorInativo || pingExtravazado) st = 'desativado';
      set({ status: st, conviteGesturaAudio: false });
    }
  },

  salvarSessao: async ({ token, pdv, cliente }) => {
    const serialPainel = extrairSerialRespostaLogin(pdv, token);
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
      install_serial: serialPainel ?? null,
    });
    /** Igual ao AS3: marca `pdvs.instalado = S` — o `/getPdvs/` só lista `instalado = N`. */
    void ws.updatePdvInstalado({ token: token.token, pdv_id: pdv.id }).catch(() => {
      //
    });
    set({
      token,
      pdv,
      cliente,
      cliente_id: cliente.id,
      installSerial: serialPainel ?? null,
      bloqueioSerialInstalacao: false,
      playlistData: null,
      agendas: null,
      programacaoPendente: null,
      skipDestructivePlaylistReload: false,
      status: 'sincronizando',
      pingTimes: 0,
      pingBloqueado: false,
      conviteGesturaAudio: false,
    });
  },

  atualizarPdv: async (pdvNovo) => {
    // O `/ping/` costuma mandar só um subconjunto de campos; fundimos com o PDV atual
    // para não perder dados vindos do `loginByToken` (ex.: contato extra / aviso codificado).
    const anterior = get().pdv;
    const pdv =
      anterior && pdvNovo ? ({ ...anterior, ...pdvNovo } as PdvData) : pdvNovo;

    /** Legado: a «serial» gravada na instalação é o próprio `Token.token` (MD5). */
    const tok = get().token?.token?.trim();
    if (tok && !get().installSerial?.trim()) {
      await storage.updateSessao({ install_serial: tok });
      set({ installSerial: tok });
    }

    /**
     * Usar o PDV já fundido — extrair só de `pdvNovo` podia apanhar menos campos ou outro MD5
     * «órfão» e disparar bloqueio falso ao reabrir o PWA logo após ping parcial do servidor.
     */
    const remoto = extrairSerialInstalacaoDoPdv(pdv);
    let bloquearPorSerial = false;
    if (remoto) {
      const localRaw = get().installSerial?.trim() ?? '';
      if (!localRaw) {
        await storage.updateSessao({ install_serial: remoto });
        set({ installSerial: remoto });
      } else if (!serialsInstalacaoIguais(localRaw, remoto)) {
        bloquearPorSerial = true;
        /** Se a cópia local coincide com o token que ainda autentica, o discordante no PDV é quase sempre ruído de coluna/legado — não cortar áudio. */
        if (
          tok &&
          serialsInstalacaoIguais(localRaw, tok) &&
          !serialsInstalacaoIguais(remoto, tok)
        ) {
          bloquearPorSerial = false;
          if (isDebugRedeEnabled()) {
            console.info(
              '[ibiza-serial] Bloqueio ignorado: serial local = token atual; campo extraído do PDV no ping diferia (cadastro/coluna antiga).',
            );
          }
        }
        if (bloquearPorSerial && isDebugRedeEnabled()) {
          const trunc = (s: string) =>
            s.length <= 12 ? `[${s.length} chars]` : `${s.slice(0, 4)}…${s.slice(-3)} (${s.length})`;
          console.info('[ibiza-serial] Divergência local vs PDV ao ping:', {
            instalacaoGuardada: trunc(localRaw),
            extraidaDoPdvMerge: trunc(remoto),
            dica: 'Com ?debug_rede=1 compares respostas `/ping/`; chaves Azure Netlify não entram aqui.',
          });
        }
      }
    }

    await storage.updateSessao({ pdv });
    set((state) => {
      if (bloquearPorSerial) {
        return { pdv, bloqueioSerialInstalacao: true, conviteGesturaAudio: false };
      }

      let status = state.status;
      if (pdv.status === 'I' && state.status !== 'desativado') {
        status = 'desativado';
      } else if (pdv.status === 'A' && state.status === 'desativado') {
        status = 'tocando';
      }
      const conviteGesturaAudio = status === 'pausado' ? state.conviteGesturaAudio : false;
      if (remoto) {
        return { pdv, status, bloqueioSerialInstalacao: false, conviteGesturaAudio };
      }
      return { pdv, status, conviteGesturaAudio };
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
      bloqueioSerialInstalacao: false,
      programacaoPendente: null,
      skipDestructivePlaylistReload: false,
      pingTimes: 0,
      pingBloqueado: false,
      conviteGesturaAudio: false,
    });
  },

  incrementarPingFalho: async () => {
    const novo = get().pingTimes + 1;
    await storage.updateSessao({ ping_times: novo });
    const bloqueado = novo > LIMITES.LIMIT_TIMES_PING_OFF;
    set({
      pingTimes: novo,
      pingBloqueado: bloqueado,
      ...(bloqueado ? { status: 'desativado' as const, conviteGesturaAudio: false } : {}),
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
        ...(podeVoltarTocando
          ? { status: 'tocando' as const, conviteGesturaAudio: false }
          : {}),
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
