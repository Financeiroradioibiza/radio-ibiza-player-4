import { useLayoutEffect, useRef, useState } from 'react';

import clsx from 'clsx';

type Props = {
  text: string;
  /** Fonte/tamanho/cor (Tailwind na linha inteira). */
  textClassName: string;
  /** No desktop queremos marquee; mobile/touch continua texto normal sem medir aqui. */
  marqueeEnabled: boolean;
};

/**
 * Uma linha: centrada quando cabe; se transbordar do contentor pai, faz loop horizontal (marquee).
 * Respeta `prefers-reduced-motion`: sem animação, trunca com reticências.
 */
export function IbizaMarqueeSingleLine({ text, textClassName, marqueeEnabled }: Props): JSX.Element {
  const laneRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    if (!marqueeEnabled || !text) {
      setOverflows(false);
      return;
    }
    const lane = laneRef.current;
    const gauge = gaugeRef.current;
    if (!lane || !gauge) return;

    function measure(): void {
      if (!lane || !gauge) return;
      const over = gauge.scrollWidth > lane.clientWidth + 1;
      setOverflows(over);
    }
    measure();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    });
    ro.observe(lane);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [marqueeEnabled, text]);

  const animationDurationSec =
    overflows && marqueeEnabled && text.length > 0 ? Math.min(26, Math.max(10, text.length * 0.32)) : undefined;

  if (!marqueeEnabled || !text) {
    return <p className={clsx(textClassName)}>{text}</p>;
  }

  return (
    <div ref={laneRef} className="relative min-h-[1.2em] min-w-0 w-full overflow-hidden" title={text}>
      <div
        role="presentation"
        className={clsx(
          'flex flex-nowrap',
          overflows
            ? [
                // Duplicado ocupa ~200% à esquerda; animação anda -50%.
                'w-max animate-ibiza-marquee-loop justify-start motion-reduce:w-full motion-reduce:animate-none motion-reduce:justify-center',
              ]
            : 'mx-auto w-max justify-center',
        )}
        style={
          overflows
            ? {
                animationDuration: `${animationDurationSec}s`,
              }
            : undefined
        }
      >
        <span
          ref={gaugeRef}
          className={clsx(
            textClassName,
            'inline-block shrink-0 whitespace-nowrap motion-reduce:max-w-full motion-reduce:text-ellipsis motion-reduce:truncate',
          )}
        >
          {text}
        </span>
        {overflows ? (
          <span className={clsx(textClassName, 'motion-reduce:hidden inline-block shrink-0 whitespace-nowrap pl-12')} aria-hidden>
            {text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
