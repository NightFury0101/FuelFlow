import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedActive, entitlementOf, introText, isCancelError, periodLabel, savingVsMonthly, sortPackages, type PurchasesPackage } from '../src/lib/billing';

const pkg = (packageType: string, price: number, priceString: string, intro?: PurchasesPackage['product']['introPrice']): PurchasesPackage => ({
  identifier: `$rc_${packageType.toLowerCase()}`,
  packageType,
  product: { identifier: `p.${packageType}`, price, priceString, introPrice: intro ?? null },
});

test('plans are listed yearly first and broken packages are dropped', () => {
  const list = sortPackages([pkg('MONTHLY', 2.99, '$2.99'), pkg('ANNUAL', 19.99, '$19.99'), { identifier: 'x', packageType: 'CUSTOM', product: { identifier: 'x', price: 1, priceString: '' } }]);
  assert.deepEqual(list.map((p) => p.packageType), ['ANNUAL', 'MONTHLY']);
  assert.equal(periodLabel(list[0]), 'year');
});

test('yearly saving is worked out against 12 months of the monthly price', () => {
  const all = [pkg('MONTHLY', 2.99, '$2.99'), pkg('ANNUAL', 19.99, '$19.99')];
  assert.equal(savingVsMonthly(all[1], all), 44);
  assert.equal(savingVsMonthly(all[0], all), null);
  assert.equal(savingVsMonthly(all[1], [all[1]]), null);
});

test('introductory offers read naturally', () => {
  assert.equal(introText(pkg('ANNUAL', 19.99, '$19.99', { price: 0, priceString: '$0.00', periodNumberOfUnits: 1, periodUnit: 'WEEK' })), '1 week free');
  assert.equal(introText(pkg('MONTHLY', 2.99, '$2.99', { price: 0.99, priceString: '$0.99', periodNumberOfUnits: 3, periodUnit: 'MONTH' })), '$0.99 for 3 months');
  assert.equal(introText(pkg('MONTHLY', 2.99, '$2.99')), null);
});

test('entitlement must be present and active', () => {
  const info = { entitlements: { active: { premium: { isActive: true, willRenew: true, expirationDate: null, productIdentifier: 'p' } } } };
  assert.ok(entitlementOf(info, 'premium'));
  assert.equal(entitlementOf(info, 'pro'), null);
  assert.equal(entitlementOf(null, 'premium'), null);
});

test('offline status: trust a cached subscription until it expires, or for 3 days without an expiry', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  assert.equal(cachedActive({ active: true, expires: '2026-11-05T00:00:00Z', checkedAt: 0 }, now), true);
  assert.equal(cachedActive({ active: true, expires: '2026-10-30T00:00:00Z', checkedAt: now }, now), false);
  assert.equal(cachedActive({ active: true, expires: null, checkedAt: now - 2 * 86400000 }, now), true);
  assert.equal(cachedActive({ active: true, expires: null, checkedAt: now - 4 * 86400000 }, now), false);
  assert.equal(cachedActive({ active: false, expires: '2027-01-01T00:00:00Z', checkedAt: now }, now), false);
  assert.equal(cachedActive(null, now), false);
});

test('closing the Apple payment sheet counts as a cancel, other errors do not', () => {
  assert.ok(isCancelError({ code: '1', message: 'Purchase was cancelled.' }));
  assert.ok(isCancelError({ data: { userCancelled: true } }));
  assert.ok(!isCancelError({ code: '2', message: 'Store problem' }));
});
