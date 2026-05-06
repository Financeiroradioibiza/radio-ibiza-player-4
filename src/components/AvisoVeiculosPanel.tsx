import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/app';
import { isCtrlPlayerEnabled, isCtrlPlacaCarroEnabled } from '@/utils/pdvPermissions';
import { fetchAvisoVeiculoMp3, TtsAvisoVeiculoError } from '@/api/ttsAvisoVeiculo';
import {
  AVISO_VEICULO_LIMITS,
  buildAvisoVeiculoSpeech,
  isAvisoVeiculoFormComplete,
  sanitizeAvisoVeiculoFields,
  type AvisoVeiculoFields,
} from '@/utils/avisoVeiculoText';

type Props = {
  /** Volta à grelha de atalhos. */
  onClose: () => void;
};

const emptyFields: AvisoVeiculoFields = { marca: '', modelo: '', placa: '', cor: '' };

export function AvisoVeiculosPanel({ onClose }: Props) {
  const transporteOk = useAppStore(
    (s) =>
      s.status !== 'desativado' &&
      isCtrlPlayerEnabled(s.pdv) &&
      isCtrlPlacaCarroEnabled(s.pdv),
  );

  const [fields, setFields] = useState<AvisoVeiculoFields>(emptyFields);
  const [busy, setBusy] = useState<'idle' | 'gerando' | 'tocando'>('idle');
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

  const disabled = busy !== 'idle' || !transporteOk;

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
    const estado = useAppStore.getState();
    const estavaTocando = estado.status === 'tocando';

    setBusy('gerando');
    useAppStore.setState({ status: 'pausado' });

    let objectUrl: string | null = null;
    try {
      const blob = await fetchAvisoVeiculoMp3(sanitized);
      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      anuncioRef.current = audio;
      setBusy('tocando');

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
        };
        audio.onended = () => {
          cleanup();
          resolve();
        };
        audio.onerror = () => {
          cleanup();
          reject(new Error('Erro ao reproduzir o áudio gerado.'));
        };
        void audio.play().catch((e) => {
          cleanup();
          reject(e instanceof Error ? e : new Error('Reprodução bloqueada pelo navegador.'));
        });
      });

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      anuncioRef.current = null;

      if (estavaTocando) {
        useAppStore.setState({ status: 'tocando' });
      }
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const a = anuncioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
      anuncioRef.current = null;

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
            : 'Não foi possível completar o aviso. Verifique a ligação e a configuração do serviço de voz.',
        );
      }
    } finally {
      setBusy('idle');
    }
  }

  const previewText = buildAvisoVeiculoSpeech(fields);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-amber-400/95">Aviso veículos</h2>
          <p className="mt-1 text-xs text-zinc-500">
            A reprodução pausa durante o aviso. O áudio é gerado na nuvem (voz sintética).
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== 'idle'}
          className="rounded-xl border border-zinc-600/70 bg-zinc-950/80 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Voltar
        </button>
      </div>

      {!transporteOk && (
        <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          O painel desativou o controlo local ou o aviso de veículo (ctrl_placa_carro) para este PDV.
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Marca do veículo
            </span>
            <input
              type="text"
              name="marca"
              autoComplete="off"
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
              value={fields.cor}
              onChange={(e) => update('cor', e.target.value)}
              placeholder="Ex.: prata"
              className="w-full rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:opacity-50"
              maxLength={AVISO_VEICULO_LIMITS.cor}
            />
          </label>
        </div>

        <p className="rounded-xl border border-white/6 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          <span className="font-semibold text-zinc-500">Texto do aviso:</span>{' '}
          <span className="text-zinc-300">{previewText}</span>
        </p>

        {erro && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-3 py-2 text-xs text-red-100">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled || !isAvisoVeiculoFormComplete(fields)}
          className="w-full rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-600/25 via-amber-500/15 to-orange-600/25 py-3 text-sm font-bold text-amber-100 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[200px] sm:px-8"
        >
          {busy === 'idle' ? 'Gerar aviso e reproduzir' : busy === 'gerando' ? 'Gerando voz…' : 'Reproduzindo…'}
        </button>
      </form>
    </div>
  );
}
