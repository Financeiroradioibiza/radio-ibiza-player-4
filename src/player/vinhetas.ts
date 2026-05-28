/**
 * VP (vinheta programada) e VA (vinheta agendada): regras a partir das agendas + playlists.
 *
 * Observação: servidor manda datas sem TZ — usamos horário local do navegador do PDV.
 */

import type { Agenda, Playlist } from '../types/webservice';

import { nomePastaParaTitulo } from '@/utils/playlistNomeExibicao';

const LS_VP_PREFIX = 'radio_ibiza_vp_last_';
const LS_VA = 'radio_ibiza_va_chaves_feitas';

export type VinhetaGatilho =
  | { kind: 'VA'; playlist: Playlist; agenda: Agenda }
  | { kind: 'VP'; playlist: Playlist; agenda: Agenda };

/**
 * Converte `dia_semana` do webservice para o mesmo índice que `Date#getDay()` (0=dom…6=sáb).
 * Aceita 0–6 no estilo JS **ou** 1–7 no estilo ISO-8601 (seg=1 … dom=7).
 * Valor não numérico → null (agenda não restringe o dia).
 */
export function normalizarDiaSemanaParaJs(ds: Agenda['dia_semana']): number | null {
  const n = Number(ds);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 6) return n;
  if (n >= 1 && n <= 7) return n === 7 ? 0 : n;
  return null;
}

export function extrairSomenteDataYmd(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  /** MySQL antigo usa `0000-00-00` como «sem data» — não tratar como data fixa real. */
  if (s === '0000-00-00') return null;
  return s;
}

