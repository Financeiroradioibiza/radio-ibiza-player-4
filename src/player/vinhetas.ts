/**
 * VP (vinheta programada) e VA (vinheta agendada): regras a partir das agendas + playlists.
 *
 * Observação: servidor manda datas sem TZ — usamos horário local do navegador do PDV.
 */

import type { Agenda, Playlist } from '../types/webservice';

const LS_VP_PREFIX = 'radio_ibiza_vp_last_';
const LS_VA = 'radio_ibiza_va_chaves_feitas';

export type VinhetaGatilho =
  | { kind: 'VA'; playlist: Playlist; agenda: Agenda }
  | { kind: 'VP'; playlist: Playlist; agenda: Agenda };

function normDiaSemana(ds: Agenda['dia_semana']): number | null {
  const n = Number(ds);
  return Number.isFinite(n) ? n : null;
}

/** 0 = domingo (como JS Date#getDay()). */
export function agendaCabeNoDiaSemana(a: Agenda, now: Date): boolean {
  const n = normDiaSemana(a.dia_semana);
  if (n === null) return true;
  return n === now.getDay();
}

export function extrairSomenteDataYmd(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function mesmoDiaAgenda(a: Agenda, now: Date): boolean {
  const d = extrairSomenteDataYmd(a.data_agendada ?? undefined);
  if (!d) return false;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return d === `${y}-${m}-${day}`;
}

export function parseHoraParaMinutosDia(h: string): number {
  const parts = String(h || '00:00:00').split(':').map(Number);
  const hh = Number.isFinite(parts[0]) ? parts[0] : 0;
  const mm = Number.isFinite(parts[1]) ? parts[1] : 0;
  return hh * 60 + mm;
}

/** Janela [hora_inicio, hora_fim] no dia local; suporta passar-meia-noite aproximada. */
export function dentroIntervaloHorasAgenda(a: Agenda, now: Date): boolean {
  const ini = parseHoraParaMinutosDia(a.hora_inicio || '00:00:00');
  const fim = parseHoraParaMinutosDia(a.hora_fim || '23:59:59');
  const cur = parseHoraParaMinutosDia(
    `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:00`,
  );
  if (fim < ini) {
    return cur >= ini || cur <= fim;
  }
  return cur >= ini && cur <= fim;
}

/**
 * VA: já é o dia certo + dia da semana + janela de horário opcional da agenda +
 * estar nos primeiros 90s depois do horário agendado (hora_inicio).
 */
export function vaNaJanelaDeDisparo(a: Agenda, now: Date): boolean {
  if (!mesmoDiaAgenda(a, now)) return false;
  if (!agendaCabeNoDiaSemana(a, now)) return false;
  if (!dentroIntervaloHorasAgenda(a, now)) return false;

  const iniMin = parseHoraParaMinutosDia(a.hora_inicio || '00:00:00');
  const curMin =
    parseHoraParaMinutosDia(
      `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:00`,
    ) + now.getSeconds() / 60;
  const tgtMin = iniMin;

  const diffSeg = (curMin - tgtMin) * 60;
  return diffSeg >= -2 && diffSeg < 120;
}

export function chaveExecucaoVa(playlistId: number, ag: Agenda): string {
  return `${playlistId}|${String(ag.data_agendada ?? '')}|${ag.hora_inicio}`;
}

export function playlistsPorTipo(playlists: Playlist[], tipo: 'VP' | 'VA'): Playlist[] {
  return playlists.filter((p) => String(p.tipo).toUpperCase() === tipo);
}

function agendasPorPlaylist(pid: number, agendas: Agenda[]): Agenda[] {
  return agendas.filter((x) => Number(x.playlist_id) === pid);
}

export function carregarVaFeitas(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_VA);
    const arr = JSON.parse(raw || '[]') as unknown;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function marcarVaFeita(chave: string): void {
  const s = carregarVaFeitas();
  s.add(chave);
  const arr = [...s].slice(-800);
  localStorage.setItem(LS_VA, JSON.stringify(arr));
}

export function lerUltimoVpMs(playlistId: number): number | null {
  const v = localStorage.getItem(LS_VP_PREFIX + String(playlistId));
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function gravarUltimoVpMs(playlistId: number, ms: number): void {
  localStorage.setItem(LS_VP_PREFIX + String(playlistId), String(ms));
}

function intervaloVpMinutos(ag: Agenda): number {
  const m = Number(ag.tocar_cada);
  return Number.isFinite(m) && m > 0 ? m : 15;
}

/**
 * Decide se uma VP deve tocar agora (`baseMs` = último disparo gravado ou `bootstrapMs`).
 */
export function vpDeveDispararAgora(
  ag: Agenda,
  nowMs: number,
  baseMs: number,
): boolean {
  const intervalo = intervaloVpMinutos(ag) * 60_000;
  return nowMs - baseMs >= intervalo;
}

/**
 * Primeira vinheta agendada (VA) válida não executada neste client.
 */
export function encontrarProximaVa(
  playlists: Playlist[],
  agendas: Agenda[],
  now: Date,
): VinhetaGatilho | null {
  if (!agendas.length) return null;
  const feitas = carregarVaFeitas();
  const vaPl = playlistsPorTipo(playlists, 'VA');
  for (const pl of vaPl) {
    if (!pl.musicas?.some((m) => m.url_musica)) continue;
    const rel = agendasPorPlaylist(pl.id, agendas);
    for (const ag of rel) {
      if (!vaNaJanelaDeDisparo(ag, now)) continue;
      const k = chaveExecucaoVa(pl.id, ag);
      if (feitas.has(k)) continue;
      return { kind: 'VA', playlist: pl, agenda: ag };
    }
  }
  return null;
}

/**
 * Primeira vinheta programada (VP) cuja periodicidade já venceu.
 */
export function encontrarProximaVp(
  playlists: Playlist[],
  agendas: Agenda[],
  now: Date,
  bootstrapMs: number,
): VinhetaGatilho | null {
  if (!agendas.length) return null;
  const nowMs = now.getTime();
  const vpPl = playlistsPorTipo(playlists, 'VP');
  for (const pl of vpPl) {
    if (!pl.musicas?.some((m) => m.url_musica)) continue;
    const rel = agendasPorPlaylist(pl.id, agendas);
    for (const ag of rel) {
      if (!agendaCabeNoDiaSemana(ag, now)) continue;
      if (!dentroIntervaloHorasAgenda(ag, now)) continue;
      const last = lerUltimoVpMs(pl.id);
      const base = last ?? bootstrapMs;
      if (!vpDeveDispararAgora(ag, nowMs, base)) continue;
      return { kind: 'VP', playlist: pl, agenda: ag };
    }
  }
  return null;
}

/** VA tem prioridade sobre VP */
export function encontrarProximaVinheta(
  playlists: Playlist[],
  agendas: Agenda[] | null | undefined,
  now = new Date(),
  bootstrapVpMs?: number,
): VinhetaGatilho | null {
  const ags = agendas ?? [];
  const boot = bootstrapVpMs ?? now.getTime();
  const va = encontrarProximaVa(playlists, ags, now);
  if (va) return va;
  return encontrarProximaVp(playlists, ags, now, boot);
}
