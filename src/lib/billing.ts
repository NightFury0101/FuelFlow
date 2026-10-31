// In-app subscriptions for the store apps, through RevenueCat's Capacitor plugin
// (@revenuecat/purchases-capacitor, compiled into the iPhone app). Apple takes the payment;
// RevenueCat validates receipts and tells us whether the "premium" entitlement is active.
// The plugin is called through Capacitor's native bridge, so the website ships no billing code.

import { premiumConfig, type PremiumConfig } from '../premiumConfig';
import { getPlatform, isNativeApp } from './platform';

// ---------- Shapes returned by the plugin (only the fields we use) ----------

export interface StoreProduct {
  identifier: string;
  title?: string;
  priceString: string;
  price: number;
  currencyCode?: string;
  introPrice?: { priceString: string; price: number; periodNumberOfUnits: number; periodUnit: string } | null;
}

export interface PurchasesPackage {
  identifier: string;
  packageType: string; // 'MONTHLY' | 'ANNUAL' | 'WEEKLY' | 'SIX_MONTH' | 'THREE_MONTH' | 'TWO_MONTH' | 'LIFETIME' | 'CUSTOM'
  product: StoreProduct;
  offeringIdentifier?: string;
  presentedOfferingContext?: unknown;
}

export interface EntitlementInfo {
  isActive: boolean;
  willRenew: boolean;
  expirationDate: string | null;
  productIdentifier: string;
  periodType?: string; // 'TRIAL' | 'INTRO' | 'NORMAL'
}

export interface CustomerInfo {
  entitlements: { active: Record<string, EntitlementInfo> };
  managementURL?: string | null;
}

// ---------- Configuration ----------

const DEV_KEY = 'fuelflow:dev-premium';

/** The Premium settings; on localhost only, a test config can come from localStorage. */
export function getPremiumConfig(): PremiumConfig {
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const raw = localStorage.getItem(DEV_KEY);
      if (raw) return { ...premiumConfig, ...(JSON.parse(raw) as Partial<PremiumConfig>) };
    }
  } catch {
    /* not in a browser */
  }
  return premiumConfig;
}

type Bridge = {
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  PluginHeaders?: Array<{ name: string }>;
};
const bridge = () => (typeof window === 'undefined' ? undefined : (window as Window & { Capacitor?: Bridge }).Capacitor);

/** RevenueCat's public key for this app's store (Apple or Google Play), or null. */
export function storeKey(): string | null {
  const cfg = getPremiumConfig();
  const p = getPlatform();
  return p === 'ios' ? cfg.revenueCatAppleKey : p === 'android' ? cfg.revenueCatGoogleKey ?? null : null;
}

/** Subscriptions can be offered: store app, plugin present and a RevenueCat key configured. */
export function billingAvailable(): boolean {
  if (!isNativeApp() || !storeKey()) return false;
  const b = bridge();
  if (!b?.nativePromise) return false;
  return !b.PluginHeaders || b.PluginHeaders.some((p) => p.name === 'Purchases');
}

/**
 * Whether to show the Premium screen. The website always explains Premium (and points to the
 * app). The store apps only show it once subscriptions can really be bought there — App Store
 * rules don't allow advertising plans that can't be purchased in the app.
 */
export function showPremium(): boolean {
  return !isNativeApp() || billingAvailable();
}

function call<T>(method: string, options?: unknown): Promise<T> {
  const b = bridge();
  if (!b?.nativePromise) return Promise.reject(new Error('Subscriptions are only available in the app.'));
  return b.nativePromise('Purchases', method, options ?? {}) as Promise<T>;
}

let configured: Promise<void> | null = null;

export function configureBilling(): Promise<void> {
  if (!configured) {
    const key = storeKey();
    configured = key ? call<void>('configure', { apiKey: key }) : Promise.reject(new Error('Premium isn’t set up.'));
    configured.catch(() => (configured = null));
  }
  return configured;
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  await configureBilling();
  const r = await call<{ current?: { availablePackages?: PurchasesPackage[] } | null }>('getOfferings');
  return sortPackages(r?.current?.availablePackages ?? []);
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  await configureBilling();
  const r = await call<{ customerInfo: CustomerInfo }>('getCustomerInfo');
  return r.customerInfo;
}

export async function getAppUserId(): Promise<string> {
  await configureBilling();
  const r = await call<{ appUserID: string }>('getAppUserID');
  return r.appUserID;
}

