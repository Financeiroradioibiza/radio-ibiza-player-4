import type { WheelEvent as ReactWheelEvent } from 'react';

/** Atributo do contentor do painel Avisos (overlay) onde a rolagem vertical deve concentrar quando a textarea já não pode. */
export const RB_SCROLL_CHAIN_ROOT_ATTR = 'data-rb-scroll-chain-root';

const selector = `[${RB_SCROLL_CHAIN_ROOT_ATTR}]`;

/**
 * Evento nativo (addEventListener com `{ passive: false }`).
 * Quando o alvo não está dentro de nada rolável verticalmente (ou já no limite), o painel Avisos sobe/desce.
 * Cobre formulários dentro de cartões onde o Chrome às vezes não encadeia a roda até ao `overflow-y-auto` pai.
 */
export function propagateNativeWheelToScrollChainRoot(ev: globalThis.WheelEvent): void {
  const target = ev.target;
  if (!(target instanceof Element)) return;
  const root = target.closest(selector);
  if (!root || !(root instanceof HTMLElement)) return;

  const dy = ev.deltaY;
  if (dy === 0) return;

  let el: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
  while (el && el !== root) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const st = el.scrollTop;
      const top = st <= 0;
      const bottom = st + el.clientHeight >= el.scrollHeight - 2;
      if (dy > 0 && !bottom) return;
      if (dy < 0 && !top) return;
    }
    el = el.parentElement;
  }

  const before = root.scrollTop;
  root.scrollTop += dy;
  if (root.scrollTop !== before) {
    ev.preventDefault();
  }
}

/**
 * Nos browsers o wheel sobre textarea consome sempre o primeiro scroll possível dentro dela —
 * mesmo com pouco texto, o elemento ocupa alta área útil e a roda pode não chegar ao painel pai.
 * Aqui repetimos só quando os limites superior/inferior da textarea já foram atingidos (ou quando ela nem tem overflow).
 */
export function passthroughWheelToScrollChainRoot(e: ReactWheelEvent<HTMLTextAreaElement>): void {
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
  }
}
