import { type RefObject, useLayoutEffect, useState } from 'react';

const PAD = 22;

/** Evita usar `scrollHeight` gigante (ex.: lista longa dentro de painel) como altura «intrínseca». */
const SCROLL_HEIGHT_CAP_FACTOR = 4;

/**
 * Soma do padding vertical do root em `App.tsx` (`py-4` = 16+16, `sm:py-6` = 24+24).
 * O escalonamento deve usar a área útil dentro desse padding — senão o cartão «cabe» na matemática
 * mas corta na prática (PWA/janela redimensionada).
 */
function appRootVerticalGutterPx(): number {
  if (typeof window === 'undefined') return 48;
  return window.matchMedia('(min-width: 640px)').matches ? 48 : 32;
}

function readViewportCssPx(): { vw: number; vh: number } {
  if (typeof window === 'undefined') return { vw: 1280, vh: 800 };
  const vv = window.visualViewport;
  const root = document.documentElement;
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  /** `clientWidth` / `clientHeight` excluem barra de scroll — evita «caber na matemática» mas cortar na prática. */
  const cw = root.clientWidth;
  const ch = root.clientHeight;
  const vw = Math.min(iw, vv?.width ?? iw, cw);
  const vh = Math.min(ih, vv?.height ?? ih, ch);
  return { vw, vh };
}

function parseCssMinPx(el: HTMLElement, dim: 'minWidth' | 'minHeight'): number {
  try {
    const raw = getComputedStyle(el)[dim];
    if (raw.endsWith('px')) {
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    //
  }
  return 0;
}

export type PlayerViewportLayout = {
  /** `transform: scale(scale)` — todo o bloco encolhe proporcionalmente */
  scale: number;
  /** Largura da caixa visual após escala (para o wrapper não cortar nem deixar buracos de layout) */
  boxW: number;
  /** Altura da caixa visual após escala */
  boxH: number;
};

/**
 * Escalona o cartão do player para caber na janela (visualViewport) sem cortar.
 *
 * Importante: o elemento medido não pode depender da largura do próprio wrapper com escala —
 * senão `offsetWidth` colapsa junto com o wrapper (feedback → «filete»). Por isso usamos
 * `Math.max(offsetWidth, scrollWidth)` na horizontal e idem na vertical com teto — e agora também
 * os valores em px de `min-width` / `min-height` aplicados no cartão (`getComputedStyle`), para o `max-h`
 * interior em `dvh` não «ganhar» só ao eixo vertical.
 */
export function usePlayerViewportScale<T extends HTMLElement>(
  ref: RefObject<T | null>,
): PlayerViewportLayout {
  const [layout, setLayout] = useState<PlayerViewportLayout>({
    scale: 1,
    boxW: 0,
    boxH: 0,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (): void => {
      /**
       * Largura «real» do bloco: quando o pai está mais estreito que o conteúdo,
       * `scrollWidth` mantém o extent horizontal intrínseco; `offsetWidth` pode estar comprimido.
       * Respeita também `min-width` em CSS (como o `min-height` em baixo).
       */
      const minWx = parseCssMinPx(el, 'minWidth');
      const minHy = parseCssMinPx(el, 'minHeight');
      const w = Math.max(minWx, el.offsetWidth, el.scrollWidth);
      const oh = el.offsetHeight;
      const sh = el.scrollHeight;
      const { vw: vwCss, vh: vhCss } = readViewportCssPx();
      /** Mesma ideia da largura: quando o pai «comprime» só em `offsetHeight`, `scrollHeight` guarda o extent vertical. */
      const scrollCap = Math.max(vhCss * SCROLL_HEIGHT_CAP_FACTOR, oh * SCROLL_HEIGHT_CAP_FACTOR);
      const hUncapped = Math.max(oh, Math.min(sh, scrollCap));
      /** Piso vertical alinhado ao `min-h-*` do cartão — sem isto o painel interior `max-h-* dvh` fazia o bloco encolher só em altura. */
      const h = Math.max(minHy, hUncapped);
      if (w < 2 || h < 2) return;

      const shellY = appRootVerticalGutterPx();
      /** Margem extra horizontal para subpixels / cantos do layout flex sem cortar o cartão. */
      const availW = Math.max(1, vwCss - PAD * 2 - 2);
      /** Área útil vertical ≈ viewport menos padding do shell do App (não só `PAD`). */
      const availH = Math.max(1, vhCss - PAD * 2 - shellY);
      const sx = availW / w;
      const sy = availH / h;
      const scale = Math.min(sx, sy, 1);

      setLayout({
        scale,
        boxW: w * scale,
        boxH: h * scale,
      });
    };

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    update();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [ref]);

  return layout;
}
