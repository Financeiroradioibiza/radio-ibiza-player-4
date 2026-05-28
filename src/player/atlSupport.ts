/**
 * Apoio ao ATL manual e automático: limite por dia no cliente e comparar programação já em memória.
 */

import type { Agenda, Playlist, PlaylistResponse } from '@/types/webservice';

const LS_ATL_AUTO = 'ibiza-player-atl-auto-v1';

interface AtlAutoEstadoPersistido {
  /** Data local tipo `YYYY-MM-DD` quando `successCountToday` conta. */
  diaLocalYmd: string;
  /** ATLs automáticos concluídos com sucesso neste dia local (máx. {@link MAX_ATL_AUTO_DIA}). */
  successCountToday: number;
  /** Timestamp (ms) do último ATL automático com sucesso. */
  ultimoSucessoUtcMs: number;
}

/** Máximo de ATLs automáticos bem-sucedidos por dia (calendário local). */
export const MAX_ATL_AUTO_DIA = 3;

/** Espaço mínimo entre dois ATLs automáticos bem-sucedidos (evita 3 rajadas seguidas). */
export const MIN_INTERVALO_MS_ATL_AUTO = 2 * 60 * 60 * 1000;

export function diaLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lerPersistido(): AtlAutoEstadoPersistido {
  if (typeof localStorage === 'undefined') {
    return { diaLocalYmd: diaLocalISO(), successCountToday: 0, ultimoSucessoUtcMs: 0 };
  }
  try {
    const raw = localStorage.getItem(LS_ATL_AUTO);
    if (!raw) {
      return { diaLocalYmd: diaLocalISO(), successCountToday: 0, ultimoSucessoUtcMs: 0 };
    }
    const j = JSON.parse(raw) as Partial<AtlAutoEstadoPersistido>;
    const hoje = diaLocalISO();
    const dia = typeof j.diaLocalYmd === 'string' ? j.diaLocalYmd : hoje;
    const countRaw = typeof j.successCountToday === 'number' ? j.successCountToday : 0;
    const ult =
      typeof j.ultimoSucessoUtcMs === 'number' && Number.isFinite(j.ultimoSucessoUtcMs)
        ? j.ultimoSucessoUtcMs
        : 0;
    if (dia !== hoje) {
      return { diaLocalYmd: hoje, successCountToday: 0, ultimoSucessoUtcMs: ult };
    }
    return {
      diaLocalYmd: hoje,
      successCountToday: Math.max(0, Math.min(MAX_ATL_AUTO_DIA, countRaw)),
      ultimoSucessoUtcMs: ult,
    };
  } catch {
    return { diaLocalYmd: diaLocalISO(), successCountToday: 0, ultimoSucessoUtcMs: 0 };
  }
}

function gravar(est: AtlAutoEstadoPersistido): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_ATL_AUTO, JSON.stringify(est));
  } catch {
    /* quota / modo privado */
  }
}

export function podeEnfileirarAtlAutomatico(nowMs: number): { ok: true } | { ok: false } {
  let st = lerPersistido();
  const hoje = diaLocalISO();
  if (st.diaLocalYmd !== hoje) {
    st = {
      diaLocalYmd: hoje,
      successCountToday: 0,
      ultimoSucessoUtcMs: st.ultimoSucessoUtcMs,
    };
    gravar(st);
  }
  if (st.successCountToday >= MAX_ATL_AUTO_DIA) {
    return { ok: false };
  }
  if (
    st.ultimoSucessoUtcMs > 0 &&
    nowMs - st.ultimoSucessoUtcMs < MIN_INTERVALO_MS_ATL_AUTO
  ) {
    return { ok: false };
  }
  return { ok: true };
}

export function registrarAtlAutomaticoBemSucedido(nowMs: number): void {
  const hoje = diaLocalISO();
  const st = lerPersistido();
  const baseCount = st.diaLocalYmd === hoje ? st.successCountToday : 0;
  gravar({
    diaLocalYmd: hoje,
    successCountToday: Math.min(MAX_ATL_AUTO_DIA, baseCount + 1),
    ultimoSucessoUtcMs: nowMs,
  });
}

function fingerprintMusicaIds(pl: Playlist): string {
  const ids = (pl.musicas ?? [])
    .map((m) => Math.trunc(Number(m?.musica?.id)))
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b);
  return ids.join(',');
}

function fingerprintPlaylistResponse(p: PlaylistResponse): string {
  const pid = p.programa?.id ?? '';
  const partes = (p.playlists ?? []).map((pl) => {
    const t = String(pl.tipo).toUpperCase();
    const cad = `${pl.tocar_cada ?? ''}:${pl.tipo_tocar ?? ''}`;
    return `${pl.id}:${t}:${pl.musicas?.length ?? 0}:${cad}:${fingerprintMusicaIds(pl)}`;
  });
  partes.sort();
  return `${pid}|${partes.join(';')}`;
}

function fingerprintAgendas(xs: Agenda[]): string {
  const partes = xs.map(
    (a) =>
      `${a.id}:${a.playlist_id}:${String(a.dia_semana)}:${a.hora_inicio}:${a.hora_fim}:${a.data_agendada ?? ''}:${a.data_fim ?? ''}`,
  );
  partes.sort();
  return partes.join('||');
}

/** `true` se playlist+agendas parecem iguais ao que já está no store (evita fila pendente no ATL auto). */
export function programacaoEspelhoDoStore(
  playlist: PlaylistResponse,
  agendas: Agenda[],
  atualPlaylist: PlaylistResponse | null,
  atualAgendas: Agenda[] | null,
): boolean {
  if (!atualPlaylist || !atualAgendas) return false;
  return (
    fingerprintPlaylistResponse(playlist) === fingerprintPlaylistResponse(atualPlaylist) &&
    fingerprintAgendas(agendas) === fingerprintAgendas(atualAgendas)
  );
}
