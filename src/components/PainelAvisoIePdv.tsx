import clsx from 'clsx';

type Props = {
  /** Uma ou mais mensagens (cadastro / flags / contato extra). */
  textos: readonly string[];
  /** Margem extra (ex.: posição no Player). */
  className?: string;
};

/**
 * Avisos vermelhos (`ctrl_player` / `ctrl_playlists` / contato extra) — informativos; não desativam transporte nem playlists.
 */
export function PainelAvisoIePdv({ textos, className = '' }: Props) {
  const lista = textos.filter((t) => t.trim().length > 0);
  if (lista.length === 0) return null;

  return (
    <div
      className={clsx(
        'mb-4 rounded-xl border border-red-400/90 bg-red-50/90 px-3 py-2.5 shadow-sm dark:border-red-500/80 dark:bg-red-950/50',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      {lista.map((t, i) => (
        <p
          key={i}
          className="text-center text-[11px] font-semibold leading-snug text-red-800 sm:text-xs [&+&]:mt-2 dark:text-red-300"
        >
          {t}
        </p>
      ))}
    </div>
  );
}
