/**
 * Normaliza JSON bruto de /playlist/ e /agendas/ para os tipos do cliente.
 * O CakePHP antigo mistura string/number e formatos alternativos.
 */

import type {
  Agenda,
  AgendaResponse,
  Artista,
  FlagSN,
  Musica,
  MusicaCompleta,
  Playlist,
  PlaylistResponse,
  Programa,
  TipoPlaylist,
} from '../types/webservice';

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v);
}

function toFlag(v: unknown): FlagSN {
  return v === 'N' ? 'N' : 'S';
}

function toTipoPlaylist(v: unknown): TipoPlaylist {
  const raw = String(v ?? 'N').trim();
  if (!raw) return 'N';
  const u = raw.toUpperCase();
  /** Normaliza rótulos do painel legado («VINHETAS-PROGRAMADAS», espaços e hífens). */
  const compact = u.replace(/\s+/g, '_').replace(/-/g, '_');

  if (compact === 'N' || compact === 'NORMAL') return 'N';
  if (compact === 'VP' || compact === 'VA') return compact as TipoPlaylist;

  if (compact === 'VINHETAS_PROGRAMADAS' || compact === 'VINHETA_PROGRAMADA') {
    return 'VP';
  }
  if (compact === 'VINHETAS_AGENDADAS' || compact === 'VINHETA_AGENDADA') {
    return 'VA';
  }

  const c = compact;
  if (c.includes('VINHET') && (c.includes('PROGRAMAD') || c.includes('PROGRAM'))) return 'VP';
  if (c.includes('VINHET') && (c.includes('AGENDAD') || c.includes('AGENDAR'))) return 'VA';

  return 'N';
}

/** `playlist_musica_id` às vezes vem direto, às vezes só em `PlaylistMusica.id`. */
function pickPlaylistMusicaIdString(raw: Record<string, unknown>): string {
  const d = raw.playlist_musica_id;
  if (d != null && String(d).trim() !== '' && String(d).trim() !== '0') {
    return toStr(raw.playlist_musica_id);
  }
  const nest = raw.PlaylistMusica;
  if (nest && typeof nest === 'object' && !Array.isArray(nest)) {
    const id = (nest as Record<string, unknown>).id;
    if (id != null && String(id).trim() !== '' && String(id).trim() !== '0') {
      return toStr(id);
    }
  }
  if (raw.playlist_musicas_id != null) return toStr(raw.playlist_musicas_id);
  return toStr(raw.playlist_musica_id);
}

function coerceMusica(raw: Record<string, unknown>): Musica {
  return {
    id: toNum(raw.id),
    playlist_musica_id: pickPlaylistMusicaIdString(raw),
    titulo: toStr(raw.titulo, 'Sem título'),
    nome_arquivo: toStr(raw.nome_arquivo),
    tamanho_arquivo: toStr(raw.tamanho_arquivo, '0'),
    duracao: toStr(raw.duracao, '00:00:00'),
    corte: toStr(raw.corte, '0'),
    downloaded: raw.downloaded === '1' || raw.downloaded === 1 ? '1' : '0',
  };
}

function coerceArtista(raw: Record<string, unknown>): Artista {
  return {
    id: toNum(raw.id),
    nome: toStr(raw.nome, 'Artista'),
    foto: toStr(raw.foto),
  };
}

function coerceMusicaCompleta(raw: Record<string, unknown>): MusicaCompleta | null {
  const musicaObj = raw.musica;
  if (!musicaObj || typeof musicaObj !== 'object' || Array.isArray(musicaObj)) return null;
  const artistaObj = raw.artista;
  const artista =
    artistaObj && typeof artistaObj === 'object' && !Array.isArray(artistaObj)
      ? coerceArtista(artistaObj as Record<string, unknown>)
      : ({ id: 0, nome: '', foto: '' } satisfies Artista);

  let musica = coerceMusica(musicaObj as Record<string, unknown>);
  if (!String(musica.playlist_musica_id).trim() && raw.playlist_musica_id != null) {
    musica = { ...musica, playlist_musica_id: toStr(raw.playlist_musica_id) };
  }

  return {
    musica,
    artista,
    url_musica: toStr(raw.url_musica),
  };
}

