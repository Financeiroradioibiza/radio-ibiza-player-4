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
    let cancelled = false;
    let intervalId = 0;

    const poll = async () => {
      const base = getVideoBridgeUrl();
      if (!base) return;

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

    const startPolling = () => {
      void poll();
      intervalId = window.setInterval(() => void poll(), POLL_MS);
    };

    if (getVideoBridgeUrl()) {
      startPolling();
    } else {
      /** Bundle remoto: preload pode expor ponte logo após — tentar durante 30s. */
      let attempts = 0;
      const waitId = window.setInterval(() => {
        if (cancelled) return;
        attempts += 1;
        if (getVideoBridgeUrl()) {
          window.clearInterval(waitId);
          startPolling();
        } else if (attempts > 60) {
          window.clearInterval(waitId);
        }
      }, 500);
      return () => {
        cancelled = true;
        window.clearInterval(waitId);
        window.clearInterval(intervalId);
        setVideoDuckActive(false);
      };
    }

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      setVideoDuckActive(false);
    };
  }, [setVideoDuckActive]);
}