export class PurchaseCancelled extends Error {}

/** True when the error means the person closed Apple's payment sheet. */
export function isCancelError(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown; data?: { userCancelled?: unknown } } | null;
  return err?.data?.userCancelled === true || String(err?.code) === '1' || /cancel/i.test(String(err?.message ?? ''));
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
  await configureBilling();
  try {
    const r = await call<{ customerInfo: CustomerInfo }>('purchasePackage', { aPackage: pkg });
    return r.customerInfo;
  } catch (e) {
    if (isCancelError(e)) throw new PurchaseCancelled('Purchase cancelled');
    throw e;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  await configureBilling();
  const r = await call<{ customerInfo: CustomerInfo }>('restorePurchases');
  return r.customerInfo;
}

// ---------- Pure helpers ----------

export function entitlementOf(info: CustomerInfo | null | undefined, id: string): EntitlementInfo | null {
  const e = info?.entitlements?.active?.[id];
  return e && e.isActive !== false ? e : null;
}

const ORDER = ['ANNUAL', 'SIX_MONTH', 'THREE_MONTH', 'TWO_MONTH', 'MONTHLY', 'WEEKLY', 'LIFETIME'];

/** Longest period first (yearly is usually the better deal), unknown types last. */
export function sortPackages(list: PurchasesPackage[]): PurchasesPackage[] {
  const rank = (p: PurchasesPackage) => (ORDER.includes(p.packageType) ? ORDER.indexOf(p.packageType) : ORDER.length);
  return [...list].filter((p) => p?.product?.priceString).sort((a, b) => rank(a) - rank(b));
}

const PERIOD: Record<string, { label: string; months: number | null }> = {
  ANNUAL: { label: 'year', months: 12 },
  SIX_MONTH: { label: '6 months', months: 6 },
  THREE_MONTH: { label: '3 months', months: 3 },
  TWO_MONTH: { label: '2 months', months: 2 },
  MONTHLY: { label: 'month', months: 1 },
  WEEKLY: { label: 'week', months: null },
  LIFETIME: { label: 'one-time', months: null },
};

export function periodLabel(p: PurchasesPackage): string {
  return PERIOD[p.packageType]?.label ?? 'period';
}

export function planName(p: PurchasesPackage): string {
  const names: Record<string, string> = { ANNUAL: 'Yearly', SIX_MONTH: '6 months', THREE_MONTH: '3 months', TWO_MONTH: '2 months', MONTHLY: 'Monthly', WEEKLY: 'Weekly', LIFETIME: 'Lifetime' };
  return names[p.packageType] ?? p.product.title ?? 'Premium';
}

/** Whole-percent saving of a longer plan against paying monthly, or null. */
export function savingVsMonthly(p: PurchasesPackage, all: PurchasesPackage[]): number | null {
  const monthly = all.find((x) => x.packageType === 'MONTHLY');
  const months = PERIOD[p.packageType]?.months;
  if (!monthly || !months || months <= 1 || !(monthly.product.price > 0)) return null;
  const pct = Math.round((1 - p.product.price / (monthly.product.price * months)) * 100);
  return pct >= 5 ? pct : null;
}

/** "1 week free", "3 months for $0.99" — or null when there's no introductory offer. */
export function introText(p: PurchasesPackage): string | null {
  const i = p.product.introPrice;
  if (!i || !i.periodNumberOfUnits) return null;
  const unit = String(i.periodUnit || '').toLowerCase().replace(/s$/, '');
  const span = `${i.periodNumberOfUnits} ${unit}${i.periodNumberOfUnits === 1 ? '' : 's'}`;
  return i.price === 0 ? `${span} free` : `${i.priceString} for ${span}`;
}

// ---------- Offline cache of the last known status ----------

export const PREMIUM_CACHE = 'fuelflow:premium:v1';
export interface PremiumCache {
  active: boolean;
  expires: string | null;
  checkedAt: number;
}

/**
 * Whether to treat the person as Premium without a fresh check (e.g. offline): the cached
 * subscription hasn't expired, or it was confirmed within the last 3 days.
 */
export function cachedActive(c: PremiumCache | null, now = Date.now()): boolean {
  if (!c?.active) return false;
  if (c.expires) return Date.parse(c.expires) > now;
  return now - c.checkedAt < 3 * 24 * 3600 * 1000;
}