function coercePlaylist(raw: Record<string, unknown>): Playlist {
  const musicasRaw = raw.musicas;
  const musicas: MusicaCompleta[] = [];
  /**
   * Dedup por `musica.id`: endpoints de vinhetas devolvem a mesma faixa repetida (1 cópia
   * por linha de agenda); sem isso o sorteio ficaria viciado e tocaria a mesma N vezes
   * antes de pensar em outra.
   */
  const idsVistos = new Set<number>();
  if (Array.isArray(musicasRaw)) {
    for (const m of musicasRaw) {
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        const c = coerceMusicaCompleta(m as Record<string, unknown>);
        if (!c?.url_musica) continue;
        const mid = Math.trunc(Number(c.musica.id));
        if (Number.isFinite(mid)) {
          if (idsVistos.has(mid)) continue;
          idsVistos.add(mid);
        }
        musicas.push(c);
      }
    }
  }

  /** Cadência «por playlist» (campos que VP/VA podem trazer fora do `/agendas/`). */
  const tocarCadaRaw = raw.tocar_cada;
  const tipoTocarRaw = raw.tipo_tocar;
  let tocarCada: number | null = null;
  if (tocarCadaRaw != null && tocarCadaRaw !== '') {
    const n = Number(tocarCadaRaw);
    tocarCada = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }
  const tipoTocar = tipoTocarRaw != null && String(tipoTocarRaw).trim() !== '' ? String(tipoTocarRaw) : null;

  return {
    id: toNum(raw.id),
    nome: toStr(raw.nome, 'Playlist'),
    tipo: toTipoPlaylist(raw.tipo),
    tocar_sempre: toFlag(raw.tocar_sempre),
    tempo_total: toStr(raw.tempo_total, '00:00:00'),
    musicas,
    tocar_cada: tocarCada,
    tipo_tocar: tipoTocar,
  };
}

function coercePrograma(raw: Record<string, unknown>): Programa {
  const base = { ...raw };
  return {
    ...base,
    id: toNum(raw.id),
    nome: toStr(raw.nome, 'Programa'),
    cliente_id:
      raw.cliente_id !== undefined && raw.cliente_id !== null
        ? toNum(raw.cliente_id)
        : undefined,
  } as Programa;
}

export type PlaylistCoerceResult =
  | { ok: true; data: PlaylistResponse }
  | { ok: false; error: string };

/**
 * Interpreta GET /playlist/ — falhas lógicas vêm só com `mensagem` ou sem `playlists`.
 */
export function coercePlaylistResponse(raw: unknown): PlaylistCoerceResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'resposta_invalida' };
  }
  const o = raw as Record<string, unknown>;

  if (
    typeof o.mensagem === 'string' &&
    o.mensagem.length > 0 &&
    !Array.isArray(o.playlists)
  ) {
    return { ok: false, error: o.mensagem };
  }

  const playlistsRaw = o.playlists;
  if (!Array.isArray(playlistsRaw)) {
    return { ok: false, error: 'playlists_ausentes' };
  }

  let programa: Programa;
  if (o.programa && typeof o.programa === 'object' && !Array.isArray(o.programa)) {
    programa = coercePrograma(o.programa as Record<string, unknown>);
  } else {
    programa = { id: 0, nome: '?' };
  }

  const playlists: Playlist[] = [];
  for (const p of playlistsRaw) {
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      playlists.push(coercePlaylist(p as Record<string, unknown>));
    }
  }

  return {
    ok: true,
    data: {
      programa,
      playlists,
      mensagem: typeof o.mensagem === 'string' ? o.mensagem : undefined,
    },
  };
}

/** CakePHP costuma aninhar `Playlist.id` em vez de `playlist_id` plano. */
function playlistIdDeAgendaRaw(raw: Record<string, unknown>): number {
  const flat = toNum(raw.playlist_id ?? raw.playlistId, 0);
  if (flat > 0) return flat;
  const nest = raw.Playlist ?? raw.playlist;
  if (nest && typeof nest === 'object' && !Array.isArray(nest)) {
    const id = toNum((nest as Record<string, unknown>).id, 0);
    if (id > 0) return id;
  }
  return 0;
}

