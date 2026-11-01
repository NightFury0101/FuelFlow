import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consentId, disclosure, hasConsent } from '../src/lib/aiConsent';
import { buildContext } from '../src/lib/coach';
import { emptyData } from '../src/lib/storage';
import type { Profile } from '../src/lib/types';

test('consent is tied to the exact AI destination', () => {
  const gemini = consentId({ kind: 'key', provider: 'gemini', key: 'k' });
  const claude = consentId({ kind: 'key', provider: 'claude', key: 'k' });
  const prem = consentId({ kind: 'premium', url: 'https://c.example', userId: 'u' }, 'claude');
  const premGemini = consentId({ kind: 'premium', url: 'https://c.example', userId: 'u' }, 'gemini');
  const server = consentId({ kind: 'server', url: 'https://coach.example.com/chat' });
  assert.deepEqual(new Set([gemini, claude, prem, premGemini, server]).size, 5);
  assert.equal(server, 'server:coach.example.com');

  assert.equal(hasConsent(undefined, gemini), false);
  assert.equal(hasConsent({}, gemini), false);
  assert.equal(hasConsent({ aiConsent: gemini }, gemini), true);
  // Switching provider asks again.
  assert.equal(hasConsent({ aiConsent: gemini }, claude), false);
  assert.equal(hasConsent({ aiConsent: prem }, premGemini), false);
});

test('disclosure names the company that receives the data', () => {
  assert.equal(disclosure({ kind: 'key', provider: 'gemini', key: 'k' }).recipient, 'Google (Gemini)');
  assert.equal(disclosure({ kind: 'key', provider: 'claude', key: 'k' }).recipient, 'Anthropic (Claude)');
  assert.equal(disclosure({ kind: 'premium', url: 'x', userId: 'u' }, 'gemini').recipient, 'Google (Gemini)');
  assert.match(disclosure({ kind: 'key', provider: 'gemini', key: 'k' }).note ?? '', /improve its products/);
});

test('coach context never includes name, email or date of birth', () => {
  const profile: Profile = {
    name: 'Zaina Unique',
    sex: 'female',
    birthDate: '1999-04-12',
    activity: 'light',
    goal: 'lose',
    special: 'none',
    diet: [],
    units: { weight: 'kg', height: 'cm', water: 'ml' },
    targets: { kcal: 1800, protein: 100, carbs: 200, fat: 60, waterMl: 2000 },
    targetsCustomized: false,
    meals: [{ id: 'breakfast', name: 'Breakfast' }],
    onboarded: true,
    setupIncomplete: false,
    waterQuickAdds: [250, 500],
    createdAt: 0,
  } as Profile;
  for (const share of [false, true]) {
    const ctx = buildContext(profile, { ...emptyData(), profile }, share, '2026-11-01');
    assert.doesNotMatch(ctx, /Zaina|Unique|1999|04-12/);
  }
});
