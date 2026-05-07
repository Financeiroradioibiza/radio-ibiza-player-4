import { type FormEvent, useEffect, useRef, useState } from 'react';
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
import { VinhetaLocucaoPorTextoSection } from '@/components/VinhetaLocucaoPorTextoSection';

type Props = {
  /** Volta à grelha de atalhos. */
  onClose: () => void;
  /** Último aviso bem-sucedido nesta sessão (RAM só — some ao sair do player). */
  savedSessionClip: SavedVehicleAnnouncementClip | null;
  onSavedSessionClipChange: (clip: SavedVehicleAnnouncementClip | null) => void;
};

const emptyFields: AvisoVeiculoFields = { marca: '', modelo: '', placa: '', cor: '' };

export function ShoppingPanel({
  onClose,
  savedSessionClip,
  onSavedSessionClipChange,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-amber-400/95">Shopping</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Aviso de veículo na loja, locução por texto e repetição do último aviso da sessão. A programação pausa
            durante o áudio e retoma depois.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={fecharBloqueado}
          aria-label="Voltar ao player"
          className="rounded-xl border border-zinc-600/70 bg-zinc-950/80 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Voltar ao player
        </button>
      </div>

      {!transporteOk && (
        <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          O painel desativou o controlo local ou o aviso de veículo (ctrl_placa_carro) para este PDV.
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Aviso de veículo</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
              className="w-full rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.marca}
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
              className="w-full rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.modelo}
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
              className="w-full rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm uppercase text-zinc-100 placeholder:normal-case placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.placa}
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
              className="w-full rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.cor}
            />
          </label>
          <label className="block text-left sm:col-span-2">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Repetir o aviso
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                name="repeticoes"
                min={AVISO_VEICULO_REPETICOES_MIN}
                max={AVISO_VEICULO_REPETICOES_MAX}
                step={1}
                disabled={disabledVeiculo}
                value={repeticoes}
                onChange={(e) => setRepeticoes(clampAvisoVeiculoRepeticoes(Number(e.target.value)))}
                aria-label={`Número de vezes (${AVISO_VEICULO_REPETICOES_MIN} a ${AVISO_VEICULO_REPETICOES_MAX})`}
                className="w-[5.5rem] rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              />
              <span className="text-xs text-zinc-500">
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
          className="w-full rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-600/25 via-amber-500/15 to-orange-600/25 py-3 text-sm font-bold text-amber-100 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[200px] sm:px-8"
        >
          {busyVeiculo === 'idle'
            ? `Gerar aviso e reproduzir (${repeticoes}×)`
            : busyVeiculo === 'gerando'
              ? 'Gerando voz…'
              : `Tocando aviso (${repeticoesNaRodada}×)…`}
        </button>
      </form>

      <VinhetaLocucaoPorTextoSection onBusyChange={setLocucaoBusy} />

      <div className="border-t border-white/5 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Aviso nesta sessão
        </p>
        <p className="mb-3 text-[11px] text-zinc-600">
          Guardado só na memória deste dispositivo. Some ao sair do player ou terminar a sessão.
        </p>
        {savedSessionClip ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-100/95">{savedSessionClip.label}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabledVeiculo}
                onClick={() => void handleReplaySaved()}
                className="rounded-lg border border-amber-500/35 bg-amber-600/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-600/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tocar de novo ({repeticoes}×)
              </button>
              <button
                type="button"
                disabled={busyVeiculo !== 'idle'}
                onClick={handleApagarSalvo}
                className="rounded-lg border border-zinc-600/60 bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apagar
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2 text-xs text-zinc-500">
            Nenhum aviso guardado ainda. Gere um aviso acima para poder repetir depois.
          </p>
        )}
      </div>
    </div>
  );
}
