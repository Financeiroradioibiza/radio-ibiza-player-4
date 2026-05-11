import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/app';
import { isCtrlPlayerEnabled, isCtrlPlacaCarroEnabled } from '@/utils/pdvPermissions';
import { fetchAvisoVeiculoMp3, TtsAvisoVeiculoError } from '@/api/ttsAvisoVeiculo';
import { playMp3BlobRepeated } from '@/utils/avisoVeiculoPlayback';
import {
  AVISO_VEICULO_LIMITS,
  AVISO_VEICULO_REPETICOES_MAX,
  AVISO_VEICULO_REPETICOES_MIN,
  AVISO_VEICULO_REPETICOES_PADRAO,
  buildSavedVehicleAnnouncementLabel,
  clampAvisoVeiculoRepeticoes,
  isAvisoVeiculoFormComplete,
  sanitizeAvisoVeiculoFields,
  type AvisoVeiculoFields,
  type SavedVehicleAnnouncementClip,
} from '@/utils/avisoVeiculoText';
import { listaCardShoppingVeiculo } from '@/components/PlayerSubpanelChrome';
import { VinhetaLocucaoPorTextoSection } from '@/components/VinhetaLocucaoPorTextoSection';
import { RB_SCROLL_CHAIN_ROOT_ATTR, propagateNativeWheelToScrollChainRoot } from '@/utils/wheelPassthroughScrollChain';

