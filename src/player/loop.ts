/**
 * Orquestra reprodução ambiente + vinhetas VP/VA:
 * VP interrompe ambiente pelo intervalo (minutos ou por música, conforme agenda); VA no horário agendado; retorno ao ambiente.
 */

import { useEffect, useRef, useState } from 'react';
import * as ws from '../api/webservice';
import { storage } from '../storage';
import type { Agenda, MusicaCompleta, Playlist, PlaylistResponse } from '../types/webservice';
import { useAppStore } from '../store/app';
import { LIMITES } from '../api/config';
import { createAudioEngine } from './audioEngine';
import {
  AMBIENT_RANDOM_HISTORY_MAX,
  pickAmbientFromResponse,
  pickRandomTrack,
  pickRandomTrackAvoidingPool,
  parseDuracaoRelogio,
  pickVinhetaTrack,
} from './programacao';
import { ensurePlaybackUrl, prefetchPlaylistTracks, urlIndicaAudioEmCacheLocal } from './cacheManager';
import { consumirProgramacaoPendente } from './programacaoRefresh';
import { playbackUrlForAudioElement } from '../utils/audioUrl';
import {
  chaveExecucaoVa,
  encontrarProximaVinheta,
  gravarUltimoVpMs,
  incrementarVpContadorPorMusicaAposFaixaAmbient,
  marcarVaFeita,
  zerarVpMusCountAgenda,
  type VinhetaGatilho,
} from './vinhetas';

function formatDataExecucaoWebservice(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Política de autoplay: play() sem gesto do utilizador falha com NotAllowedError. */
function isAutoplayBlocked(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'NotAllowedError') return true;
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return (err as { name: string }).name === 'NotAllowedError';
  }
  return false;
}

/**
 * Alinha estado ao bloqueio de autoplay. Usa setState direto (não setStatus) para
 * não conflitar com a regra ctrl_player ao forçar pausa técnica.
 */
function alinharPausaPorAutoplay(): void {
  useAppStore.setState({ status: 'pausado' });
}

function reportarFimMusica(token: string, faixa: MusicaCompleta, indTermino: 0 | 1) {
  const id = Number(faixa.musica.playlist_musica_id);
  if (!Number.isFinite(id)) return;
  const data_execucao = formatDataExecucaoWebservice();
  void ws
    .saveExecutada({
      token,
      playlists_musica_id: id,
      data_execucao,
      ind_termino: indTermino,
    })
    .catch(() => {
      if (!navigator.onLine) {
        void storage.enfileirarExecucao({
          playlists_musica_id: id,
          data_execucao,
          ind_termino: indTermino,
        });
      }
    });
}

export interface UsePlayerState {
  faixaAtual: MusicaCompleta | null;
  playlistAmbiente: Playlist | null;
  /** Playlist de onde vem faixa atual (ambiente ou vinheta) */
  modoReproducao: 'ambient' | 'vinheta_vp' | 'vinheta_va';
  /** Origem do áudio da faixa atual: rede (stream) ou ficheiro já guardado no aparelho. */
  origemReproducao: 'streaming' | 'offline' | null;
  erro: string | null;
  /** Próxima faixa / interrompe vinheta segundo regras do servidor (ambiente aleatório, excluindo atual se possível). */
  skipForward: () => void;
  /** No ambiente: se passou SKIP_BACK_RESTART_SEC, reinicia; senão volta à faixa ambiente anterior. Na vinheta: reinicia a faixa. */
  skipBack: () => void;
}

