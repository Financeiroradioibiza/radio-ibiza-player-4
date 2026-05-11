import type { WheelEvent } from 'react';

/** Atributo do contentor Shopping (overlay) onde a rolagem vertical deve concentrar quando a textarea já não pode. */
export const RB_SCROLL_CHAIN_ROOT_ATTR = 'data-rb-scroll-chain-root';

const selector = `[${RB_SCROLL_CHAIN_ROOT_ATTR}]`;

/**
 * Nos browsers o wheel sobre textarea consome sempre o primeiro scroll possível dentro dela —
 * mesmo com pouco texto, o elemento ocupa alta área útil e a roda pode não chegar ao painel pai.
 * Aqui repetimos só quando os limites superior/inferior da textarea já foram atingidos (ou quando ela nem tem overflow).
 */
export function passthroughWheelToScrollChainRoot(e: WheelEvent<HTMLTextAreaElement>): void {
  const nested = e.currentTarget;
  const root = nested.closest(selector);

  if (!root || !(root instanceof HTMLElement) || nested === root) return;

  const dy = e.deltaY;
  if (dy === 0) return;

  const nt = nested.scrollTop;
  const nh = nested.scrollHeight;
  const nhView = nested.clientHeight;

  const nestedScrollable = nh > nhView + 1;
  let nestedConsumesWheel = false;
  if (nestedScrollable) {
    const top = nt <= 0;
    const bottom = nt + nhView >= nh - 1;
    if (dy < 0 && !top) nestedConsumesWheel = true;
    if (dy > 0 && !bottom) nestedConsumesWheel = true;
  }

  if (nestedConsumesWheel) return;

  const rtBefore = root.scrollTop;
  root.scrollTop += dy;
  if (root.scrollTop !== rtBefore) {
    e.preventDefault();
    e.stopPropagation();
  }
}