function coerceAgenda(raw: Record<string, unknown>): Agenda {
  const ds = raw.dia_semana ?? raw.diaSemana ?? raw.DiaSemana;
  const diaSemana: number | string =
    typeof ds === 'number' || typeof ds === 'string' ? ds : toNum(ds, 0);

  return {
    id: toNum(raw.id ?? raw.Id, 0),
    programa_id: toNum(raw.programa_id ?? raw.programaId ?? raw.ProgramaId, 0),
    playlist_id: playlistIdDeAgendaRaw(raw),
    dia_semana: diaSemana,
    hora_inicio: toStr(raw.hora_inicio ?? raw.HoraInicio ?? raw.horaInicio, '00:00:00'),
    hora_fim: toStr(raw.hora_fim ?? raw.HoraFim ?? raw.horaFim, '23:59:59'),
    data_agendada:
      raw.data_agendada != null
        ? String(raw.data_agendada)
        : raw.dataAgendada != null
          ? String(raw.dataAgendada)
          : undefined,
    data_fim:
      raw.data_fim != null ? String(raw.data_fim) : raw.dataFim != null ? String(raw.dataFim) : undefined,
    tocar_cada:
      raw.tocar_cada !== undefined && raw.tocar_cada !== null
        ? toNum(raw.tocar_cada)
        : raw.tocarCada !== undefined && raw.tocarCada !== null
          ? toNum(raw.tocarCada)
          : undefined,
    tipo_tocar:
      raw.tipo_tocar != null
        ? String(raw.tipo_tocar)
        : raw.tipoTocar != null
          ? String(raw.tipoTocar)
          : undefined,
  };
}

function agendaRowLooksLike(row: unknown): boolean {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const o = row as Record<string, unknown>;
  /** Linha "agenda" plana, com playlist_id direto ou em `Playlist.id`. */
  if (toNum(o.playlist_id ?? o.playlistId, 0) > 0) return true;
  /** Wrapper aninhado `{ agenda: {...} }` (Cake hasMany child) */
  if (o.agenda && typeof o.agenda === 'object' && !Array.isArray(o.agenda)) {
    const inner = o.agenda as Record<string, unknown>;
    if (toNum(inner.playlist_id ?? inner.playlistId, 0) > 0) return true;
  }
  return false;
}

function coerceAgendaRowsFromList(list: unknown[]): Agenda[] {
  const out: Agenda[] = [];
  for (const row of list) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const rec = row as Record<string, unknown>;
      /** Cake retorna cada filho como `{ agenda: { ... } }` — desembrulha antes do coerce. */
      const inner = rec.agenda;
      const target =
        inner && typeof inner === 'object' && !Array.isArray(inner)
          ? (inner as Record<string, unknown>)
          : rec;
      if (!agendaRowLooksLike(target)) continue;
      out.push(coerceAgenda(target));
    }
  }
  return out;
}

/**
 * Formato real do `/agendas/` (CakePHP 2): array no topo, um objeto por playlist com
 * `Playlist.Agendas[]` aninhado e cada linha em `{ agenda: {...} }`. Achatamos tudo aqui,
 * preservando `playlist_id` e `programa_id` da `Playlist` mãe quando falta na linha.
 */
function coerceAgendasFromNestedPlaylistResponse(raw: unknown[]): Agenda[] {
  const out: Agenda[] = [];
  for (const wrapper of raw) {
    if (!wrapper || typeof wrapper !== 'object' || Array.isArray(wrapper)) continue;
    const w = wrapper as Record<string, unknown>;
    const pl = w.Playlist ?? w.playlist;
    if (!pl || typeof pl !== 'object' || Array.isArray(pl)) continue;
    const plObj = pl as Record<string, unknown>;
    const plId = toNum(plObj.id, 0);
    const programaIdFallback = toNum(plObj.programa_id, 0);
    const agendasNested = plObj.Agendas ?? plObj.agendas;
    if (!Array.isArray(agendasNested)) continue;
    for (const item of agendasNested) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const itemObj = item as Record<string, unknown>;
      const ag =
        (itemObj.agenda as Record<string, unknown> | undefined) ??
        (itemObj.Agenda as Record<string, unknown> | undefined) ??
        itemObj;
      if (!ag || typeof ag !== 'object') continue;
      const rec: Record<string, unknown> = { ...(ag as Record<string, unknown>) };
      if (!rec.playlist_id && plId > 0) rec.playlist_id = plId;
      if (!rec.programa_id && programaIdFallback > 0) rec.programa_id = programaIdFallback;
      out.push(coerceAgenda(rec));
    }
  }
  return out;
}

