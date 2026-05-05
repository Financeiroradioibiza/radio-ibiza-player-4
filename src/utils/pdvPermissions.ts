import type { PdvData } from '../types/webservice';

/** `undefined`/`'S'` = permitido — só `'N'` bloqueia (comportamento típico do legado Cake). */
export function isCtrlPlayerEnabled(pdv: PdvData | null | undefined): boolean {
  return pdv?.ctrl_player !== 'N';
}

export function isCtrlPlaylistsEnabled(pdv: PdvData | null | undefined): boolean {
  return pdv?.ctrl_playlists !== 'N';
}

export function isCtrlPlacaCarroEnabled(pdv: PdvData | null | undefined): boolean {
  return pdv?.ctrl_placa_carro !== 'N';
}
