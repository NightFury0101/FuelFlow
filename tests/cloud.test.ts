import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error — plain JS test helper
import { createFakeFirebase } from './fake-firebase.mjs';
import { emptyData } from '../src/lib/storage';
import type { AppData, FoodEntry, Profile } from '../src/lib/types';

// Minimal browser globals for the cloud modules.
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).location = { hostname: 'localhost' };

const { signUp, signIn, freshSession, sendPasswordReset, errorCode, AuthError } = await import('../src/lib/cloud/auth');
const { diff, fullOps, mergeQueue, settleQueue, applyOps, unionData, push, pull, deleteAllRemote, setSyncId } = await import('../src/lib/cloud/sync');
const { docId } = await import('../src/lib/cloud/firestore');

let fb: ReturnType<typeof createFakeFirebase>;
beforeEach(() => {
  mem.clear();
  fb = createFakeFirebase();
  globalThis.fetch = fb.fetch;
  mem.set('fuelflow:dev-firebase', JSON.stringify(fb.config));
});

const profile = { name: 'Aisha', onboarded: true, meals: [], targets: { kcal: 1600 } } as unknown as Profile;
const entry = (id: string, kcal: number, date = '2026-10-30'): FoodEntry => {
  const n = { kcal, protein: 1, carbs: 1, fat: 1 };
  return { id, date, meal: 'lunch', createdAt: 1, food: { id: 'f' + id, name: 'Food ' + id, source: 'manual', baseUnit: 'serving', baseAmount: 1, nutrients: n, servings: [] }, servingLabel: '1 serving', quantity: 1, amount: 1, nutrients: n };
};
const data = (over: Partial<AppData> = {}): AppData => ({ ...emptyData(), profile, ...over });

test('diff finds adds, edits, deletes and profile changes only', () => {
  const a = data({ entries: [entry('a', 100), entry('b', 200)] });
  const b = { ...a, entries: [a.entries[0], { ...a.entries[1], nutrients: { ...a.entries[1].nutrients, kcal: 250 } }, entry('c', 300)] };
  const ops = diff(a, b);
  assert.deepEqual(ops.map((o) => `${o.col}/${o.id}/${o.value ? 'set' : 'del'}`).sort(), ['entries/b/set', 'entries/c/set']);
  const c = { ...b, entries: b.entries.slice(1) };
  assert.deepEqual(diff(b, c).map((o) => `${o.id}/${o.value ? 'set' : 'del'}`), ['a/del']);
  assert.deepEqual(diff(c, { ...c }), [], 'no-op change makes no ops');
  const d = { ...c, profile: { ...profile, name: 'Ash' } };
  assert.equal(diff(c, d)[0].col, 'profile');
});

test('queue keeps the latest op per record and only settles what was sent', () => {
  let q = mergeQueue([], [{ col: 'entries', id: 'a', value: { v: 1 } }]);
  q = mergeQueue(q, [{ col: 'entries', id: 'a', value: { v: 2 } }, { col: 'water', id: 'w', value: null }]);
  assert.equal(q.length, 2);
  assert.deepEqual(q.find((o) => o.id === 'a')!.value, { v: 2 });
  const sent = [...q];
  q = mergeQueue(q, [{ col: 'entries', id: 'a', value: { v: 3 } }]); // edited while pushing
  q = settleQueue(q, sent);
  assert.deepEqual(q, [{ col: 'entries', id: 'a', value: { v: 3 } }]);
});

test('union keeps everything from both sides; account wins on conflicts', () => {
  const remote = data({ entries: [entry('a', 100)] });
  const local = data({ entries: [{ ...entry('a', 999) }, entry('b', 200)], profile: { ...profile, name: 'Local' } });
  const { data: merged, upload } = unionData(remote, local);
  assert.equal(merged.entries.length, 2);
  assert.equal(merged.entries.find((e) => e.id === 'a')!.nutrients.kcal, 100);
  assert.equal(merged.profile!.name, 'Aisha');
  assert.deepEqual(upload.map((o) => o.id), ['b']);
  const fresh = unionData(emptyData(), local);
  assert.equal(fresh.data.profile!.name, 'Local');
  assert.ok(fresh.upload.some((o) => o.col === 'profile'));
});

test('applyOps re-applies unsynced changes on top of pulled data', () => {
  const remote = data({ entries: [entry('a', 100), entry('b', 200)] });
  const out = applyOps(remote, [
    { col: 'entries', id: 'b', value: null },
    { col: 'entries', id: 'c', value: entry('c', 50) },
  ]);
  assert.deepEqual(out.entries.map((e) => e.id).sort(), ['a', 'c']);
});