/** Top-level com objetos `{ Playlist: { ..., Agendas: [...] } }`? */
function pareceListaAninhadaPlaylist(arr: unknown[]): boolean {
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const w = item as Record<string, unknown>;
    const pl = w.Playlist ?? w.playlist;
    if (pl && typeof pl === 'object' && !Array.isArray(pl)) {
      const plObj = pl as Record<string, unknown>;
      if (plObj.Agendas !== undefined || plObj.agendas !== undefined) return true;
    }
  }
  return false;
}

/** Junta várias listas (ex.: GET agendas e GETs de vinhetas) — mesmo `id` de agenda: a última lista ganha. */
export function mergeAgendasPorId(...listas: Agenda[][]): Agenda[] {
  const map = new Map<number, Agenda>();
  for (const lista of listas) {
    for (const a of lista) {
      const id = Math.trunc(Number(a.id));
      if (!Number.isFinite(id)) continue;
      map.set(id, a);
    }
  }
  return [...map.values()];
}

/**
 * Extrai lista de agendas de vários formatos do webservice CakePHP:
 * - Top-level: `[{ Playlist: { ..., Agendas: [{ agenda: {...} }, ...] } }, ...]` (Cake find('all') aninhado)
 * - Top-level: array plano de linhas de agenda
 * - Body com chaves `agendas`, `Agendas`, `cronograma`, `Cronograma`, `lista`, `dados`...
 * - `mensagem` como lista de objetos
 * - Chaves dinâmicas com arrays de linhas
 */