export function usePlayer(): UsePlayerState {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);
  const status = useAppStore((s) => s.status);
  const pdv = useAppStore((s) => s.pdv);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);
  const bloqueioSerialInstalacao = useAppStore((s) => s.bloqueioSerialInstalacao);

  const [faixaAtual, setFaixaAtual] = useState<MusicaCompleta | null>(null);
  const [playlistAmbiente, setPlaylistAmbiente] = useState<Playlist | null>(null);
  const [modoUi, setModoUi] = useState<'ambient' | 'vinheta_vp' | 'vinheta_va'>('ambient');
  const [origemReproducao, setOrigemReproducao] = useState<'streaming' | 'offline' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const ambienteRef = useRef<Playlist | null>(null);
  const faixaRef = useRef<MusicaCompleta | null>(null);
  const modoRef = useRef<'ambient' | 'vinheta'>('ambient');
  /** Reflete VP vs VA apenas para etiqueta UI */
  const vinTipoUiRef = useRef<'VP' | 'VA' | null>(null);

  const playlistPayloadRef = useRef<PlaylistResponse | null>(null);
  const agendasRef = useRef<Agenda[] | null>(null);
  /** Primeiro momento em tocando útil pra baseline de VP (quando servidor não gravou último ping ainda). */
  const bootstrapVpMsRef = useRef<number | null>(null);
  /** Evita reentrância onEnded vs interval */
  const avancandoRef = useRef(false);

  const engineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null);
  const bootRef = useRef(false);
  /** Playlist id utilizado na URL/cache da faixa que está tocando (ambiente OU vinheta). */
  const playbackPlaylistIdRef = useRef<number | null>(null);
  /** Atualizado a cada render — `onEnded` do <audio> aponta sempre para a lógica nova. */
  const fimFaixaHandlerRef = useRef<() => void>(() => {});
  /**
   * Cada novo `enqueuePlayback` aumenta o contador; promises antigas ignoram resultado
   * após troca de faixa/interrupção (evita duas músicas porque `ensurePlaybackUrl` atrasa).
   */
  const playbackIntentRef = useRef(0);
  /** Mixagem nos últimos segundos (AS3): evita disparar duas vezes por faixa. */
  const mixagemAgendadaRef = useRef(false);
  const mixagemGeracaoRef = useRef(0);
  /**
   * Crossfade suprime `ended` do `<audio>`. Marcamos quando a mixagem já contou a faixa
   * ambiente como concluída (para fins de VP «por música»). O ciclo `onEnded` (quando a
   * faixa termina naturalmente, sem crossfade) verifica essa flag para NÃO contar duas
   * vezes a mesma faixa.
   */
  const mixagemContadorJaAplicadoRef = useRef(false);
  /** Última faixa ambiente antes da atual — usada pelo botão «voltar». */
  const faixaAnteriorAmbientRef = useRef<MusicaCompleta | null>(null);
  /** Ids de músicas ambiente sorteadas recentemente — alinha ao AS3 (evitar repetir as últimas N). */
  const recentAmbientMusicaIdsRef = useRef<number[]>([]);
  const ultimaPastaAmbienteIdRef = useRef<number | null>(null);

  useEffect(() => {
    playlistPayloadRef.current = playlistData ?? null;
  }, [playlistData]);

  useEffect(() => {
    agendasRef.current = agendas ?? null;
  }, [agendas]);

  /**
   * Diagnóstico manual: no console do navegador roda `__ibizaSlot()` para inspeção
   * imediata da pasta ativa, agendas e janela horária atual. Útil até confirmarmos
   * o formato `dia_semana` que o webservice envia.
   */
  useEffect(() => {
    const w = window as unknown as {
      __ibizaSlot?: () => unknown;
      __ibizaAgendasRaw?: () => Promise<unknown>;
      __ibizaAgendasUnicaAgenda?: () => unknown;
      __ibizaVinhetas?: () => unknown;
      __ibizaVinhetasRaw?: () => Promise<unknown>;
    };
    w.__ibizaSlot = () => {
      const now = new Date();
      const pdata = playlistPayloadRef.current;
      const ag = agendasRef.current ?? [];
      const escolhida = pdata ? pickAmbientFromResponse(pdata, ag, now) : null;
      const ambientes = (pdata?.playlists ?? [])
        .filter((p) => String(p.tipo).toUpperCase() === 'N')
        .map((p) => ({ id: p.id, nome: p.nome, tocar_sempre: p.tocar_sempre, musicas: p.musicas.length }));
      const agendasPorPasta = ambientes.map((p) => ({
        playlist: p.nome,
        id: p.id,
        agendas: ag
          .filter((a) => Number(a.playlist_id) === p.id)
          .map((a) => ({
            id: a.id,
            dia_semana: a.dia_semana,
            hora_inicio: a.hora_inicio,
            hora_fim: a.hora_fim,
            data_agendada: a.data_agendada,
            data_fim: a.data_fim,
          })),
      }));
      const snap = {
        agora: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        diaSemanaJs: now.getDay(),
        diaSemanaIso: ((now.getDay() + 6) % 7) + 1,
        escolhida_atual: ambienteRef.current
          ? { id: ambienteRef.current.id, nome: ambienteRef.current.nome }
          : null,
        escolhida_recalculada_agora: escolhida ? { id: escolhida.id, nome: escolhida.nome } : null,
        total_playlists: pdata?.playlists?.length ?? 0,
        ambientes,
        total_agendas: ag.length,
        todasAgendas: ag,
        agendasPorPasta,
      };
      // eslint-disable-next-line no-console
      console.info('[ibiza-slot] snapshot →', snap);
      return snap;
    };
    w.__ibizaAgendasUnicaAgenda = () => agendasRef.current ?? [];
    w.__ibizaVinhetas = () => {
      const now = new Date();
      const pdata = playlistPayloadRef.current;
      const ag = agendasRef.current ?? [];
      const vinhetas = (pdata?.playlists ?? []).filter(
        (p) => String(p.tipo).toUpperCase() === 'VP' || String(p.tipo).toUpperCase() === 'VA',
      );
      const detalhe = vinhetas.map((p) => {
        const tipo = String(p.tipo).toUpperCase() as 'VP' | 'VA';
        const rel = ag.filter((a) => Number(a.playlist_id) === p.id);
        return {
          id: p.id,
          nome: p.nome,
          tipo,
          tocar_sempre: p.tocar_sempre,
          musicas_com_url: p.musicas.filter((m) => Boolean(m.url_musica?.trim())).length,
          total_musicas: p.musicas.length,
          total_agendas: rel.length,
          agendas: rel.map((a) => ({
            id: a.id,
            dia_semana: a.dia_semana,
            hora_inicio: a.hora_inicio,
            hora_fim: a.hora_fim,
            data_agendada: a.data_agendada,
            data_fim: a.data_fim,
            tocar_cada: a.tocar_cada,
            tipo_tocar: a.tipo_tocar,
          })),
        };
      });
      const proxima = encontrarProximaVinheta(
        pdata?.playlists ?? [],
        ag,
        now,
        bootstrapVpMsRef.current ?? Date.now(),
        programaIdParaVp(),
      );
      const snap = {
        agora: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        diaSemanaJs: now.getDay(),
        bootstrap_vp_ms: bootstrapVpMsRef.current,
        total_vinhetas: vinhetas.length,
        proxima_a_disparar: proxima
          ? {
              kind: proxima.kind,
              playlist: proxima.playlist.nome,
              playlist_id: proxima.playlist.id,
              agenda_id: proxima.agenda.id,
              hora_inicio: proxima.agenda.hora_inicio,
              dia_semana: proxima.agenda.dia_semana,
            }
          : null,
        detalhe,
      };
      // eslint-disable-next-line no-console
      console.info('[ibiza-vinhetas] snapshot →', snap);
      return snap;
    };
    w.__ibizaVinhetasRaw = async () => {
      const tok = useAppStore.getState().token?.token;
      if (!tok) {
        // eslint-disable-next-line no-console
        console.warn('[ibiza-vinhetas] sem token; faz login primeiro');
        return null;
      }
      try {
        const [progRaw, agenRaw] = await Promise.all([
          ws.getVinhetasProgramadas(tok).catch((e) => ({ __erro: String(e) })),
          ws.getVinhetasAgendadas(tok).catch((e) => ({ __erro: String(e) })),
        ]);
        const raw = { vinhetas_programadas: progRaw, vinhetas_agendadas: agenRaw };
        // eslint-disable-next-line no-console
        console.info('[ibiza-vinhetas] /vinhetas_*/ raw →', raw);
        return raw;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[ibiza-vinhetas] falha endpoints vinhetas', e);
        return null;
      }
    };
    w.__ibizaAgendasRaw = async () => {
      const tok = useAppStore.getState().token?.token;
      if (!tok) {
        // eslint-disable-next-line no-console
        console.warn('[ibiza-slot] sem token; faz login primeiro');
        return null;
      }
      try {
        const raw = await ws.getAgendas(tok);
        // eslint-disable-next-line no-console
        console.info('[ibiza-slot] /agendas/ raw →', raw);
        return raw;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[ibiza-slot] falha /agendas/', e);
        return null;
      }
    };
    return () => {
      const ww = window as unknown as {
        __ibizaSlot?: unknown;
        __ibizaAgendasRaw?: unknown;
        __ibizaAgendasUnicaAgenda?: unknown;
        __ibizaVinhetas?: unknown;
        __ibizaVinhetasRaw?: unknown;
      };
      delete ww.__ibizaSlot;
      delete ww.__ibizaAgendasRaw;
      delete ww.__ibizaAgendasUnicaAgenda;
      delete ww.__ibizaVinhetas;
      delete ww.__ibizaVinhetasRaw;
    };
  }, []);

  useEffect(() => {
    const id = playlistAmbiente?.id ?? null;
    if (id !== ultimaPastaAmbienteIdRef.current) {
      ultimaPastaAmbienteIdRef.current = id;
      recentAmbientMusicaIdsRef.current = [];
    }
  }, [playlistAmbiente?.id]);

  const bloqueadoReproducao =
    pingBloqueado ||
    bloqueioSerialInstalacao ||
    pdv?.status === 'I' ||
    status === 'desativado' ||
    status === 'sincronizando' ||
    status === 'login' ||
    status === 'selecionar_pdv' ||
    status === 'erro';

  /** Id do programa no JSON de /playlist/ — necessário para agendas VP sintéticas sem /agendas/. */
  function programaIdParaVp(): number {
    const id = playlistPayloadRef.current?.programa?.id;
    return typeof id === 'number' && Number.isFinite(id) ? id : 0;
  }

  /**
   * Reaplica a regra de slot do AS3 (`VerificarProgramacao`) a cada transição: lê
   * `/playlist/` + `/agendas/` em cache, escolhe a pasta tipo N ativa AGORA. Se mudou,
   * atualiza ref + state da UI; a música tocando termina normalmente, a próxima já vem
   * da nova pasta. Sem isto, o player ficava preso ao slot que estava ativo no boot.
   */
  function reavaliarAmbienteAtual(): Playlist | null {
    const pdata = playlistPayloadRef.current;
    if (!pdata) return ambienteRef.current;
    const prox = pickAmbientFromResponse(pdata, agendasRef.current, new Date());
    if (!prox) return ambienteRef.current;
    const atualId = ambienteRef.current?.id;
    if (prox.id !== atualId) {
      ambienteRef.current = prox;
      setPlaylistAmbiente(prox);
    }
    return prox;
  }

  function erroPlay() {
    setErro('Não foi possível reproduzir o áudio.');
  }

  function atualizarOrigemReproducaoAPartirDaUrl(url: string) {
    setOrigemReproducao(urlIndicaAudioEmCacheLocal(url) ? 'offline' : 'streaming');
  }

  function enqueuePlayback(
    eng: NonNullable<typeof engineRef.current>,
    faixa: MusicaCompleta,
    playlistId: number,
    onFail: () => void,
  ): void {
    playbackIntentRef.current += 1;
    const intent = playbackIntentRef.current;

    void (async () => {
      const url = await ensurePlaybackUrl(faixa, playlistId);
      if (intent !== playbackIntentRef.current) return;
      if (eng !== engineRef.current) return;

      atualizarOrigemReproducaoAPartirDaUrl(url);

      try {
        await eng.play(url);
        setErro(null);
      } catch (err) {
        if (intent !== playbackIntentRef.current) return;
        if (eng !== engineRef.current) return;
        if (isAutoplayBlocked(err)) {
          alinharPausaPorAutoplay();
          return;
        }
        console.error(err);
        try {
          const remoto = playbackUrlForAudioElement(faixa.url_musica);
          setOrigemReproducao('streaming');
          await eng.play(remoto);
          setErro(null);
        } catch (err2) {
          if (intent !== playbackIntentRef.current) return;
          if (eng !== engineRef.current) return;
          if (isAutoplayBlocked(err2)) {
            alinharPausaPorAutoplay();
            return;
          }
          console.error(err2);
          onFail();
        }
      }
    })();
  }

  function iniciarVinheta(g: VinhetaGatilho) {
    mixagemGeracaoRef.current += 1;
    mixagemAgendadaRef.current = false;

    const e = engineRef.current;
    const ambList = playlistPayloadRef.current?.playlists;
    if (!e || !ambList) return false;

    e.pause();

    const faixa = pickVinhetaTrack(g.playlist);
    if (!faixa) return false;

    modoRef.current = 'vinheta';
    vinTipoUiRef.current = g.kind === 'VP' ? 'VP' : 'VA';
    setModoUi(g.kind === 'VP' ? 'vinheta_vp' : 'vinheta_va');

    faixaRef.current = faixa;
    setFaixaAtual(faixa);
    playbackPlaylistIdRef.current = g.playlist.id;

    if (g.kind === 'VP') {
      gravarUltimoVpMs(g.playlist.id, Date.now());
      zerarVpMusCountAgenda(g.agenda.id);
    } else {
      marcarVaFeita(chaveExecucaoVa(g.playlist.id, g.agenda, new Date()));
    }

    enqueuePlayback(e, faixa, g.playlist.id, erroPlay);
    return true;
  }

  /** Interrupção durante ambiente: reporta música ambiente cortada (`ind_termino` 0). */
  function interromperComVinheta(g: VinhetaGatilho) {
    const tok = useAppStore.getState().token?.token;
    const cur = faixaRef.current;

    if (tok && cur && modoRef.current === 'ambient') {
      reportarFimMusica(tok, cur, 0);
    }

    iniciarVinheta(g);
  }

  function tocarProximaFaixaAmbient(opts?: { excludeCurrent?: boolean }) {
    const e = engineRef.current;
    /** Re-aplica a regra de slot do servidor a cada faixa nova (espírito do AS3). */
    reavaliarAmbienteAtual();
    const amb = ambienteRef.current;
    if (!e || !amb) return;

    if (
      modoRef.current === 'ambient' &&
      faixaRef.current &&
      playbackPlaylistIdRef.current === amb.id
    ) {
      faixaAnteriorAmbientRef.current = faixaRef.current;
    }

    const curId = faixaRef.current ? Number(faixaRef.current.musica.id) : undefined;
    const pool = new Set<number>(recentAmbientMusicaIdsRef.current);
    if (opts?.excludeCurrent && curId !== undefined && Number.isFinite(curId)) {
      pool.add(Math.trunc(curId));
    }
    let prox = pickRandomTrackAvoidingPool(amb, pool);
    if (!prox) prox = pickRandomTrack(amb);
    if (!prox) {
      setErro('Nenhuma faixa com URL de áudio disponível.');
      return;
    }
    modoRef.current = 'ambient';
    vinTipoUiRef.current = null;
    setModoUi('ambient');
    faixaRef.current = prox;
    setFaixaAtual(prox);
    playbackPlaylistIdRef.current = amb.id;
    mixagemContadorJaAplicadoRef.current = false;
    const mid = Number(prox.musica.id);
    if (Number.isFinite(mid)) {
      recentAmbientMusicaIdsRef.current = [...recentAmbientMusicaIdsRef.current, Math.trunc(mid)].slice(
        -AMBIENT_RANDOM_HISTORY_MAX,
      );
    }
    enqueuePlayback(e, prox, amb.id, erroPlay);
  }

  async function cicloAoTerminarFaixaAtual() {
    if (avancandoRef.current) return;
    avancandoRef.current = true;
    mixagemAgendadaRef.current = false;
    try {
      const aplicada = await consumirProgramacaoPendente();
      if (aplicada) {
        playlistPayloadRef.current = aplicada.playlist;
        agendasRef.current = aplicada.agendas;
        const nb = pickAmbientFromResponse(aplicada.playlist, aplicada.agendas);
        ambienteRef.current = nb;
        setPlaylistAmbiente(nb);
      }

      /** Mesmo sem programação nova do servidor, o slot pode ter virado por hora. */
      reavaliarAmbienteAtual();

      const tok = useAppStore.getState().token?.token;
      const cur = faixaRef.current;
      const amb = ambienteRef.current;

      const eraVin = modoRef.current === 'vinheta';

      if (tok && cur) {
        reportarFimMusica(tok, cur, 1);
      }

      if (!eraVin) {
        if (mixagemContadorJaAplicadoRef.current) {
          /** Mixagem já contou esta faixa ambiente — não duplica. */
          mixagemContadorJaAplicadoRef.current = false;
        } else {
          incrementarVpContadorPorMusicaAposFaixaAmbient(
            agendasRef.current ?? [],
            playlistPayloadRef.current?.playlists ?? [],
            new Date(),
            programaIdParaVp(),
          );
        }
      }

      if (eraVin) {
        modoRef.current = 'ambient';
        vinTipoUiRef.current = null;
        setModoUi('ambient');

        const vin = encontrarProximaVinheta(
          playlistPayloadRef.current?.playlists ?? [],
          agendasRef.current ?? [],
          new Date(),
          bootstrapVpMsRef.current ?? Date.now(),
          programaIdParaVp(),
        );
        if (vin) {
          iniciarVinheta(vin);
          return;
        }
        if (amb) {
          tocarProximaFaixaAmbient();
        }
        return;
      }

      if (!amb) return;

      const vinPrimeiro = encontrarProximaVinheta(
        playlistPayloadRef.current?.playlists ?? [],
        agendasRef.current ?? [],
        new Date(),
        bootstrapVpMsRef.current ?? Date.now(),
        programaIdParaVp(),
      );

      if (vinPrimeiro) {
        iniciarVinheta(vinPrimeiro);
        return;
      }

      tocarProximaFaixaAmbient();
    } finally {
      avancandoRef.current = false;
    }
  }

  /** Botão «próximo»: termina faixa atual (ind. 0) e avança — espelha Prioridade vinheta > próximo ambiente. */
  function pularFaixaManual(): void {
    if (avancandoRef.current) return;

    const st = useAppStore.getState();
    const bloqueado =
      st.pingBloqueado ||
      st.bloqueioSerialInstalacao ||
      st.pdv?.status === 'I' ||
      st.status === 'desativado' ||
      st.status === 'sincronizando' ||
      st.status === 'login' ||
      st.status === 'selecionar_pdv' ||
      st.status === 'erro';
    if (bloqueado) return;

    const tok = st.token?.token;
    const cur = faixaRef.current;
    const eng = engineRef.current;
    if (!eng || !tok || !cur) return;

    st.setStatus('tocando');

    void (async () => {
      avancandoRef.current = true;
      mixagemGeracaoRef.current += 1;
      mixagemAgendadaRef.current = false;

      try {
        const aplicada = await consumirProgramacaoPendente();
        if (aplicada) {
          playlistPayloadRef.current = aplicada.playlist;
          agendasRef.current = aplicada.agendas;
          const nb = pickAmbientFromResponse(aplicada.playlist, aplicada.agendas);
          ambienteRef.current = nb;
          setPlaylistAmbiente(nb);
        }

        reavaliarAmbienteAtual();
        const amb = ambienteRef.current;

        if (modoRef.current === 'vinheta') {
          reportarFimMusica(tok, cur, 0);

          modoRef.current = 'ambient';
          vinTipoUiRef.current = null;
          setModoUi('ambient');

          const pdata = playlistPayloadRef.current?.playlists ?? [];
          const ag = agendasRef.current ?? [];
          const vin = encontrarProximaVinheta(
            pdata,
            ag,
            new Date(),
            bootstrapVpMsRef.current ?? Date.now(),
            programaIdParaVp(),
          );
          if (vin) {
            iniciarVinheta(vin);
            return;
          }
          if (amb) tocarProximaFaixaAmbient({ excludeCurrent: false });
          return;
        }

        const pdata = playlistPayloadRef.current?.playlists ?? [];
        const ag = agendasRef.current ?? [];
        if (mixagemContadorJaAplicadoRef.current) {
          mixagemContadorJaAplicadoRef.current = false;
        } else {
          incrementarVpContadorPorMusicaAposFaixaAmbient(ag, pdata, new Date(), programaIdParaVp());
        }
        const vin = encontrarProximaVinheta(
          pdata,
          ag,
          new Date(),
          bootstrapVpMsRef.current ?? Date.now(),
          programaIdParaVp(),
        );
        if (vin) {
          interromperComVinheta(vin);
          return;
        }

        reportarFimMusica(tok, cur, 0);
        if (amb) tocarProximaFaixaAmbient({ excludeCurrent: true });
      } finally {
        avancandoRef.current = false;
      }
    })();
  }

  /** Botão «anterior»: vinheta = reinício; ambiente = reinício ou troca pela faixa ambiente gravada antes da atual. */
  function voltarFaixaManual(): void {
    if (avancandoRef.current) return;

    const st = useAppStore.getState();
    const bloqueado =
      st.pingBloqueado ||
      st.bloqueioSerialInstalacao ||
      st.pdv?.status === 'I' ||
      st.status === 'desativado' ||
      st.status === 'sincronizando' ||
      st.status === 'login' ||
      st.status === 'selecionar_pdv' ||
      st.status === 'erro';
    if (bloqueado) return;

    const eng = engineRef.current;
    if (!eng || !faixaRef.current) return;

    avancandoRef.current = true;
    try {
      if (modoRef.current === 'vinheta') {
        eng.seekToStart();
        return;
      }

      const amb = ambienteRef.current;
      if (!amb || modoRef.current !== 'ambient') {
        eng.seekToStart();
        return;
      }

      const stats = eng.getPlaybackStats();
      const lim = LIMITES.SKIP_BACK_RESTART_SEC;

      if (stats !== null && stats.currentTime > lim) {
        eng.seekToStart();
        return;
      }

      const prev = faixaAnteriorAmbientRef.current;
      const cur = faixaRef.current;
      if (!prev || !cur) {
        eng.seekToStart();
        return;
      }

      st.setStatus('tocando');

      mixagemGeracaoRef.current += 1;
      mixagemAgendadaRef.current = false;

      faixaAnteriorAmbientRef.current = cur;

      faixaRef.current = prev;
      setFaixaAtual(prev);
      playbackPlaylistIdRef.current = amb.id;
      mixagemContadorJaAplicadoRef.current = false;
      enqueuePlayback(eng, prev, amb.id, erroPlay);
    } finally {
      avancandoRef.current = false;
    }
  }

  const setErroRef = useRef(setErro);
  setErroRef.current = setErro;

  fimFaixaHandlerRef.current = () => {
    void cicloAoTerminarFaixaAtual();
  };

  /** Áudio parou com erro (`MediaError`) — sem isto a UI ficava com título antigo e silêncio. */
  const recuperarAposErroRef = useRef<() => void>(() => {});
  recuperarAposErroRef.current = () => {
    if (avancandoRef.current) return;
    void (async () => {
      avancandoRef.current = true;
      mixagemAgendadaRef.current = false;
      mixagemGeracaoRef.current += 1;
      try {
        const aplicada = await consumirProgramacaoPendente();
        if (aplicada) {
          playlistPayloadRef.current = aplicada.playlist;
          agendasRef.current = aplicada.agendas;
          const nb = pickAmbientFromResponse(aplicada.playlist, aplicada.agendas);
          ambienteRef.current = nb;
          setPlaylistAmbiente(nb);
        }

        reavaliarAmbienteAtual();

        const tok = useAppStore.getState().token?.token;
        const cur = faixaRef.current;
        if (tok && cur) {
          reportarFimMusica(tok, cur, 0);
        }

        if (modoRef.current === 'vinheta') {
          modoRef.current = 'ambient';
          vinTipoUiRef.current = null;
          setModoUi('ambient');
          faixaRef.current = null;
          setFaixaAtual(null);
          setOrigemReproducao(null);
          playbackPlaylistIdRef.current = null;

          const amb = ambienteRef.current;
          if (!amb) return;

          const vin = encontrarProximaVinheta(
            playlistPayloadRef.current?.playlists ?? [],
            agendasRef.current ?? [],
            new Date(),
            bootstrapVpMsRef.current ?? Date.now(),
            programaIdParaVp(),
          );
          if (vin) {
            iniciarVinheta(vin);
            return;
          }
          tocarProximaFaixaAmbient();
          return;
        }

        if (ambienteRef.current) {
          tocarProximaFaixaAmbient();
        }
      } finally {
        avancandoRef.current = false;
      }
    })();
  };

  // Engine único
  useEffect(() => {
    bootRef.current = false;
    const eng = createAudioEngine({
      onEnded: () => fimFaixaHandlerRef.current(),
      onError: (ev) => {
        const el = ev.target as HTMLAudioElement;
        const c = el.error?.code;
        let msg = 'Erro ao reproduzir o áudio.';
        if (c === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          msg =
            'URL ou formato de áudio bloqueado (ex.: página HTTPS com MP3 em HTTP).';
        } else if (c === MediaError.MEDIA_ERR_NETWORK) {
          msg = 'Rede/recusa ao baixar o áudio.';
        } else if (c === MediaError.MEDIA_ERR_DECODE) {
          msg = 'Arquivo de áudio corrompido ou ilegível.';
        }
        setErroRef.current(msg);
        console.error('[audio]', ev);
        recuperarAposErroRef.current();
      },
    });
    engineRef.current = eng;
    bootRef.current = true;

    return () => {
      playbackIntentRef.current += 1;
      eng.destroy();
      engineRef.current = null;
      bootRef.current = false;
    };
  }, []);

  // Sincroniza playlist ambiente
  useEffect(() => {
    if (!playlistData) {
      playbackIntentRef.current += 1;
      mixagemGeracaoRef.current += 1;
      mixagemAgendadaRef.current = false;
      faixaRef.current = null;
      setFaixaAtual(null);
      setOrigemReproducao(null);
      faixaAnteriorAmbientRef.current = null;
      ambienteRef.current = null;
      setPlaylistAmbiente(null);
      setErro(null);
      modoRef.current = 'ambient';
      vinTipoUiRef.current = null;
      setModoUi('ambient');
      engineRef.current?.pause();
      bootstrapVpMsRef.current = null;
      playbackPlaylistIdRef.current = null;
      useAppStore.setState({ skipDestructivePlaylistReload: false });
      return;
    }

    playbackIntentRef.current += 1;
    mixagemGeracaoRef.current += 1;

    const amb = pickAmbientFromResponse(playlistData, agendasRef.current);
    ambienteRef.current = amb;
    setPlaylistAmbiente(amb);

    const skip = useAppStore.getState().skipDestructivePlaylistReload;

    if (skip) {
      useAppStore.setState({ skipDestructivePlaylistReload: false });
      mixagemAgendadaRef.current = false;
      if (!amb) {
        setErro('Nenhuma playlist ambiente (tipo N) com músicas disponível.');
        engineRef.current?.pause();
      } else {
        setErro(null);
      }
      return;
    }

    mixagemAgendadaRef.current = false;
    faixaRef.current = null;
    setFaixaAtual(null);
    setOrigemReproducao(null);
    faixaAnteriorAmbientRef.current = null;

    if (!amb) {
      setErro('Nenhuma playlist ambiente (tipo N) com músicas disponível.');
      engineRef.current?.pause();
    } else {
      setErro(null);
    }
  }, [playlistData]);

  /**
   * Mixagem tipo player AS3: nos últimos ~10 s da ambiente atual, fade linear para a próxima faixa sorteada.
   */
  useEffect(() => {
    const POLL_MS = 280;
    const id = window.setInterval(() => {
      if (bloqueadoReproducao || status !== 'tocando') return;
      if (modoRef.current !== 'ambient') return;
      if (mixagemAgendadaRef.current) return;
      if (avancandoRef.current) return;

      const eng = engineRef.current;
      if (!eng?.getPlaybackStats || !eng.crossfadeTo) return;

      /** No instante da mixagem (faltam ~10s), também aplicamos o slot atual. */
      reavaliarAmbienteAtual();
      const amb = ambienteRef.current;
      const cur = faixaRef.current;
      if (!amb || !cur) return;

      const stats = eng.getPlaybackStats();
      if (!stats) return;

      const metaDur = parseDuracaoRelogio(cur.musica.duracao);
      const duration =
        stats.duration > 0 && Number.isFinite(stats.duration) ? stats.duration : metaDur;
      if (!Number.isFinite(duration) || duration <= 0) return;

      const remaining =
        stats.duration > 0 && Number.isFinite(stats.duration)
          ? Math.max(0, stats.remaining)
          : Math.max(0, metaDur - stats.currentTime);

      const leadBase = LIMITES.MIXAGEM_ANTES_FIM_SEC;
      const lead = duration < leadBase ? Math.max(2, duration * 0.35) : leadBase;

      if (remaining > lead) return;

      mixagemAgendadaRef.current = true;
      const gen = ++mixagemGeracaoRef.current;
      const oldFaixa = cur;
      const excludeId = Number(cur.musica.id);

      void (async () => {
        const e = engineRef.current;
        if (!e?.crossfadeTo) {
          mixagemAgendadaRef.current = false;
          return;
        }

        try {
          // Conta a faixa ambiente como concluída pra fins de VP «por música» — vamos ou
          // crossfadear (que suprime `ended`) ou deixar terminar natural com vinheta a
          // seguir (e o ciclo `onEnded` checa a flag para não contar duas vezes).
          incrementarVpContadorPorMusicaAposFaixaAmbient(
            agendasRef.current ?? [],
            playlistPayloadRef.current?.playlists ?? [],
            new Date(),
            programaIdParaVp(),
          );
          mixagemContadorJaAplicadoRef.current = true;

          const vin = encontrarProximaVinheta(
            playlistPayloadRef.current?.playlists ?? [],
            agendasRef.current ?? [],
            new Date(),
            bootstrapVpMsRef.current ?? Date.now(),
            programaIdParaVp(),
          );

          if (
            vin &&
            gen === mixagemGeracaoRef.current &&
            e === engineRef.current
          ) {
            /**
             * Política «vinheta só entre músicas»: NÃO interrompe a faixa em andamento
             * nem encurta com crossfade. Deixa a música terminar normalmente; o `onEnded`
             * vai chamar `cicloAoTerminarFaixaAtual` que sabe que existe vinheta pendente
             * e a dispara antes da próxima ambiente.
             */
            return;
          }

          const poolMix = new Set<number>(recentAmbientMusicaIdsRef.current);
          if (excludeId !== undefined && Number.isFinite(excludeId)) {
            poolMix.add(Math.trunc(excludeId));
          }
          const prox = pickRandomTrackAvoidingPool(amb, poolMix);
          if (!prox) {
            mixagemAgendadaRef.current = false;
            return;
          }

          const fadeSec = Math.min(
            LIMITES.MIXAGEM_FADE_SEC,
            Math.max(2, remaining - 0.25),
          );

          const url = await ensurePlaybackUrl(prox, amb.id);
          if (gen !== mixagemGeracaoRef.current || e !== engineRef.current) {
            mixagemAgendadaRef.current = false;
            return;
          }

          atualizarOrigemReproducaoAPartirDaUrl(url);

          const fadeOk = await e.crossfadeTo(url, fadeSec);

          if (
            !fadeOk ||
            gen !== mixagemGeracaoRef.current ||
            e !== engineRef.current
          ) {
            mixagemAgendadaRef.current = false;
            return;
          }

          const tok = useAppStore.getState().token?.token;
          if (tok && oldFaixa) {
            reportarFimMusica(tok, oldFaixa, 1);
          }

          faixaAnteriorAmbientRef.current = oldFaixa;

          modoRef.current = 'ambient';
          vinTipoUiRef.current = null;
          setModoUi('ambient');
          faixaRef.current = prox;
          setFaixaAtual(prox);
          playbackPlaylistIdRef.current = amb.id;
          mixagemContadorJaAplicadoRef.current = false;
          const midMix = Number(prox.musica.id);
          if (Number.isFinite(midMix)) {
            recentAmbientMusicaIdsRef.current = [
              ...recentAmbientMusicaIdsRef.current,
              Math.trunc(midMix),
            ].slice(-AMBIENT_RANDOM_HISTORY_MAX);
          }
        } catch (err) {
          console.error('[mixagem]', err);
        } finally {
          if (gen === mixagemGeracaoRef.current) {
            mixagemAgendadaRef.current = false;
          }
        }
      })();
    }, POLL_MS);

    return () => clearInterval(id);
  }, [status, bloqueadoReproducao]);

  /**
   * Polling de slot (~30 s): só atualiza `playlistAmbiente` (UI + ref) quando o relógio cruza
   * o limite de janela (ex.: 12:00). Não corta a faixa em andamento — a próxima troca normal
   * (skip, fim de faixa, mixagem) sorteia da nova pasta. Mesmo espírito do `VerificarProgramacao` AS3.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (bloqueadoReproducao) return;
      if (!playlistPayloadRef.current?.playlists?.length) return;
      reavaliarAmbienteAtual();
    }, 30_000);
    return () => clearInterval(id);
  }, [bloqueadoReproducao]);

  /**
   * Vinhetas só tocam **entre músicas**, nunca interrompendo o áudio em andamento.
   *
   * Antes existia um polling de 12s que chamava `interromperComVinheta` e cortava a
   * música ambiente. A nova política — pedido do operador — deixa a faixa terminar,
   * a vinheta entra logo depois e a próxima ambiente vem na sequência. A decisão fica
   * concentrada em `cicloAoTerminarFaixaAtual` (no `onEnded` do `<audio>`) e em
   * `pularFaixaManual` (quando o operador clica «próximo» o aviso pode entrar antes
   * da próxima música, como sempre).
   */

  // Play / pause conforme estado + primeira faixa ambiente
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !bootRef.current) return;

    if (bloqueadoReproducao) {
      playbackIntentRef.current += 1;
      eng.pause();
      return;
    }

    if (status === 'pausado') {
      eng.pause();
      return;
    }

    if (status !== 'tocando') {
      eng.pause();
      return;
    }

    /** Boot do play: aplica imediatamente o slot atual antes de sortear a primeira faixa. */
    reavaliarAmbienteAtual();
    const amb = ambienteRef.current;
    if (!amb) return;

    if (!useAppStore.getState().token?.token) return;

    if (bootstrapVpMsRef.current === null) {
      bootstrapVpMsRef.current = Date.now();
    }

    let cur = faixaRef.current;
    if (!cur) {
      const vin = encontrarProximaVinheta(
        playlistPayloadRef.current?.playlists ?? [],
        agendasRef.current ?? [],
        new Date(),
        bootstrapVpMsRef.current,
        programaIdParaVp(),
      );
      if (vin && iniciarVinheta(vin)) {
        return;
      }

      const first = pickRandomTrackAvoidingPool(amb, recentAmbientMusicaIdsRef.current);
      const escolhida = first ?? pickRandomTrack(amb);
      if (!escolhida) {
        setErro('Nenhuma faixa com URL de áudio disponível.');
        return;
      }
      modoRef.current = 'ambient';
      setModoUi('ambient');
      cur = escolhida;
      faixaRef.current = cur;
      setFaixaAtual(cur);
      playbackPlaylistIdRef.current = amb.id;
      mixagemContadorJaAplicadoRef.current = false;
      const mid0 = Number(cur.musica.id);
      if (Number.isFinite(mid0)) {
        recentAmbientMusicaIdsRef.current = [...recentAmbientMusicaIdsRef.current, Math.trunc(mid0)].slice(
          -AMBIENT_RANDOM_HISTORY_MAX,
        );
      }
      enqueuePlayback(eng, cur, amb.id, erroPlay);
      return;
    }

    /** Faixa atual já iniciada por `iniciarVinheta` / ciclo natural — só pausa/retoma nos efeitos abaixo. */
  }, [status, pdv?.status, playlistAmbiente, pingBloqueado, bloqueadoReproducao]);

  /** Só retoma quando sai explicitamente de `pausado` — evita `resume` no primeiro play. */
  const statusAnteriorRef = useRef(status);
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !bootRef.current) return;
    if (bloqueadoReproducao) return;

    const anterior = statusAnteriorRef.current;
    statusAnteriorRef.current = status;

    if (status === 'pausado') {
      eng.pause();
      return;
    }

    if (status === 'tocando' && anterior === 'pausado') {
      void eng.resume().catch(() => {});
    }
  }, [status, bloqueadoReproducao]);

  /**
   * Navegadores costumam pausar `<audio>` com aba em segundo plano / economia à noite.
   * Ao voltar o foco, tenta retomar se o estado ainda é "tocando" (mantém comportamento esperado pelo operador).
   */
  useEffect(() => {
    const tentarRetomarAudio = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const st = useAppStore.getState();
      if (st.status !== 'tocando') return;
      if (st.pingBloqueado || st.bloqueioSerialInstalacao || st.pdv?.status === 'I') return;
      const eng = engineRef.current;
      if (!eng || !bootRef.current) return;
      void eng.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', tentarRetomarAudio);
    window.addEventListener('focus', tentarRetomarAudio);
    return () => {
      document.removeEventListener('visibilitychange', tentarRetomarAudio);
      window.removeEventListener('focus', tentarRetomarAudio);
    };
  }, []);

  useEffect(() => {
    if (!playlistAmbiente || !faixaAtual) return;
    prefetchPlaylistTracks(playlistAmbiente, faixaAtual.musica.id);
  }, [playlistAmbiente?.id, faixaAtual?.musica.id]);

  return {
    faixaAtual,
    playlistAmbiente,
    modoReproducao: modoUi,
    origemReproducao,
    erro,
    skipForward: pularFaixaManual,
    skipBack: voltarFaixaManual,
  };
}
