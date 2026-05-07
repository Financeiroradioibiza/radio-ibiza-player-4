type Props = {
  /** Uma ou mais mensagens (cadastro / flags / contato extra). */
  textos: readonly string[];
};

/**
 * Avisos vermelhos sob «Atualização de cadastro» (flags ctrl_player / ctrl_playlists e códigos no contato extra).
 */
export function PainelAvisoIePdv({ textos }: Props) {
  const lista = textos.filter((t) => t.trim().length > 0);
  if (lista.length === 0) return null;

  return (
    <div
      className="mt-3 rounded-xl border border-red-500/80 bg-red-950/50 px-3 py-2.5 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      {lista.map((t, i) => (
        <p
          key={i}
          className="text-center text-[11px] font-semibold leading-snug text-red-300 sm:text-xs [&+&]:mt-2"
        >
          {t}
        </p>
      ))}
    </div>
  );
}