export function coerceAgendasList(raw: unknown): Agenda[] {
  if (raw == null) return [];

  const out: Agenda[] = [];
  const seen = new Set<string>();
  const empurrar = (lista: Agenda[]): void => {
    for (const ag of lista) {
      const k = `${ag.id}|${ag.playlist_id}|${ag.hora_inicio}|${String(ag.data_agendada ?? '')}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(ag);
    }
  };

  if (Array.isArray(raw)) {
    if (pareceListaAninhadaPlaylist(raw)) {
      empurrar(coerceAgendasFromNestedPlaylistResponse(raw));
      if (out.length > 0) return out;
    }
    empurrar(coerceAgendaRowsFromList(raw));
    return out;
  }
  if (typeof raw !== 'object') return [];
  const body = raw as AgendaResponse & Record<string, unknown>;

  const candidates: unknown[] = [];

  const tryAdd = (v: unknown): void => {
    if (Array.isArray(v) && v.length > 0) candidates.push(v);
  };

  tryAdd(body.agendas);
  tryAdd(body.Agendas);
  tryAdd(body.cronograma);
  tryAdd(body.Cronograma);
  tryAdd(body.lista);
  tryAdd(body.Lista);
  tryAdd(body.dados);
  tryAdd(body.Dados);

  if (
    Array.isArray(body.mensagem) &&
    body.mensagem.length > 0 &&
    typeof body.mensagem[0] === 'object'
  ) {
    candidates.push(body.mensagem);
  }

  /** Alguns endpoints devolvem chaves dinâmicas com arrays de linhas. */
  if (candidates.length === 0) {
    for (const v of Object.values(body)) {
      if (!Array.isArray(v) || v.length === 0) continue;
      if (typeof v[0] === 'object' && v[0] !== null && (agendaRowLooksLike(v[0]) || pareceListaAninhadaPlaylist(v))) {
        candidates.push(v);
      }
    }
  }

  for (const list of candidates) {
    const arr = list as unknown[];
    if (pareceListaAninhadaPlaylist(arr)) {
      empurrar(coerceAgendasFromNestedPlaylistResponse(arr));
    } else {
      empurrar(coerceAgendaRowsFromList(arr));
    }
  }
  return out;
}

/**
 * Mescla pastas VP/VA vindas de `/vinhetas_programadas/` e `/vinhetas_agendadas/` sobre o `/playlist/`.
 * O player AIR antigo lia esses endpoints à parte; no painel o cronograma de vinhetas pode vir só neles.
 *
 * Para a versão final mantemos as músicas com mais conteúdo, mas combinamos a cadência
 * (`tocar_cada` / `tipo_tocar`) — alguns endpoints só populam um dos lados.
 */
export function mergePlaylistsPlaylistComVinhetas(
  primarias: Playlist[],
  extrasPacks: PlaylistResponse[],
): Playlist[] {
  const map = new Map<number, Playlist>();
  for (const pl of primarias) map.set(pl.id, pl);
  for (const pack of extrasPacks) {
    for (const pl of pack.playlists) {
      const t = String(pl.tipo).toUpperCase();
      if (t !== 'VP' && t !== 'VA') continue;
      const prev = map.get(pl.id);
      const prevN = prev?.musicas?.filter((m) => Boolean(m.url_musica?.trim())).length ?? 0;
      const nextN = pl.musicas?.filter((m) => Boolean(m.url_musica?.trim())).length ?? 0;
      const escolhida: Playlist = !prev || nextN >= prevN ? pl : prev;
      const outroLado: Playlist | undefined = escolhida === pl ? prev : pl;

      /** Cadência: usa o primeiro valor não-nulo entre os dois lados. */
      const tocarCadaCombinado =
        escolhida.tocar_cada != null && escolhida.tocar_cada > 0
          ? escolhida.tocar_cada
          : outroLado?.tocar_cada != null && outroLado.tocar_cada > 0
            ? outroLado.tocar_cada
            : null;
      const tipoTocarCombinado =
        escolhida.tipo_tocar != null && String(escolhida.tipo_tocar).trim() !== ''
          ? escolhida.tipo_tocar
          : outroLado?.tipo_tocar != null && String(outroLado.tipo_tocar).trim() !== ''
            ? outroLado.tipo_tocar
            : null;

      map.set(pl.id, {
        ...escolhida,
        tocar_cada: tocarCadaCombinado,
        tipo_tocar: tipoTocarCombinado,
      });
    }
  }
  return [...map.values()];
}

/**
 * Remove VP/VA «órfãs» que só entraram pelo merge de `/vinhetas_*` (restos de programação
 * antiga no servidor) mas já não existem no `/playlist/` nem têm agenda do programa actual.
 *
 * Mantém vinheta só-via-endpoint legítima: playlist ausente em `/playlist/` porém com agenda
 * em `/agendas/` (ou `/vinhetas_*`) cujo `programa_id` bate com o pacote actual.
 */
export function filtrarVinhetasOrfasDoPacote(
  playlist: PlaylistResponse,
  agendas: Agenda[],
  playlistIdsPrimarias: ReadonlySet<number>,
): { playlist: PlaylistResponse; agendas: Agenda[] } {
  const programaId = Math.trunc(Number(playlist.programa?.id ?? 0));

  let agendasFiltradas = agendas;
  if (programaId > 0) {
    agendasFiltradas = agendas.filter((a) => {
      const pg = Math.trunc(Number(a.programa_id ?? 0));
      return pg === 0 || pg === programaId;
    });
  }

  const idsComAgendaNoPrograma = new Set(
    agendasFiltradas
      .map((a) => Math.trunc(Number(a.playlist_id)))
      .filter((id) => id > 0),
  );

  const playlistsFiltradas = (playlist.playlists ?? []).filter((pl) => {
    const tipo = String(pl.tipo).toUpperCase();
    if (tipo !== 'VP' && tipo !== 'VA') return true;
    const id = Math.trunc(Number(pl.id));
    if (id <= 0) return false;
    if (playlistIdsPrimarias.has(id)) return true;
    return idsComAgendaNoPrograma.has(id);
  });

  const idsPlaylistsValidas = new Set(
    playlistsFiltradas.map((p) => Math.trunc(Number(p.id))).filter((id) => id > 0),
  );

  agendasFiltradas = agendasFiltradas.filter((a) =>
    idsPlaylistsValidas.has(Math.trunc(Number(a.playlist_id))),
  );

  return {
    playlist: { ...playlist, playlists: playlistsFiltradas },
    agendas: agendasFiltradas,
  };
}