function ymdLocalDe(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Se a agenda tem `data_agendada` E `data_fim` com datas distintas, é uma CAMPANHA
 * (toca todos os dias do período). Senão devolve null — vira regra de «dia exato».
 */
export function agendaCampanhaIntervalo(a: Agenda): { inicio: string; fim: string } | null {
  const ini = extrairSomenteDataYmd(a.data_agendada ?? undefined);
  const fim = extrairSomenteDataYmd(a.data_fim ?? undefined);
  if (!ini || !fim) return null;
  if (ini === fim) return null;
  return { inicio: ini, fim };
}

/**
 * 0 = domingo (como JS Date#getDay()). Mas em CAMPANHA (data_agendada + data_fim) o
 * painel costuma gravar `dia_semana=0` como «qualquer dia da semana» — tratamos assim
 * pra não bloquear vinhetas de campanha que devem tocar todos os dias.
 */
export function agendaCabeNoDiaSemana(a: Agenda, now: Date): boolean {
  const js = normalizarDiaSemanaParaJs(a.dia_semana);
  if (js === null) return true;
  if (js === 0 && agendaCampanhaIntervalo(a) !== null) return true;
  return js === now.getDay();
}

export function mesmoDiaAgenda(a: Agenda, now: Date): boolean {
  /** CAMPANHA: hoje precisa estar entre data_agendada e data_fim (inclusive). */
  const intervalo = agendaCampanhaIntervalo(a);
  if (intervalo) {
    const hoje = ymdLocalDe(now);
    return hoje >= intervalo.inicio && hoje <= intervalo.fim;
  }
  const d = extrairSomenteDataYmd(a.data_agendada ?? undefined);
  /** Vinheta recorrente só com dia da semana / horas — sem data fixa no JSON. */
  if (!d) return true;
  return d === ymdLocalDe(now);
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
 * VA: dia certo + dia da semana + dentro da janela horária da agenda.
 * (Antes só disparava numa janela de ~2 min após `hora_inicio` — fácil de perder entre faixas.)
 */
export function vaDentroDoSlotExecucao(a: Agenda, now: Date): boolean {
  if (!mesmoDiaAgenda(a, now)) return false;
  if (!agendaCabeNoDiaSemana(a, now)) return false;
  if (!dentroIntervaloHorasAgenda(a, now)) return false;
  return true;
}

/**
 * Chave de «já tocada». Usa o **dia local atual** (não `data_agendada`) — assim cada dia
 * de campanha tem chaves novas e a vinheta volta a ser elegível, em vez de marcar como
 * feita uma vez e bloquear o restante da campanha de 15 dias.
 */
export function chaveExecucaoVa(playlistId: number, ag: Agenda, now: Date = new Date()): string {
  return `${playlistId}|${ymdLocalDe(now)}|${ag.hora_inicio}`;
}

export function playlistsPorTipo(playlists: Playlist[], tipo: 'VP' | 'VA'): Playlist[] {
  return playlists.filter((p) => String(p.tipo).toUpperCase() === tipo);
}

/** Contador por agenda: quantas músicas ambiente já tocaram desde a última vinheta desta regra VP. */
const LS_VP_MUS_PREFIX = 'radio_ibiza_vp_mus_count_';

/**
 * VP pode ser por tempo (`tocar_cada` em minutos) ou por música ambiente quando o servidor
 * marca assim em `tipo_tocar` (ex.: valores com «musica» / «faixa» — extensível).
 *
 * O painel legado também grava abreviações como `"MUS"` (visto em `/agendas/` em produção).
 * Mantemos a heurística generosa: qualquer string começando em `mus` ou contendo `music`/`faixa`,
 * mais aliases curtos conhecidos.
 */
export function vpAgendaPorMusica(ag: Agenda): boolean {
  const raw = String(ag.tipo_tocar ?? '').trim();
  if (!raw) return false;
  const t = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (t.startsWith('mus') || t.includes('music') || t.includes('faixa')) return true;
  if (
    t === 'mq' ||
    t === 'por_musica' ||
    t === 'por_musicas' ||
    t.startsWith('q_music') ||
    t === 'pcm'
  ) {
    return true;
  }
  return false;
}

function lerVpMusCount(agendaId: number): number {
  const v = localStorage.getItem(LS_VP_MUS_PREFIX + agendaId);
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** Volta o contador a zero quando a vinheta VP disparou (aquela agenda). */
export function zerarVpMusCountAgenda(agendaId: number): void {
  localStorage.setItem(LS_VP_MUS_PREFIX + agendaId, '0');
}

/**
 * Incrementa contagens só para agendas VP «por música» que caibam neste momento (dia/janela).
 * Chamar quando uma faixa ambiente termina ou é salta antes da próxima.
 */
export function incrementarVpContadorPorMusicaAposFaixaAmbient(
  agendas: Agenda[],
  playlists: Playlist[],
  now: Date,
  programaId = 0,
): void {
  const merged = agendasVpComFallback(programaId, playlists, agendas);
  const vpIds = new Set(playlistsPorTipo(playlists, 'VP').map((p) => p.id));
  for (const ag of merged) {
    if (!vpIds.has(ag.playlist_id)) continue;
    if (!vpAgendaPorMusica(ag)) continue;
    if (!agendaCabeNoDiaSemana(ag, now)) continue;
    if (!dentroIntervaloHorasAgenda(ag, now)) continue;
    const cur = lerVpMusCount(ag.id);
    localStorage.setItem(LS_VP_MUS_PREFIX + ag.id, String(cur + 1));
  }
}

function faixasEntreVinhetasNecessarias(ag: Agenda): number {
  const n = Number(ag.tocar_cada);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/**
 * Agenda sintética quando o servidor não devolve `/agendas/` ligando a playlist VP —
 * permite tocar/resumir igual ao AS3 até haver programa real.
 *
 * Respeita `tocar_cada` e `tipo_tocar` no nível da playlist (o painel legado às vezes
 * grava só ali, sem criar linha completa em `/agendas/`). Quando não há nada definido,
 * cai no padrão histórico: a cada 1 música ambiente.
 */
export function criarAgendaVpFallback(
  programaId: number,
  playlistId: number,
  playlistCadencia?: { tocar_cada?: number | null; tipo_tocar?: string | null } | null,
): Agenda {
  const idSynth = -(playlistId + 1_000_000);
  const tocarCadaPlaylist = Number(playlistCadencia?.tocar_cada);
  const tocarCada =
    Number.isFinite(tocarCadaPlaylist) && tocarCadaPlaylist > 0
      ? Math.floor(tocarCadaPlaylist)
      : 1;
  const tipoTocarRaw = playlistCadencia?.tipo_tocar;
  const tipoTocar =
    tipoTocarRaw != null && String(tipoTocarRaw).trim() !== ''
      ? String(tipoTocarRaw)
      : 'musica_ambiente';
  return {
    id: idSynth,
    programa_id: Number.isFinite(programaId) && programaId > 0 ? programaId : 0,
    playlist_id: playlistId,
    dia_semana: 'todos',
    hora_inicio: '00:00:00',
    hora_fim: '23:59:59',
    tocar_cada: tocarCada,
    tipo_tocar: tipoTocar,
  };
}

/** Junta agendas reais do servidor + uma agenda implícita por cada VP órfã em relação ao /agendas/. */
export function agendasVpComFallback(programaId: number, playlists: Playlist[], agendas: Agenda[]): Agenda[] {
  const extra: Agenda[] = [];
  for (const pl of playlistsPorTipo(playlists, 'VP')) {
    if (agendasPorPlaylist(pl.id, agendas).length === 0) {
      extra.push(
        criarAgendaVpFallback(programaId, pl.id, {
          tocar_cada: pl.tocar_cada ?? null,
          tipo_tocar: pl.tipo_tocar ?? null,
        }),
      );
    }
  }
  return extra.length === 0 ? agendas : agendas.concat(extra);
}

const DIAS_SEMANA_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;

export function legendaDiaSemanaAgenda(ag: Agenda): string {
  const js = normalizarDiaSemanaParaJs(ag.dia_semana);
  if (js === null) return 'Todos os dias da semana';
  return `${DIAS_SEMANA_PT[js] ?? DIAS_SEMANA_PT[0]}`;
}

export function textoPeriodicidadeVp(ag: Agenda): string {
  if (vpAgendaPorMusica(ag)) {
    const n = faixasEntreVinhetasNecessarias(ag);
    return n <= 1
      ? 'A cada música ambiente (após cada faixa de ambiente)'
      : `A cada ${n} músicas de ambiente`;
  }
  const min = intervaloVpMinutos(ag);
  return min <= 1 ? 'Aproximadamente a cada minuto (agenda)' : `A cada ${min} minutos`;
}

function formatoHoraCurta(h: string): string {
  const p = String(h || '00:00:00').split(':');
  const hh = p[0] ?? '00';
  const mm = p[1] ?? '00';
  return `${hh}:${mm}`;
}

/** Resumo único por linha de agenda de vinheta para a UI — sem texto técnico (/agendas/, tipo_tocar, …). */
export type VinhetaResumoLinha = {
  key: string;
  /** Playlist VP/VA no cadastro — útil para deduplicar linhas na UI. */
  playlistId: number;
  tipo: 'VP' | 'VA';
  nomePasta: string;
  tituloExibicao: string;
  /** Tag da faixa (`musica.titulo`) para botões — não o nome da pasta no servidor. */
  rotuloBotaoTag: string;
  rotuloTipo: string;
  horarioLinha: string;
  /** VP: cadência · VA: data + disparo */
  detalhe?: string;
  /** Agenda sintética: servidor/provedor sem linha de grade — aviso opcional bem curto. */
  avisoGradeOpcional?: string;
  faixaExemplos: string[];
};

function primeiroTituloTagMusica(pl: Playlist): string {
  for (const mc of pl.musicas ?? []) {
    const t = String(mc.musica?.titulo ?? '').trim();
    if (t) return t;
  }
  return nomePastaParaTitulo(pl.nome);
}

export function resumoVinhetasProgramacao(playlists: Playlist[], agendas: Agenda[], programaId = 0): VinhetaResumoLinha[] {
  const out: VinhetaResumoLinha[] = [];

  function uma(pl: Playlist, ag: Agenda, tipo: 'VP' | 'VA'): void {
    const nomePasta = pl.nome;
    const tituloExibicao = nomePastaParaTitulo(pl.nome);
    const rotuloBotaoTag = primeiroTituloTagMusica(pl);
    const rotuloTipo = tipo === 'VP' ? 'Vinheta programada' : 'Vinheta agendada';
    const horarioLinha = `${legendaDiaSemanaAgenda(ag)} · ${formatoHoraCurta(ag.hora_inicio)} – ${formatoHoraCurta(ag.hora_fim)}`;

    let detalhe: string | undefined;
    let avisoGradeOpcional: string | undefined;

    if (tipo === 'VP') {
      detalhe = textoPeriodicidadeVp(ag);
      if (ag.id < 0) {
        avisoGradeOpcional =
          'Aguardando horários definitivos na grade do servidor — o player usa espaçamento entre músicas até lá.';
      }
    } else {
      const d = extrairSomenteDataYmd(ag.data_agendada ?? undefined);
      detalhe = d
        ? `Marcada para ${d} · por volta de ${formatoHoraCurta(ag.hora_inicio)}`
        : `Disparo por volta de ${formatoHoraCurta(ag.hora_inicio)} (na janela do dia configurada).`;
    }

    const comUrl = pl.musicas.filter((m) => Boolean(m.url_musica?.trim()));
    const faixaExemplos =
      comUrl.length > 0 ? comUrl.slice(0, 4).map((m) => m.musica.titulo || 'Faixa') : [];

    out.push({
      key: `${tipo}-${pl.id}-${ag.id}`,
      playlistId: pl.id,
      tipo,
      nomePasta,
      tituloExibicao,
      rotuloBotaoTag,
      rotuloTipo,
      horarioLinha,
      detalhe,
      avisoGradeOpcional,
      faixaExemplos,
    });
  }

  for (const pl of playlistsPorTipo(playlists, 'VP')) {
    const rel = agendasPorPlaylist(pl.id, agendas);
    if (rel.length === 0) {
      uma(pl, criarAgendaVpFallback(programaId, pl.id), 'VP');
    } else {
      for (const ag of rel) {
        uma(pl, ag, 'VP');
      }
    }
  }
  for (const pl of playlistsPorTipo(playlists, 'VA')) {
    for (const ag of agendas.filter((x) => Number(x.playlist_id) === pl.id)) {
      uma(pl, ag, 'VA');
    }
  }

  return out;
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
      if (!vaDentroDoSlotExecucao(ag, now)) continue;
      const k = chaveExecucaoVa(pl.id, ag, now);
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
      if (vpAgendaPorMusica(ag)) {
        const need = faixasEntreVinhetasNecessarias(ag);
        if (lerVpMusCount(ag.id) < need) continue;
        return { kind: 'VP', playlist: pl, agenda: ag };
      }
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
  programaId = 0,
): VinhetaGatilho | null {
  const raw = agendas ?? [];
  const boot = bootstrapVpMs ?? now.getTime();
  const va = encontrarProximaVa(playlists, raw, now);
  if (va) return va;
  const merged = agendasVpComFallback(programaId, playlists, raw);
  return encontrarProximaVp(playlists, merged, now, boot);
}

/**
 * Limpa contadores VP/VA persistidos quando o `programa.id` muda — evita vinheta da
 * campanha anterior disparar com cadência/contagem da programação antiga.
 */
export function reiniciarEstadoVinhetasNovaProgramacao(
  programaIdAnterior: number | null | undefined,
  programaIdNovo: number | null | undefined,
): void {
  const ant = Math.trunc(Number(programaIdAnterior ?? 0));
  const novo = Math.trunc(Number(programaIdNovo ?? 0));
  if (ant > 0 && novo > 0 && ant === novo) return;
  if (typeof localStorage === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(LS_VP_PREFIX) || k.startsWith(LS_VP_MUS_PREFIX) || k === LS_VA) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) localStorage.removeItem(k);
}
