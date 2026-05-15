import type { PdvData } from '../types/webservice';

/**
 * Flags `ctrl_*` vindas do CakePHP. No player 4, **`ctrl_player` e `ctrl_playlists` com `N`**
 * geram só o aviso vermelho (cadastro / financeiro), sem travar play nem pastas.
 */
export function isCtrlPlayerEnabled(pdv: PdvData | null | undefined): boolean {
  return pdv?.ctrl_player !== 'N';
}

export function isCtrlPlaylistsEnabled(pdv: PdvData | null | undefined): boolean {
  return pdv?.ctrl_playlists !== 'N';
}

/** `N` = módulo Shopping (placa / aviso de veículo) indisponível neste PDV. */
export function isCtrlPlacaCarroEnabled(pdv: PdvData | null | undefined): boolean {
  return pdv?.ctrl_placa_carro !== 'N';
}
