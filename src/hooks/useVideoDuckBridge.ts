/**
 * Polling da ponte HTTP do player vídeo (Electron) na mesma máquina.
 * Quando `duck=true`, o loop de áudio pausa sem mudar o estado «tocando» na UI.
 */

import { useEffect } from 'react';

import { getVideoBridgeUrl } from '@/api/config';
import { useAppStore } from '@/store/app';

const POLL_MS = 750;

export function useVideoDuckBridge() {
  const setVideoDuckActive = useAppStore((s) => s.setVideoDuckActive);

  useEffect(() => {
    const base = getVideoBridgeUrl();
    if (!base) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${base}/duck`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { duck?: unknown };
        if (!cancelled) {
          setVideoDuckActive(body.duck === true);
        }
      } catch {
        if (!cancelled) setVideoDuckActive(false);
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      setVideoDuckActive(false);
    };
  }, [setVideoDuckActive]);
}
