interface Props {
  mensagem?: string;
}

export function LoadingScreen({ mensagem = 'Carregando...' }: Props) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-zinc-400">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-ibiza-gold" />
        <p className="text-sm">{mensagem}</p>
      </div>
    </div>
  );
}
