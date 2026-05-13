interface Props {
  mensagem?: string;
}

export function LoadingScreen({ mensagem = 'Carregando...' }: Props) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-ibiza-magenta/20 blur-xl" />
          <div className="absolute inset-0 animate-pulse rounded-2xl bg-ibiza-purple/15 blur-2xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/80 shadow-ibiza-pop">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-ibiza-magenta border-r-ibiza-lemon border-b-ibiza-purple" />
          </div>
        </div>
        <p className="text-sm font-medium text-zinc-400">{mensagem}</p>
      </div>
    </div>
  );
}
