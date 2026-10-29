import { useEffect, useState } from 'react';
import { resolveAi, type AiConfig } from './ai';
import { useStore } from './store';

/** Current AI connection (on-device key or server), updated when the user changes it. */
export function useAi(): AiConfig | null {
  const { profile } = useStore();
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener('fuelflow:ai-changed', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('fuelflow:ai-changed', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return resolveAi(profile?.scannerEndpoint);
}