/** Rolagem vertical do Shopping sobreposto — dica quando falta espaço vertical e repasse correto ao contentor pai. */
function ShoppingOverlayScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelowCue, setMoreBelowCue] = useState(false);
  const [hasVerticalOverflow, setHasVerticalOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function tick() {
      const wrap = scrollRef.current;
      if (!wrap) return;
      const sh = wrap.scrollHeight;
      const ch = wrap.clientHeight;
      const st = wrap.scrollTop;
      const overflows = sh > Math.ceil(ch) + 10;
      const notAtBottom = st + ch < sh - 12;
      setHasVerticalOverflow(overflows);
      setMoreBelowCue(overflows && notAtBottom);
    }

    tick();
    const ro = new ResizeObserver(tick);
    ro.observe(el);
    el.addEventListener('scroll', tick, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', tick);
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        {...{ [RB_SCROLL_CHAIN_ROOT_ATTR]: '' }}
        className="rb-shopping-scroll min-h-0 flex-1 scroll-smooth space-y-4 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] pb-4"
      >
        {children}
      </div>
      {hasVerticalOverflow && moreBelowCue ? (
        <div
          className="pointer-events-none absolute bottom-28 right-0 top-36 z-[2] flex w-9 flex-col items-center border-l border-amber-500/25 bg-gradient-to-l from-black/35 to-transparent py-4 pl-1 pr-2"
          aria-hidden
        >
          <span
            className="select-none text-[9px] font-bold uppercase tracking-[0.12em] text-amber-500/90"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            Mais abaixo
          </span>
          <span className="mt-2 animate-bounce text-sm text-amber-400/95" aria-hidden>
            ↓
          </span>
        </div>
      ) : null}
      {moreBelowCue ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col items-center bg-gradient-to-t from-zinc-950/96 via-zinc-950/80 to-transparent px-5 pb-3 pt-16 text-center"
          aria-hidden
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-50">
            Mais conteúdo abaixo
          </span>
          <span className="mt-1 animate-bounce text-zinc-100" aria-hidden>
            ↓
          </span>
          <span className="max-w-[19rem] text-[10px] leading-snug text-zinc-100">
            A rodinha funciona em cima do formulário; à direita a barra de rolagem indica o deslocamento. Continue até «Aviso
            nesta sessão».
          </span>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  /** Volta à grelha de atalhos. */
  onClose: () => void;
  /** Último aviso bem-sucedido nesta sessão (RAM só — some ao sair do player). */
  savedSessionClip: SavedVehicleAnnouncementClip | null;
  onSavedSessionClipChange: (clip: SavedVehicleAnnouncementClip | null) => void;
  /** Ocupa a área principal (substitui «Tocando agora»). */
  layout?: 'inline' | 'overlay';
};

const emptyFields: AvisoVeiculoFields = { marca: '', modelo: '', placa: '', cor: '' };

export function ShoppingPanel({
  onClose,
  savedSessionClip,
  onSavedSessionClipChange,
  layout = 'inline',
}: Props) {
  const transporteOk = useAppStore(
    (s) =>
      s.status !== 'desativado' &&
      isCtrlPlayerEnabled(s.pdv) &&
      isCtrlPlacaCarroEnabled(s.pdv),
  );

  const [locucaoBusy, setLocucaoBusy] = useState(false);
  const [fields, setFields] = useState<AvisoVeiculoFields>(emptyFields);
  const [repeticoes, setRepeticoes] = useState<number>(AVISO_VEICULO_REPETICOES_PADRAO);
  const [repeticoesNaRodada, setRepeticoesNaRodada] = useState<number>(AVISO_VEICULO_REPETICOES_PADRAO);
  const [busyVeiculo, setBusyVeiculo] = useState<'idle' | 'gerando' | 'tocando'>('idle');
  const [erro, setErro] = useState<string | null>(null);
  const anuncioRef = useRef<HTMLAudioElement | null>(null);
  /** Formulário do aviso: listener nativo de wheel (`passive: false`) para o pai rolável receber o evento dentro do cartão. */
  const veiculoCartaoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (layout !== 'overlay') return;
    const el = veiculoCartaoRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => propagateNativeWheelToScrollChainRoot(ev);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [layout]);

  useEffect(() => {
    return () => {
      const a = anuncioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
        anuncioRef.current = null;
      }
    };
  }, []);

  const fecharBloqueado = busyVeiculo !== 'idle' || locucaoBusy;
  const disabledVeiculo = busyVeiculo !== 'idle' || !transporteOk;

  function registerAnnouncementAudio(audio: HTMLAudioElement | null) {
    anuncioRef.current = audio;
  }

  async function tocarAviso(blob: Blob, vezes: number): Promise<void> {
    const n = clampAvisoVeiculoRepeticoes(vezes);
    await playMp3BlobRepeated(blob, registerAnnouncementAudio, n);
  }

  function update<K extends keyof AvisoVeiculoFields>(key: K, value: string) {
    const max = AVISO_VEICULO_LIMITS[key];
    setFields((f) => ({ ...f, [key]: value.slice(0, max) }));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);

    if (!isAvisoVeiculoFormComplete(fields)) {
      setErro('Preencha marca, modelo, placa e cor.');
      return;
    }

    const sanitized = sanitizeAvisoVeiculoFields(fields);
    const estavaTocando = useAppStore.getState().status === 'tocando';
    const vezes = clampAvisoVeiculoRepeticoes(repeticoes);

    useAppStore.setState({ status: 'pausado' });
    setBusyVeiculo('gerando');

    let blob: Blob;
    try {
      blob = await fetchAvisoVeiculoMp3(sanitized);
    } catch (err) {
      if (estavaTocando) {
        useAppStore.setState({ status: 'tocando' });
      }
      if (err instanceof TtsAvisoVeiculoError) {
        setErro(err.message);
      } else {
        console.error(err);
        setErro(
          err instanceof Error && err.message
            ? err.message
            : 'Não foi possível gerar o áudio. Verifique a ligação e a configuração do serviço de voz.',
        );
      }
      setBusyVeiculo('idle');
      return;
    }

    setBusyVeiculo('tocando');
    setRepeticoesNaRodada(vezes);
    try {
      await tocarAviso(blob, vezes);
      onSavedSessionClipChange({
        blob,
        label: buildSavedVehicleAnnouncementLabel(sanitized),
      });
    } catch (err) {
      console.error(err);
      setErro(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível reproduzir o aviso até ao fim.',
      );
    } finally {
      if (estavaTocando) {
        useAppStore.setState({ status: 'tocando' });
      }
      setBusyVeiculo('idle');
    }
  }

  async function handleReplaySaved() {
    if (!savedSessionClip || busyVeiculo !== 'idle' || !transporteOk) return;
    setErro(null);
    const estavaTocando = useAppStore.getState().status === 'tocando';
    useAppStore.setState({ status: 'pausado' });
    const vezes = clampAvisoVeiculoRepeticoes(repeticoes);
    setBusyVeiculo('tocando');
    setRepeticoesNaRodada(vezes);
    try {
      await tocarAviso(savedSessionClip.blob, vezes);
    } catch (err) {
      console.error(err);
      setErro(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível repetir o aviso.',
      );
    } finally {
      if (estavaTocando) {
        useAppStore.setState({ status: 'tocando' });
      }
      setBusyVeiculo('idle');
    }
  }

  function handleApagarSalvo() {
    if (busyVeiculo !== 'idle') return;
    onSavedSessionClipChange(null);
  }

  const shoppingBody = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-amber-400/95">Shopping</h2>
          <p className="mt-1 text-xs text-zinc-50">
            Aviso de veículo na loja, locução por texto e repetição do último aviso da sessão. A programação pausa
            durante o áudio e retoma depois.
            {layout === 'overlay' ? (
              <span className="mt-2 block rounded-lg border border-amber-400/35 bg-gradient-to-br from-amber-600/30 via-orange-950/35 to-purple-950/25 px-3 py-2 text-[10px] leading-snug text-white">
                <strong className="font-semibold text-amber-300">Dica:</strong> há mais conteúdo abaixo disto (vinheta
                por texto e «Aviso nesta sessão»). Use a rodinha em cima dos campos ou a barra âmbar à direita.
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={fecharBloqueado}
          aria-label="Voltar ao player"
          className="rounded-xl border border-white/25 bg-gradient-to-r from-amber-600/65 via-orange-600/55 to-yellow-700/45 px-3 py-2 text-xs font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Voltar ao player
        </button>
      </div>

      {!transporteOk && (
        <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          O painel desativou o controlo local ou o aviso de veículo (ctrl_placa_carro) para este PDV.
        </p>
      )}

      <section ref={veiculoCartaoRef} className={listaCardShoppingVeiculo()}>
        <div className="mb-2 h-0.5 w-full max-w-[6rem] rounded-full bg-gradient-to-r from-red-600/95 via-orange-500/90 to-amber-500/85" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400/95">
          Aviso de veículo
        </p>
        <p className="mt-1 text-xs leading-snug text-zinc-50">
          Preencha os dados da placa; a programação pausa durante o áudio.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-left">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
                Marca do veículo
              </span>
              <input
                type="text"
                name="marca"
                autoComplete="off"
                disabled={disabledVeiculo}
                value={fields.marca}
                onChange={(e) => update('marca', e.target.value)}
                placeholder="Ex.: Fiat"
                className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                maxLength={AVISO_VEICULO_LIMITS.marca}
              />
            </label>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
              Modelo
            </span>
            <input
              type="text"
              name="modelo"
              autoComplete="off"
              disabled={disabledVeiculo}
              value={fields.modelo}
              onChange={(e) => update('modelo', e.target.value)}
              placeholder="Ex.: Argo"
              className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.modelo}
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
              Placa
            </span>
            <input
              type="text"
              name="placa"
              autoComplete="off"
              disabled={disabledVeiculo}
              value={fields.placa}
              onChange={(e) => update('placa', e.target.value.toUpperCase())}
              placeholder="ABC1D23"
              className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-sm uppercase text-zinc-100 placeholder:normal-case placeholder:text-zinc-400 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.placa}
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
              Cor
            </span>
            <input
              type="text"
              name="cor"
              autoComplete="off"
              disabled={disabledVeiculo}
              value={fields.cor}
              onChange={(e) => update('cor', e.target.value)}
              placeholder="Ex.: prata"
              className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.cor}
            />
          </label>
          <label className="block text-left sm:col-span-2">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
              Repetir o aviso
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                name="repeticoes"
                autoComplete="off"
                disabled={disabledVeiculo}
                value={repeticoes}
                onChange={(e) => setRepeticoes(clampAvisoVeiculoRepeticoes(Number(e.target.value)))}
                aria-label={`Número de vezes (${AVISO_VEICULO_REPETICOES_MIN} a ${AVISO_VEICULO_REPETICOES_MAX})`}
                className="w-[5.5rem] rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              />
              <span className="text-xs text-zinc-100">
                vezes seguidas (padrão {AVISO_VEICULO_REPETICOES_PADRAO}×, máximo{' '}
                {AVISO_VEICULO_REPETICOES_MAX})
              </span>
            </div>
          </label>
        </div>

        {erro && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-3 py-2 text-xs text-red-100">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={disabledVeiculo || !isAvisoVeiculoFormComplete(fields)}
          className="w-full rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-600/55 via-orange-600/42 to-orange-700/42 px-4 py-2 text-sm font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[180px] sm:px-6"
        >
          {busyVeiculo === 'idle'
            ? `Gerar aviso e reproduzir (${repeticoes}×)`
            : busyVeiculo === 'gerando'
              ? 'Gerando voz…'
              : `Tocando aviso (${repeticoesNaRodada}×)…`}
        </button>
      </form>
      </section>

      <VinhetaLocucaoPorTextoSection onBusyChange={setLocucaoBusy} />

      <div className="border-t border-white/5 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
          Aviso nesta sessão
        </p>
        <p className="mb-3 text-[11px] text-zinc-100">
          Guardado só na memória deste dispositivo. Some ao sair do player ou terminar a sessão.
        </p>
        {savedSessionClip ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-white">{savedSessionClip.label}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabledVeiculo}
                onClick={() => void handleReplaySaved()}
                className="rounded-lg border border-amber-500/45 bg-gradient-to-r from-amber-600/35 via-orange-600/28 to-orange-700/35 px-3 py-2 text-xs font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tocar de novo ({repeticoes}×)
              </button>
              <button
                type="button"
                disabled={busyVeiculo !== 'idle'}
                onClick={handleApagarSalvo}
                className="rounded-lg border border-rose-500/55 bg-gradient-to-r from-rose-900/55 to-purple-950/45 px-3 py-2 text-xs font-bold text-rose-100 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apagar
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-600/55 bg-black/25 px-3 py-2 text-xs text-zinc-100">
            Nenhum aviso guardado ainda. Gere um aviso acima para poder repetir depois.
          </p>
        )}
      </div>
    </>
  );

  if (layout === 'overlay') {
    return <ShoppingOverlayScroll>{shoppingBody}</ShoppingOverlayScroll>;
  }

  return <div className="space-y-4">{shoppingBody}</div>;
}
