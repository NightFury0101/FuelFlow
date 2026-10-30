import { useEffect, useState } from 'react';
import { resolveAi, type AiConfig, type PremiumCoach } from './ai';
import { useStore } from './store';
import { usePremium } from './premium';

/** The Premium coach connection when this person is subscribed and the server is set up. */
export function usePremiumCoach(): PremiumCoach {
  const p = usePremium();
  return p.isPremium && p.coachUrl && p.userId ? { url: p.coachUrl, userId: p.userId } : null;
}

/** Current AI connection (on-device key or server), updated when the user changes it. */
export function useAi(): AiConfig | null {
  const { profile } = useStore();
  const premium = usePremiumCoach();
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
  return resolveAi(profile?.scannerEndpoint, premium);
}
