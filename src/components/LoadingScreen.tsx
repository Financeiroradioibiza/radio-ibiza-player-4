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
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 shadow-ibiza-pop dark:border-white/10 dark:bg-zinc-950/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ibiza-magenta border-r-ibiza-lemon border-b-ibiza-purple dark:border-zinc-700" />
          </div>
        </div>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{mensagem}</p>
      </div>
    </div>
  );
}
