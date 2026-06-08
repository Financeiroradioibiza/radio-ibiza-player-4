import type { Agenda, MusicaCompleta, Playlist, PlaylistResponse } from '../types/webservice';
import { isDebugRedeEnabled } from '../api/config';
import { isPastaAmbienteOperadorSelecionavel } from './pastaSelecionavel';
import {
  agendaCabeNoDiaSemana,
  dentroIntervaloHorasAgendaAmbiente,
  extrairSomenteDataYmd,
  mesmoDiaAgenda,
  parseHoraParaMinutosDia,
} from './vinhetas';

/** Regra de slot para pastas tipo N: data civil (`data_agendada`), dia da semana, janela horária; `data_fim` encerra campanha. */
function agendaAtivaParaSlotAmbiente(a: Agenda, now: Date): boolean {
  if (!mesmoDiaAgenda(a, now)) return false;
  if (!agendaCabeNoDiaSemana(a, now)) return false;
  if (!dentroIntervaloHorasAgendaAmbiente(a, now)) return false;
  const fim = extrairSomenteDataYmd(a.data_fim ?? undefined);
  if (fim) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    if (today > fim) return false;
  }
  return true;
}

/**
 * Entre agendas que caem no slot atual, o maior `hora_inicio` desempata o limite compartilhado
 * (ex.: 12:00 está em 00:00–12:00 e em 12:00–23:59 — vale a janela que começa às 12:00).
 */
function maiorHoraInicioAgendaAtivaParaPlaylist(
  playlistId: number,
  agendas: Agenda[],
  now: Date,
): number {
  let max = -1;
  for (const a of agendas) {
    if (Number(a.playlist_id) !== playlistId) continue;
    if (!agendaAtivaParaSlotAmbiente(a, now)) continue;
    const m = parseHoraParaMinutosDia(a.hora_inicio || '00:00:00');
    if (m > max) max = m;
  }
  return max;
}

/** Primeira playlist normal (N) com pelo menos uma música e URL de áudio. */
export function pickAmbientPlaylist(playlists: Playlist[]): Playlist | null {
  for (const p of playlists) {
    if (String(p.tipo).toUpperCase() !== 'N') continue;
    if (!p.musicas?.length) continue;
    if (p.musicas.some((m) => m.url_musica)) return p;
  }
  return null;
}

/** Quantas músicas ambiente recentes o sorteio tenta evitar (espírito do AS3 / «não repetir as últimas N»). */
export const AMBIENT_RANDOM_HISTORY_MAX = 12;

/** Sorteia uma faixa da playlist ambiente (comportamento alinhado ao AS3). */
export function pickRandomTrack(playlist: Playlist): MusicaCompleta | null {
  const comUrl = playlist.musicas.filter((m) => m.url_musica);
  if (comUrl.length === 0) return null;
  const i = Math.floor(Math.random() * comUrl.length);
  return comUrl[i] ?? null;
}

/**
 * Sorteia faixa com URL, evitando um conjunto de `musica.id` (ex.: atual + últimas N tocadas).
 * Se o filtro esvaziar a lista, volta ao conjunto completo com URL.
 */
export function pickRandomTrackAvoidingPool(
  playlist: Playlist,
  excludeIds: ReadonlySet<number> | readonly number[],
): MusicaCompleta | null {
  const ex = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  let comUrl = playlist.musicas.filter((m) => m.url_musica && !ex.has(Number(m.musica.id)));
  if (comUrl.length === 0) {
    comUrl = playlist.musicas.filter((m) => m.url_musica);
  }
  if (comUrl.length === 0) return null;
  const i = Math.floor(Math.random() * comUrl.length);
  return comUrl[i] ?? null;
}

/**
 * Como `pickRandomTrack`, mas evita repetir o id da música que está tocando (quando há outra opção).
 */
export function pickRandomTrackExcluding(
  playlist: Playlist,
  excludeMusicaId?: number,
): MusicaCompleta | null {
  if (excludeMusicaId === undefined || !Number.isFinite(excludeMusicaId)) {
    return pickRandomTrack(playlist);
  }
  return pickRandomTrackAvoidingPool(playlist, new Set([excludeMusicaId]));
}

