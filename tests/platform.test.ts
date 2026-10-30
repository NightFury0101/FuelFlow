import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNativeApp } from '../src/lib/platform';
import { showPremium } from '../src/lib/billing';

const g = globalThis as unknown as { window?: unknown };

test('web browser: not native, Premium shown', () => {
  g.window = {};
  assert.equal(isNativeApp(), false);
  assert.equal(showPremium(), true);
});

test('store app (Capacitor): native, Premium hidden', () => {
  g.window = { Capacitor: { isNativePlatform: () => true } };
  assert.equal(isNativeApp(), true);
  assert.equal(showPremium(), false);
});

test('Capacitor web fallback or a broken global is treated as the browser', () => {
  g.window = { Capacitor: { isNativePlatform: () => false } };
  assert.equal(isNativeApp(), false);
  g.window = { Capacitor: { isNativePlatform: () => { throw new Error('x'); } } };
  assert.equal(isNativeApp(), false);
  delete g.window;
});
