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
  if (Array.isArray(musicasRaw)) {
    for (const m of musicasRaw) {
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        const c = coerceMusicaCompleta(m as Record<string, unknown>);
        if (c?.url_musica) musicas.push(c);
      }
    }
  }

  return {
    id: toNum(raw.id),
    nome: toStr(raw.nome, 'Playlist'),
    tipo: toTipoPlaylist(raw.tipo),
    tocar_sempre: toFlag(raw.tocar_sempre),
    tempo_total: toStr(raw.tempo_total, '00:00:00'),
    musicas,
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

function coerceAgenda(raw: Record<string, unknown>): Agenda {
  const ds = raw.dia_semana;
  const diaSemana: number | string =
    typeof ds === 'number' || typeof ds === 'string' ? ds : toNum(ds, 0);

  return {
    id: toNum(raw.id),
    programa_id: toNum(raw.programa_id),
    playlist_id: toNum(raw.playlist_id),
    dia_semana: diaSemana,
    hora_inicio: toStr(raw.hora_inicio, '00:00:00'),
    hora_fim: toStr(raw.hora_fim, '23:59:59'),
    data_agendada: raw.data_agendada != null ? String(raw.data_agendada) : undefined,
    data_fim: raw.data_fim != null ? String(raw.data_fim) : undefined,
    tocar_cada:
      raw.tocar_cada !== undefined && raw.tocar_cada !== null
        ? toNum(raw.tocar_cada)
        : undefined,
    tipo_tocar: raw.tipo_tocar != null ? String(raw.tipo_tocar) : undefined,
  };
}

/** Extrai lista de agendas de vários formatos possíveis do GET /agendas/. */
export function coerceAgendasList(raw: unknown): Agenda[] {
  if (!raw || typeof raw !== 'object') return [];
  const body = raw as AgendaResponse;

  let list: unknown;
  if (Array.isArray(body.agendas)) {
    list = body.agendas;
  } else if (
    Array.isArray(body.mensagem) &&
    body.mensagem.length > 0 &&
    typeof body.mensagem[0] === 'object'
  ) {
    list = body.mensagem;
  } else {
    return [];
  }

  const out: Agenda[] = [];
  for (const row of list as unknown[]) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      out.push(coerceAgenda(row as Record<string, unknown>));
    }
  }
  return out;
}
