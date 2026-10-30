import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  billingAvailable,
  cachedActive,
  entitlementOf,
  getAppUserId,
  getCustomerInfo,
  getPackages,
  getPremiumConfig,
  purchase,
  PurchaseCancelled,
  PREMIUM_CACHE,
  restorePurchases,
  type CustomerInfo,
  type EntitlementInfo,
  type PremiumCache,
  type PurchasesPackage,
} from './billing';

export interface PremiumState {
  /** Subscriptions can be bought in this app (store app + RevenueCat configured). */
  available: boolean;
  /** 'loading' until the first check finishes (offline falls back to the last known status). */
  status: 'loading' | 'free' | 'premium';
  isPremium: boolean;
  entitlement: EntitlementInfo | null;
  managementURL: string | null;
  packages: PurchasesPackage[];
  /** RevenueCat's id for this person; the coach server uses it to confirm the subscription. */
  userId: string | null;
  /** Address of the Premium coach server, when configured. */
  coachUrl: string | null;
  busy: boolean;
  error: string | null;
  buy(pkg: PurchasesPackage): Promise<'done' | 'cancelled' | 'failed'>;
  restore(): Promise<'restored' | 'none' | 'failed'>;
  refresh(): Promise<void>;
}

const Ctx = createContext<PremiumState | null>(null);

function readCache(): PremiumCache | null {
  try {
    return JSON.parse(localStorage.getItem(PREMIUM_CACHE) || 'null') as PremiumCache | null;
  } catch {
    return null;
  }
}

function writeCache(e: EntitlementInfo | null) {
  try {
    localStorage.setItem(PREMIUM_CACHE, JSON.stringify({ active: !!e, expires: e?.expirationDate ?? null, checkedAt: Date.now() } satisfies PremiumCache));
  } catch {
    /* ignore */
  }
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const available = useMemo(() => billingAvailable(), []);
  const cfg = getPremiumConfig();
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (ci: CustomerInfo) => {
      setInfo(ci);
      setChecked(true);
      writeCache(entitlementOf(ci, cfg.entitlement));
    },
    [cfg.entitlement],
  );

  const refresh = useCallback(async () => {
    if (!available) return;
    try {
      apply(await getCustomerInfo());
      setError(null);
    } catch {
      setChecked(true); // offline or store unreachable: keep the cached status
    }
  }, [available, apply]);

  useEffect(() => {
    if (!available) return;
    void refresh();
    getPackages()
      .then(setPackages)
      .catch(() => setError('Couldn’t load prices from the App Store. Check your connection.'));
    getAppUserId()
      .then(setUserId)
      .catch(() => undefined);
    // Renewals, cancellations and refunds happen outside the app — re-check when it comes back.
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [available, refresh]);

  const entitlement = entitlementOf(info, cfg.entitlement);
  const isPremium = available && (info ? !!entitlement : cachedActive(readCache()));
  const status: PremiumState['status'] = !available ? 'free' : !checked && !readCache() ? 'loading' : isPremium ? 'premium' : 'free';

  const buy = useCallback(
    async (pkg: PurchasesPackage) => {
      setBusy(true);
      setError(null);
      try {
        apply(await purchase(pkg));
        return 'done' as const;
      } catch (e) {
        if (e instanceof PurchaseCancelled) return 'cancelled' as const;
        setError('The purchase didn’t go through. You haven’t been charged — try again in a moment.');
        return 'failed' as const;
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  const restore = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const ci = await restorePurchases();
      apply(ci);
      return entitlementOf(ci, cfg.entitlement) ? ('restored' as const) : ('none' as const);
    } catch {
      setError('Couldn’t reach the App Store to restore purchases. Try again in a moment.');
      return 'failed' as const;
    } finally {
      setBusy(false);
    }
  }, [apply, cfg.entitlement]);

  const value: PremiumState = {
    available,
    status,
    isPremium,
    entitlement,
    managementURL: info?.managementURL ?? null,
    packages,
    userId,
    coachUrl: cfg.coachUrl,
    busy,
    error,
    buy,
    restore,
    refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const FALLBACK: PremiumState = {
  available: false,
  status: 'free',
  isPremium: false,
  entitlement: null,
  managementURL: null,
  packages: [],
  userId: null,
  coachUrl: null,
  busy: false,
  error: null,
  buy: async () => 'failed',
  restore: async () => 'failed',
  refresh: async () => undefined,
};

export function usePremium(): PremiumState {
  return useContext(Ctx) ?? FALLBACK;
}
