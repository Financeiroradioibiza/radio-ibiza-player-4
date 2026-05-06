type Props = {
  texto: string | null;
};

/**
 * Aviso codificado pela inscrição estadual no cadastro (só dois códigos reconhecidos).
 */
export function PainelAvisoIePdv({ texto }: Props) {
  if (!texto) return null;

  return (
    <div
      className="mt-3 rounded-xl border border-red-500/80 bg-red-950/50 px-3 py-2.5 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <p className="text-center text-[11px] font-semibold leading-snug text-red-300 sm:text-xs">
        {texto}
      </p>
    </div>
  );
}
