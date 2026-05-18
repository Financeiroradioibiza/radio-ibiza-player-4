import { type RefObject } from 'react';

export type PlayerViewportLayout = {
  /** Antes: `transform: scale(scale)`; hoje fixo em 1 (ver comentário no hook). */
  scale: number;
  /** Largura do wrapper quando `> 0`; 0 = layout natural (sem caixa forçada). */
  boxW: number;
  /** Altura do wrapper quando `> 0`; 0 = layout natural. */
  boxH: number;
};

/**
 * Encaixe do cartão no viewport.
 *
 * **Histórico:** calculávamos `scale = min(availW/w, availH/h, 1)` e aplicávamos
 * `transform: scale()` no `PlayerPage`. Com **zoom do browser** (Ctrl/Cmd+±), o
 * Chrome reduz os «CSS px» do viewport — o hook lia menos espaço disponível e
 * baixava `scale` outra vez, pelo contrário do que o utilizador espera (tudo deveria
 * ampliar). Isso ainda gerava recorte visual com a caixa do wrapper.
 *
 * O cartão já tem `max-h-[min(96dvh,920px)]` e conteúdo scrollável; o shell em
 * `App.tsx` tem `overflow-y-auto`. Mantemos **sempre** scale 1 e sem dimensões
 * forçadas no wrapper (`boxW`/`boxH` = 0).
 */
export function usePlayerViewportScale<T extends HTMLElement>(
  _ref: RefObject<T | null>,
): PlayerViewportLayout {
  return { scale: 1, boxW: 0, boxH: 0 };
}