test('doc ids are safe for Firestore and stable', () => {
  assert.equal(docId('e-123_abc'), 'e-123_abc');
  assert.equal(docId('off:737628064502'), 'off~3a737628064502');
  assert.equal(docId('a/b'), 'a~2fb');
  assert.notEqual(docId('__x__'), '__x__');
});

test('auth: sign up, wrong password, reset, refresh', async () => {
  const s = await signUp('aisha@example.com', 'secret12');
  assert.ok(s.uid && s.idToken && s.refreshToken);
  await assert.rejects(signUp('aisha@example.com', 'secret12'), (e: Error) => /already exists/.test(e.message));
  await assert.rejects(signUp('bad', 'secret12'), (e: Error) => /valid email/.test(e.message));
  await assert.rejects(signUp('x@example.com', '123'), (e: Error) => /at least 6/.test(e.message));
  await assert.rejects(signIn('aisha@example.com', 'wrong'), (e: Error) => /incorrect/.test(e.message));
  const again = await signIn('aisha@example.com', 'secret12');
  assert.equal(again.uid, s.uid);
  await sendPasswordReset('aisha@example.com');
  const refreshed = await freshSession({ ...s, expiresAt: Date.now() });
  assert.notEqual(refreshed.idToken, s.idToken);
  assert.equal(refreshed.uid, s.uid);
  assert.equal(errorCode('WEAK_PASSWORD : Password should be at least 6 characters'), 'WEAK_PASSWORD');
  assert.ok(new AuthError('x', 'Y') instanceof Error);
});

test('push then pull round-trips the whole account', async () => {
  const s = await signUp('a@example.com', 'secret12');
  const local = data({ entries: [entry('a', 100), entry('b', 200)], water: [{ id: 'w1', date: '2026-10-30', ml: 250, createdAt: 1 }] });
  const r1 = await push(s.uid, s.idToken, fullOps(local));
  assert.equal(r1.otherDeviceChanged, false);
  const got = await pull(s.uid, s.idToken);
  assert.ok(got.exists);
  assert.equal(got.data.profile!.name, 'Aisha');
  assert.equal(got.data.entries.length, 2);
  assert.equal(got.data.water[0].ml, 250);
  assert.equal(got.syncId, r1.syncId);
  // Delete + edit
  await push(s.uid, s.idToken, [{ col: 'entries', id: 'a', value: null }, { col: 'entries', id: 'b', value: { ...entry('b', 222) } }]);
  const got2 = await pull(s.uid, s.idToken);
  assert.deepEqual(got2.data.entries.map((e) => [e.id, e.nutrients.kcal]), [['b', 222]]);
});

test('a second device is detected, and paging handles big diaries', async () => {
  const s = await signUp('b@example.com', 'secret12');
  const many = Array.from({ length: 650 }, (_, i) => entry('e' + i, i)); // > 1 commit batch, > 2 pages
  await push(s.uid, s.idToken, fullOps(data({ entries: many })));
  assert.equal((await pull(s.uid, s.idToken)).data.entries.length, 650);
  // Device B pushes; device A (whose last known marker is older) must learn it should pull.
  const known = mem.get('fuelflow:sync-id')!;
  await push(s.uid, s.idToken, [{ col: 'entries', id: 'x', value: entry('x', 1) }]); // "device B"
  setSyncId(known); // back on device A
  const r = await push(s.uid, s.idToken, [{ col: 'entries', id: 'y', value: entry('y', 1) }]);
  assert.equal(r.otherDeviceChanged, true);
});

test('users can never touch another account', async () => {
  const a = await signUp('one@example.com', 'secret12');
  const b = await signUp('two@example.com', 'secret12');
  await push(a.uid, a.idToken, fullOps(data({ entries: [entry('a', 1)] })));
  await assert.rejects(pull(a.uid, b.idToken), (e: Error) => /refused/.test(e.message));
  await assert.rejects(push(a.uid, b.idToken, [{ col: 'entries', id: 'z', value: entry('z', 1) }]), (e: Error) => /refused/.test(e.message));
});

test('deleting all remote data leaves nothing behind', async () => {
  const s = await signUp('c@example.com', 'secret12');
  await push(s.uid, s.idToken, fullOps(data({ entries: [entry('a', 1), entry('b', 2)] })));
  assert.ok(fb.docs.size > 0);
  await deleteAllRemote(s.uid, s.idToken);
  assert.equal([...fb.docs.keys()].filter((k: string) => k.startsWith(`users/${s.uid}`)).length, 0);
});
