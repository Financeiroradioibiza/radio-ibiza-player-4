/**
 * Orquestra reprodução ambiente + vinhetas VP/VA:
 * VP interrompe ambiente pelo intervalo; VA no horário agendado; retorno ao ambiente.
 */

import { useEffect, useRef, useState } from 'react';
import * as ws from '../api/webservice';
import { storage } from '../storage';
import type { Agenda, MusicaCompleta, Playlist, PlaylistResponse } from '../types/webservice';
import { useAppStore } from '../store/app';
import { LIMITES } from '../api/config';
import { createAudioEngine } from './audioEngine';
import {
  pickAmbientFromResponse,
  pickRandomTrack,
  pickRandomTrackExcluding,
  parseDuracaoRelogio,
  pickVinhetaTrack,
} from './programacao';
import { ensurePlaybackUrl, prefetchPlaylistTracks } from './cacheManager';
import { normalizePlaybackUrl } from '../utils/audioUrl';
import {
  chaveExecucaoVa,
  encontrarProximaVinheta,
  gravarUltimoVpMs,
  marcarVaFeita,
  type VinhetaGatilho,
} from './vinhetas';

function formatDataExecucaoWebservice(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
  erro: string | null;
}

export function usePlayer(): UsePlayerState {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);
  const status = useAppStore((s) => s.status);
  const pdv = useAppStore((s) => s.pdv);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);

  const [faixaAtual, setFaixaAtual] = useState<MusicaCompleta | null>(null);
  const [playlistAmbiente, setPlaylistAmbiente] = useState<Playlist | null>(null);
  const [modoUi, setModoUi] = useState<'ambient' | 'vinheta_vp' | 'vinheta_va'>('ambient');
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

  useEffect(() => {
    playlistPayloadRef.current = playlistData ?? null;
  }, [playlistData]);

  useEffect(() => {
    agendasRef.current = agendas ?? null;
  }, [agendas]);

  const bloqueadoReproducao =
    pingBloqueado ||
    pdv?.status === 'I' ||
    status === 'desativado' ||
    status === 'sincronizando' ||
    status === 'login' ||
    status === 'selecionar_pdv' ||
    status === 'erro';

  function erroPlay() {
    setErro('Não foi possível reproduzir o áudio.');
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

      try {
        await eng.play(url);
        setErro(null);
      } catch (err) {
        console.error(err);
        if (intent !== playbackIntentRef.current) return;
        if (eng !== engineRef.current) return;
        try {
          await eng.play(normalizePlaybackUrl(faixa.url_musica));
          setErro(null);
        } catch {
          if (intent !== playbackIntentRef.current) return;
          if (eng !== engineRef.current) return;
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
    } else {
      marcarVaFeita(chaveExecucaoVa(g.playlist.id, g.agenda));
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

  function tocarProximaFaixaAmbient() {
    const e = engineRef.current;
    const amb = ambienteRef.current;
    if (!e || !amb) return;

    const prox = pickRandomTrack(amb);
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
    enqueuePlayback(e, prox, amb.id, erroPlay);
  }

  function cicloAoTerminarFaixaAtual() {
    if (avancandoRef.current) return;
    avancandoRef.current = true;
    mixagemAgendadaRef.current = false;
    try {
      const tok = useAppStore.getState().token?.token;
      const cur = faixaRef.current;
      const amb = ambienteRef.current;

      const eraVin = modoRef.current === 'vinheta';

      if (tok && cur) {
        reportarFimMusica(tok, cur, 1);
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

  const setErroRef = useRef(setErro);
  setErroRef.current = setErro;

  fimFaixaHandlerRef.current = cicloAoTerminarFaixaAtual;

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
    playbackIntentRef.current += 1;
    mixagemGeracaoRef.current += 1;
    mixagemAgendadaRef.current = false;
    faixaRef.current = null;
    setFaixaAtual(null);

    if (!playlistData) {
      ambienteRef.current = null;
      setPlaylistAmbiente(null);
      setErro(null);
      modoRef.current = 'ambient';
      vinTipoUiRef.current = null;
      setModoUi('ambient');
      engineRef.current?.pause();
      bootstrapVpMsRef.current = null;
      playbackPlaylistIdRef.current = null;
      return;
    }

    const amb = pickAmbientFromResponse(playlistData);
    ambienteRef.current = amb;
    setPlaylistAmbiente(amb);

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
          const prox = pickRandomTrackExcluding(amb, excludeId);
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

          modoRef.current = 'ambient';
          vinTipoUiRef.current = null;
          setModoUi('ambient');
          faixaRef.current = prox;
          setFaixaAtual(prox);
          playbackPlaylistIdRef.current = amb.id;
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

  // Polling discreto pra VP no meio da faixa ambiente (~12 s)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (bloqueadoReproducao) return;
      /** Só durante reprodução ativa — com `pausado`, VP poderia iniciar nova faixa sobre o áudio pausado e brigava com resume/URL. */
      if (status !== 'tocando') return;
      if (avancandoRef.current) return;
      if (modoRef.current !== 'ambient') return;
      const pdata = playlistPayloadRef.current;
      if (!pdata?.playlists?.length) return;

      const boot = bootstrapVpMsRef.current ?? Date.now();

      const vin = encontrarProximaVinheta(
        pdata.playlists,
        agendasRef.current ?? [],
        new Date(),
        boot,
      );
      if (!vin) return;

      avancandoRef.current = true;
      try {
        interromperComVinheta(vin);
      } finally {
        avancandoRef.current = false;
      }
    }, 12_000);

    return () => clearInterval(id);
  }, [status, bloqueadoReproducao]);

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
      );
      if (vin && iniciarVinheta(vin)) {
        return;
      }

      const first = pickRandomTrack(amb);
      if (!first) {
        setErro('Nenhuma faixa com URL de áudio disponível.');
        return;
      }
      modoRef.current = 'ambient';
      setModoUi('ambient');
      cur = first;
      faixaRef.current = cur;
      setFaixaAtual(cur);
      playbackPlaylistIdRef.current = amb.id;
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
      if (st.pingBloqueado || st.pdv?.status === 'I') return;
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
    erro,
  };
}
