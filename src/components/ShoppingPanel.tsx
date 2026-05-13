import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
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

function IconAccordionChevron({ aberto, className }: { aberto: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      className={`h-5 w-5 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''} ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Há mais conteúdo por baixo dentro da zona rolável. */
function computeShoppingMoreBelow(wrap: HTMLDivElement): boolean {
  const slack = wrap.scrollHeight - wrap.clientHeight;
  if (slack <= 4) return false;
  return wrap.scrollTop < slack - 10;
}

/** Cor lateral alinhada à secção que o operador expandiu — + misto se as duas estiverem abertas. */
type ShoppingScrollAccent = false | 'vehicle' | 'vinheta' | 'mixed';

const ACCENT_STROKE: Record<'vehicle' | 'vinheta' | 'mixed', [string, string, string]> = {
  vehicle: ['#ea580c', '#f97316', '#fbbf24'],
  vinheta: ['#a855f7', '#9333ea', '#f0abfc'],
  mixed: ['#ea580c', '#9333ea', '#fcd34d'],
};

function gradientRailAccentClass(accent: 'vehicle' | 'vinheta' | 'mixed'): string {
  switch (accent) {
    case 'vehicle':
      return 'from-transparent from-5% via-orange-500/[0.68] via-45% to-amber-400/85 to-95%';
    case 'vinheta':
      return 'from-transparent from-5% via-purple-500/[0.7] via-45% to-fuchsia-400/82 to-95%';
    default:
      return 'from-transparent from-5% via-violet-500/58 via-45% to-amber-400/78 to-95%';
  }
}

/** Seta + tracéu lateral (cor da secção expandida). */
function ShoppingScrollCue({ accent, gradientId }: { accent: Exclude<ShoppingScrollAccent, false>; gradientId: string }) {
  const [c0, c1, c2] = ACCENT_STROKE[accent];
  return (
    <div
      className="pointer-events-none absolute bottom-16 right-0 top-[4.75rem] z-[80] flex flex-col items-center pr-1 pt-6 sm:right-px sm:pr-2 drop-shadow-[0_0_12px_rgba(0,0,0,.45)]"
      aria-hidden
    >
      <div
        className={`mb-3 h-[min(14rem,calc(100%-2.75rem))] min-h-[56px] w-[3px] shrink-0 rounded-full bg-gradient-to-b ${gradientRailAccentClass(accent)}`}
      />
      <div className="rounded-2xl border border-white/[0.2] bg-zinc-950/90 p-2.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,.6)] backdrop-blur-sm">
        <svg className="animate-bounce" width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="4" y1="10" x2="36" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor={c0} />
              <stop offset="0.52" stopColor={c1} />
              <stop offset="1" stopColor={c2} />
            </linearGradient>
          </defs>
          <path
            stroke={`url(#${gradientId})`}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 21 20 34 31 21M20 33.8 V46.5"
          />
        </svg>
      </div>
    </div>
  );
}

/** Rolagem vertical do Shopping sobreposto; linha + seta laterais combinam com a secção expandida. */
function ShoppingOverlayScroll({
  children,
  scrollHintFor,
}: {
  children: ReactNode;
  scrollHintFor: ShoppingScrollAccent;
}) {
  const gradientId = useId().replace(/:/g, '');
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollInnerRef = useRef<HTMLDivElement>(null);
  const [moreBelowCue, setMoreBelowCue] = useState(false);

  const applyHintFromDom = (): void => {
    const wrap = scrollRef.current;
    if (!wrap) return;
    setMoreBelowCue(computeShoppingMoreBelow(wrap));
  };

  useEffect(() => {
    const wrap = scrollRef.current;
    const inner = scrollInnerRef.current;
    if (!wrap || !inner) return undefined;

    const ro = new ResizeObserver(() => {
      queueMicrotask(applyHintFromDom);
    });
    ro.observe(inner);
    ro.observe(wrap);
    wrap.addEventListener('scroll', applyHintFromDom, { passive: true });

    applyHintFromDom();
    queueMicrotask(applyHintFromDom);
    const rafs = { a: 0, b: 0 };
    rafs.a = requestAnimationFrame(() => {
      applyHintFromDom();
      rafs.b = requestAnimationFrame(applyHintFromDom);
    });
    const tShort = window.setTimeout(applyHintFromDom, 80);
    const tMid = window.setTimeout(applyHintFromDom, 280);

    return () => {
      window.clearTimeout(tShort);
      window.clearTimeout(tMid);
      cancelAnimationFrame(rafs.a);
      cancelAnimationFrame(rafs.b);
      ro.disconnect();
      wrap.removeEventListener('scroll', applyHintFromDom);
    };
  }, [scrollHintFor]);

  useEffect(() => {
    if (!scrollHintFor) return undefined;
    const t = window.setTimeout(applyHintFromDom, 0);
    const t2 = window.setTimeout(applyHintFromDom, 220);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [scrollHintFor]);

  return (
    <div className="relative isolate flex min-h-0 min-w-0 basis-0 flex-1 shrink flex-col overflow-hidden">
      <div
        ref={scrollRef}
        {...{ [RB_SCROLL_CHAIN_ROOT_ATTR]: '' }}
        className="rb-shopping-scroll min-h-0 min-w-0 flex-1 basis-0 shrink scroll-smooth overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] pb-4"
      >
        <div ref={scrollInnerRef} className="space-y-4">
          {children}
        </div>
      </div>
      {scrollHintFor && moreBelowCue ? <ShoppingScrollCue accent={scrollHintFor} gradientId={gradientId} /> : null}
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
  const [avisoVeiculoAberto, setAvisoVeiculoAberto] = useState(false);
  const [vinhetaAccordionAberta, setVinhetaAccordionAberta] = useState(false);
  /** Incrementa para o cartão «Vinheta por texto» fechar o acordeão (abriu «Aviso de veículo»). */
  const [vinhetaFechaAccordionSinal, setVinhetaFechaAccordionSinal] = useState(0);

  const handleVinhetaSecaoAccordionChange = useCallback((aberta: boolean) => {
    setVinhetaAccordionAberta(aberta);
    if (aberta) {
      setAvisoVeiculoAberto(false);
    }
  }, []);
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
    if (busyVeiculo !== 'idle') {
      setAvisoVeiculoAberto(true);
    }
  }, [busyVeiculo]);

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
  const bloquearToggleVeiculoAccordion = busyVeiculo !== 'idle';
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-400/95">Shopping</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={fecharBloqueado}
          aria-label="Voltar ao player"
          className="rounded-xl border border-white/25 bg-gradient-to-r from-amber-600/65 via-orange-600/55 to-yellow-700/45 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Voltar ao player
        </button>
      </div>

      {!transporteOk && (
        <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100/90">
          O painel desativou o controlo local ou o aviso de veículo (ctrl_placa_carro) para este PDV.
        </p>
      )}

      <section ref={veiculoCartaoRef} className={listaCardShoppingVeiculo()}>
        {layout === 'overlay' ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (bloquearToggleVeiculoAccordion) return;
                setAvisoVeiculoAberto((aberto) => {
                  const proximo = !aberto;
                  if (proximo) {
                    setVinhetaFechaAccordionSinal((n) => n + 1);
                  }
                  return proximo;
                });
              }}
              disabled={bloquearToggleVeiculoAccordion}
              aria-expanded={avisoVeiculoAberto}
              className="flex w-full items-start justify-between gap-3 rounded-lg px-0 py-1 text-left transition hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent"
              title={
                bloquearToggleVeiculoAccordion
                  ? 'Aguarde o aviso terminar antes de minimizar.'
                  : avisoVeiculoAberto
                    ? 'Minimizar secção'
                    : 'Expandir para preencher e gerar o aviso'
              }
            >
              <div className="min-w-0 pt-0.5">
                <div className="mb-2 h-0.5 w-full max-w-[6rem] rounded-full bg-gradient-to-r from-red-600/95 via-orange-500/90 to-amber-500/85" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/95">
                  Aviso de veículo
                </p>
                {!avisoVeiculoAberto ? (
                  <p className="mt-2 text-[10px] leading-snug text-white">
                    Toque para preencher a placa · a programação pausa durante o áudio
                  </p>
                ) : null}
              </div>
              {avisoVeiculoAberto ? (
                <IconAccordionChevron
                  aberto={avisoVeiculoAberto}
                  className={`mt-1 ${bloquearToggleVeiculoAccordion ? 'text-white/45' : 'text-orange-400/90'}`}
                />
              ) : null}
            </button>

            {avisoVeiculoAberto ? (
              <>
                <p className="mt-1 text-[11px] leading-snug text-white">
                  Preencha os dados da placa; a programação pausa durante o áudio.
                </p>

                <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-3">
                    <label className="block text-left">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
                        Marca
                      </span>
                      <input
                        type="text"
                        name="marca"
                        autoComplete="off"
                        disabled={disabledVeiculo}
                        value={fields.marca}
                        onChange={(e) => update('marca', e.target.value)}
                        placeholder="Ex.: Fiat"
                        className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                        maxLength={AVISO_VEICULO_LIMITS.marca}
                      />
                    </label>
                    <label className="block text-left">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                        className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                        maxLength={AVISO_VEICULO_LIMITS.modelo}
                      />
                    </label>
                    <label className="block text-left">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                        className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] uppercase text-white placeholder:normal-case placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                        maxLength={AVISO_VEICULO_LIMITS.placa}
                      />
                    </label>
                    <label className="block text-left">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                        className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                        maxLength={AVISO_VEICULO_LIMITS.cor}
                      />
                    </label>
                    <label className="col-span-2 block text-left">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                          className="w-[5.5rem] rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                        />
                        <span className="text-[11px] text-white">
                          vezes seguidas (padrão {AVISO_VEICULO_REPETICOES_PADRAO}×, máximo{' '}
                          {AVISO_VEICULO_REPETICOES_MAX})
                        </span>
                      </div>
                    </label>
                  </div>

                  {erro && (
                    <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-2.5 py-1.5 text-[11px] leading-snug text-red-100">
                      {erro}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={disabledVeiculo || !isAvisoVeiculoFormComplete(fields)}
                    className="w-full rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-600/55 via-orange-600/42 to-orange-700/42 px-3 py-1.5 text-[13px] font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[160px] sm:px-5"
                  >
                    {busyVeiculo === 'idle'
                      ? `Gerar aviso e reproduzir (${repeticoes}×)`
                      : busyVeiculo === 'gerando'
                        ? 'Gerando voz…'
                        : `Tocando aviso (${repeticoesNaRodada}×)…`}
                  </button>
                </form>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-2 h-0.5 w-full max-w-[6rem] rounded-full bg-gradient-to-r from-red-600/95 via-orange-500/90 to-amber-500/85" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/95">
              Aviso de veículo
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white">
              Preencha os dados da placa; a programação pausa durante o áudio.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
              <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-3">
                <label className="block text-left">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
                    Marca
                  </span>
                  <input
                    type="text"
                    name="marca"
                    autoComplete="off"
                    disabled={disabledVeiculo}
                    value={fields.marca}
                    onChange={(e) => update('marca', e.target.value)}
                    placeholder="Ex.: Fiat"
                    className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                    maxLength={AVISO_VEICULO_LIMITS.marca}
                  />
                </label>
                <label className="block text-left">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                    className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                    maxLength={AVISO_VEICULO_LIMITS.modelo}
                  />
                </label>
                <label className="block text-left">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                    className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] uppercase text-white placeholder:normal-case placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                    maxLength={AVISO_VEICULO_LIMITS.placa}
                  />
                </label>
                <label className="block text-left">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                    className="w-full rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                    maxLength={AVISO_VEICULO_LIMITS.cor}
                  />
                </label>
                <label className="col-span-2 block text-left">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white">
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
                      className="w-[5.5rem] rounded-lg border border-zinc-700/80 bg-black/40 px-2.5 py-1.5 text-[13px] text-white focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
                    />
                    <span className="text-[11px] text-white">
                      vezes seguidas (padrão {AVISO_VEICULO_REPETICOES_PADRAO}×, máximo{' '}
                      {AVISO_VEICULO_REPETICOES_MAX})
                    </span>
                  </div>
                </label>
              </div>

              {erro && (
                <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-2.5 py-1.5 text-[11px] leading-snug text-red-100">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={disabledVeiculo || !isAvisoVeiculoFormComplete(fields)}
                className="w-full rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-600/55 via-orange-600/42 to-orange-700/42 px-3 py-1.5 text-[13px] font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[160px] sm:px-5"
              >
                {busyVeiculo === 'idle'
                  ? `Gerar aviso e reproduzir (${repeticoes}×)`
                  : busyVeiculo === 'gerando'
                    ? 'Gerando voz…'
                    : `Tocando aviso (${repeticoesNaRodada}×)…`}
              </button>
            </form>
          </>
        )}
      </section>

      <VinhetaLocucaoPorTextoSection
        modoAccordion={layout === 'overlay'}
        fechaAccordionSinal={vinhetaFechaAccordionSinal}
        onSecaoAccordionChange={handleVinhetaSecaoAccordionChange}
        onBusyChange={setLocucaoBusy}
      />

      <div className="border-t border-white/5 pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white">
          Aviso nesta sessão
        </p>
        <p className="mb-3 text-[10px] leading-snug text-white">
          Guardado só na memória deste dispositivo. Some ao sair do player ou terminar a sessão.
        </p>
        {savedSessionClip ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] font-medium leading-snug text-white">{savedSessionClip.label}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabledVeiculo}
                onClick={() => void handleReplaySaved()}
                className="rounded-lg border border-amber-500/45 bg-gradient-to-r from-amber-600/35 via-orange-600/28 to-orange-700/35 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tocar de novo ({repeticoes}×)
              </button>
              <button
                type="button"
                disabled={busyVeiculo !== 'idle'}
                onClick={handleApagarSalvo}
                className="rounded-lg border border-rose-500/55 bg-gradient-to-r from-rose-900/55 to-purple-950/45 px-2.5 py-1.5 text-[10px] font-bold text-rose-100 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apagar
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-600/55 bg-black/25 px-2.5 py-1.5 text-[11px] leading-snug text-white">
            Nenhum aviso guardado ainda. Gere um aviso acima para poder repetir depois.
          </p>
        )}
      </div>
    </>
  );

  const overlayScrollAccent: ShoppingScrollAccent =
    avisoVeiculoAberto && vinhetaAccordionAberta
      ? 'mixed'
      : avisoVeiculoAberto
        ? 'vehicle'
        : vinhetaAccordionAberta
          ? 'vinheta'
          : false;

  if (layout === 'overlay') {
    return (
      <ShoppingOverlayScroll scrollHintFor={overlayScrollAccent}>
        {shoppingBody}
      </ShoppingOverlayScroll>
    );
  }

  return <div className="space-y-4">{shoppingBody}</div>;
}