/** Converte `duracao` do webservice (`HH:mm:ss`, `mm:ss` ou segundos) em segundos. */
export function parseDuracaoRelogio(seg: string): number {
  const s = seg.trim();
  if (!s) return 0;
  const parts = s.split(':').map((p) => Number(String(p).trim()));
  if (parts.length > 0 && parts.every((x) => Number.isFinite(x))) {
    if (parts.length >= 3) {
      const [h = 0, m = 0, sec = 0] = parts;
      return h * 3600 + m * 60 + sec;
    }
    if (parts.length === 2) {
      const [m = 0, sec = 0] = parts;
      return m * 60 + sec;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Primeira faixa com URL — vinhetas costumam ter uma música principal. */
export function pickVinhetaTrack(playlist: Playlist): MusicaCompleta | null {
  const xs = playlist.musicas?.filter((m) => m.url_musica) ?? [];
  return xs.length ? xs[Math.floor(Math.random() * xs.length)]! : null;
}

/**
 * Pasta ambiente efectiva quando o operador escolheu uma pasta cuja denominação contém
 * **Evento** ou **Extra** como palavra (ex.: apenas «EVENTO» ou «Evento - Dia de luxo») —
 * ignorando slot/mescla habitual; vinhetas seguem decididas pelo motor de VP/VA.
 */
export function pickAmbientWithExclusive(
  data: PlaylistResponse,
  agendas: Agenda[] | null | undefined,
  now: Date,
  exclusiveAmbientPlaylistId: number | null,
): { playlist: Playlist | null; shouldClearExclusive: boolean } {
  const slot = pickAmbientPlaylistForCurrentSlot(data.playlists, agendas, now);
  const ex =
    exclusiveAmbientPlaylistId !== null &&
    Number.isFinite(Number(exclusiveAmbientPlaylistId))
      ? Math.trunc(Number(exclusiveAmbientPlaylistId))
      : null;

  if (ex === null) {
    return { playlist: slot, shouldClearExclusive: false };
  }

  const cand = data.playlists.find(
    (p) =>
      p.id === ex &&
      String(p.tipo).toUpperCase() === 'N' &&
      Boolean(p.musicas?.some((m) => m.url_musica?.trim())),
  );

  if (cand != null && isPastaAmbienteOperadorSelecionavel(cand, agendas)) {
    return { playlist: cand, shouldClearExclusive: false };
  }

  return { playlist: slot, shouldClearExclusive: true };
}

export function pickAmbientFromResponse(
  data: PlaylistResponse,
  agendas?: Agenda[] | null,
  now: Date = new Date(),
): Playlist | null {
  return pickAmbientWithExclusive(data, agendas, now, null).playlist;
}

/** Diagnóstico só com `?debug_rede=1` (ou flag persistida): imprime uma vez por troca de pasta. */
let __ultimaPastaLogada: number | null = null;

/**
 * Junta N pastas ambiente numa playlist «virtual» com todas as músicas concatenadas
 * (deduplicadas por `musica.id`). É como o player AS3 original tratava o caso de
 * múltiplas pastas com «tocar sempre» ao mesmo tempo: o pool de embaralhamento
 * passa a ser a união, não uma pasta única.
 *
 * - `id` virtual é determinístico (hash dos `id` das origens ordenados) e negativo
 *   para não colidir com `id` reais da API. Estável entre renders enquanto o
 *   conjunto de origens for o mesmo — o que evita disparar troca de pasta no loop.
 * - `nome` exibido no header mostra «MIX · A · B» (até 2 nomes) ou «MIX · N PASTAS»
 *   (a partir de 3) para não estourar o display.
 */
function fundirPlaylistsAmbientes(origens: Playlist[]): Playlist {
  if (origens.length === 0) {
    throw new Error('fundirPlaylistsAmbientes: lista vazia.');
  }
  if (origens.length === 1) return origens[0]!;

  const idsOrdenados = origens.map((p) => p.id).slice().sort((a, b) => a - b);
  /** Hash multiplicativo simples — suficiente para diferenciar conjuntos distintos
   *  na prática (poucas dezenas de pastas por PDV). Negativo evita colisão com `id`
   *  reais da API, que são sempre positivos. */
  let hash = 0;
  for (const id of idsOrdenados) {
    hash = ((hash * 31) + id) | 0;
  }
  const idVirtual = -Math.abs(hash) || -1;

  const nomes = origens
    .map((p) => String(p.nome ?? '').trim().toUpperCase())
    .filter(Boolean);
  const nomeVirtual =
    nomes.length <= 2
      ? `MIX · ${nomes.join(' · ')}`
      : `MIX · ${nomes.length} PASTAS`;

  const musicasMescladas: MusicaCompleta[] = [];
  const idsMusicaVistos = new Set<number>();
  for (const p of origens) {
    for (const m of p.musicas ?? []) {
      const idMus = m?.musica?.id;
      if (typeof idMus !== 'number') continue;
      if (idsMusicaVistos.has(idMus)) continue;
      if (!m.url_musica?.trim()) continue;
      idsMusicaVistos.add(idMus);
      musicasMescladas.push(m);
    }
  }

  return {
    id: idVirtual,
    nome: nomeVirtual,
    tipo: 'N',
    /** Se qualquer pasta de origem é «tocar sempre», a virtual também é (para o caso de
     *  alguma decisão futura olhar essa flag). */
    tocar_sempre: origens.some((p) => String(p.tocar_sempre).toUpperCase() === 'S')
      ? 'S'
      : 'N',
    tempo_total: '00:00:00',
    musicas: musicasMescladas,
  };
}

/**
 * Escolhe a pasta ambiente (tipo N) ativa **neste instante** conforme `/agendas/`:
 *
 * 1. Se **uma ou mais** playlists tipo N têm linha de agenda casando com agora,
 *    todas entram no pool — em vez de escolher uma «vencedora», o player
 *    mescla as músicas e embaralha entre elas (espelha o comportamento do AS3
 *    quando o painel agenda pastas concorrentes no mesmo horário).
 * 2. Caso contrário, considera todas as «tocar sempre». Se houver 2+, idem
 *    mescla; se houver 1, retorna a própria.
 * 3. Sem slot nem «tocar sempre»: null (pastas só manuais / 00:00–00:00 aguardam «Selecionar»).
 */
export function pickAmbientPlaylistForCurrentSlot(
  playlists: Playlist[],
  agendas: Agenda[] | null | undefined,
  now: Date,
): Playlist | null {
  const ambientes = playlists.filter(
    (p) =>
      String(p.tipo).toUpperCase() === 'N' &&
      (p.musicas?.some((m) => Boolean(m.url_musica?.trim())) ?? false),
  );
  if (ambientes.length === 0) return null;

  const ag = agendas ?? [];
  const noSlot: Playlist[] = [];

  for (const pl of ambientes) {
    const rel = ag.filter((a) => Number(a.playlist_id) === pl.id);
    if (rel.length === 0) continue;
    const cabe = rel.some((a) => agendaAtivaParaSlotAmbiente(a, now));
    if (cabe) noSlot.push(pl);
  }

  let elegiveis: Playlist[];
  let motivo: string;
  if (noSlot.length > 0) {
    /** Slot tem 1+ pastas com agenda casando: mescla todas (ou retorna a única). */
    elegiveis =
      noSlot.length === 1
        ? [noSlot[0]!]
        : [...noSlot].sort((a, b) => {
            const mb = maiorHoraInicioAgendaAtivaParaPlaylist(b.id, ag, now);
            const ma = maiorHoraInicioAgendaAtivaParaPlaylist(a.id, ag, now);
            if (mb !== ma) return mb - ma;
            return a.id - b.id;
          });
    motivo = noSlot.length > 1 ? 'slot_atual_multiplas' : 'slot_atual';
  } else {
    /** Sem agenda casando: usa todas as «tocar sempre»; sem slot nem sempre → nada automático. */
    const sempre = ambientes.filter(
      (p) => String(p.tocar_sempre).toUpperCase() === 'S',
    );
    if (sempre.length > 0) {
      elegiveis = sempre;
      motivo = sempre.length > 1 ? 'tocar_sempre_multiplas' : 'tocar_sempre';
    } else {
      __ultimaPastaLogada = null;
      return null;
    }
  }

  if (elegiveis.length === 0) {
    __ultimaPastaLogada = null;
    return null;
  }

  const escolhida = fundirPlaylistsAmbientes(elegiveis);

  if (escolhida.id !== __ultimaPastaLogada && isDebugRedeEnabled()) {
    __ultimaPastaLogada = escolhida.id;
    // eslint-disable-next-line no-console
    console.info(
      '[ibiza-slot] pasta escolhida:',
      escolhida.nome,
      'id=',
      escolhida.id,
      'motivo=',
      motivo,
      'origens=',
      elegiveis.map((p) => `${p.id}/${p.nome}`),
      'musicas=',
      escolhida.musicas.length,
    );
  } else {
    __ultimaPastaLogada = escolhida.id;
  }

  return escolhida;
}
