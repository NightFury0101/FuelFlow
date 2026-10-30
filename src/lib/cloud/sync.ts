// Cloud sync for FuelFlow.
//
// The phone keeps its own copy of everything (so the app is instant and works offline).
// Each change becomes an "op" in a queue saved on the device; the queue is pushed to
// Firestore when online. On sign-in and when the app opens, the account's data is pulled
// and any ops not yet pushed are re-applied on top, so nothing typed offline is lost.
//
// Firestore layout (one document per record, see firestore.rules):
//   users/{uid}                      → { json: {profile, recents, schemaVersion}, syncId, updatedAt }
//   users/{uid}/{collection}/{docId} → { json: <record>, updatedAt }

import type { AppData } from '../types';
import { normalizeData, emptyData } from '../storage';
import { commit, docId, getDoc, listCollection, relativePath, type Write } from './firestore';

export const COLLECTIONS = ['entries', 'water', 'weights', 'planned', 'customFoods', 'favorites', 'savedMeals'] as const;
export type Collection = (typeof COLLECTIONS)[number];

/** A pending change. value === null means delete. */
export interface Op {
  col: Collection | 'profile';
  id: string;
  value: unknown;
}

type WithId = { id: string };

export const QUEUE_KEY = 'fuelflow:sync-queue';
export const OWNER_KEY = 'fuelflow:data-owner';
export const SYNC_ID_KEY = 'fuelflow:sync-id';

export function profileDoc(d: AppData) {
  return { profile: d.profile, recents: d.recents, schemaVersion: d.schemaVersion };
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const key = (op: Pick<Op, 'col' | 'id'>) => `${op.col}/${op.id}`;

/** Ops that turn `prev` into `next`. */
export function diff(prev: AppData, next: AppData): Op[] {
  const ops: Op[] = [];
  for (const col of COLLECTIONS) {
    const a = prev[col] as WithId[];
    const b = next[col] as WithId[];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Set<string>();
    for (const item of b) {
      after.add(item.id);
      const old = before.get(item.id);
      if (!old || !same(old, item)) ops.push({ col, id: item.id, value: item });
    }
    for (const item of a) if (!after.has(item.id)) ops.push({ col, id: item.id, value: null });
  }
  if ((prev.profile !== next.profile || prev.recents !== next.recents) && !same(profileDoc(prev), profileDoc(next))) {
    ops.push({ col: 'profile', id: 'main', value: profileDoc(next) });
  }
  return ops;
}

/** Every record as a set op (used when first uploading a phone's data). */
export function fullOps(d: AppData): Op[] {
  const ops: Op[] = [{ col: 'profile', id: 'main', value: profileDoc(d) }];
  for (const col of COLLECTIONS) for (const item of d[col] as WithId[]) ops.push({ col, id: item.id, value: item });
  return ops;
}

/** Add ops to a queue; a later op for the same record replaces an earlier one. */
export function mergeQueue(queue: Op[], ops: Op[]): Op[] {
  const m = new Map(queue.map((o) => [key(o), o]));
  for (const o of ops) {
    m.delete(key(o));
    m.set(key(o), o);
  }
  return [...m.values()];
}

/** Remove ops that were pushed, unless the record changed again in the meantime. */
export function settleQueue(queue: Op[], sent: Op[]): Op[] {
  const sentByKey = new Map(sent.map((o) => [key(o), o]));
  return queue.filter((o) => {
    const s = sentByKey.get(key(o));
    return !(s && same(s.value, o.value));
  });
}

/** Apply ops on top of a snapshot (e.g. unsynced local changes on top of freshly pulled data). */
export function applyOps(d: AppData, ops: Op[]): AppData {
  const next: AppData = { ...d };
  for (const op of ops) {
    if (op.col === 'profile') {
      const p = (op.value || {}) as Partial<ReturnType<typeof profileDoc>>;
      next.profile = p.profile ?? null;
      next.recents = Array.isArray(p.recents) ? p.recents : [];
      continue;
    }
    const list = (next[op.col] as WithId[]).filter((x) => x.id !== op.id);
    if (op.value != null) list.push(op.value as WithId);
    (next as unknown as Record<string, WithId[]>)[op.col] = list;
  }
  return normalizeData(next);
}

export function hasAnyData(d: AppData): boolean {
  return !!d.profile || COLLECTIONS.some((c) => (d[c] as unknown[]).length > 0);
}

/**
 * First sign-in on a phone that already has data: keep everything from both sides.
 * The account's version wins where the same record exists in both.
 * Returns the merged data and the ops needed to upload what only this phone had.
 */
export function unionData(remote: AppData, local: AppData): { data: AppData; upload: Op[] } {
  const upload: Op[] = [];
  const merged: AppData = { ...remote };
  for (const col of COLLECTIONS) {
    const have = new Set((remote[col] as WithId[]).map((x) => x.id));
    const extra = (local[col] as WithId[]).filter((x) => !have.has(x.id));
    for (const x of extra) upload.push({ col, id: x.id, value: x });
    (merged as unknown as Record<string, WithId[]>)[col] = [...(remote[col] as WithId[]), ...extra];
  }
  if (!remote.profile && local.profile) {
    merged.profile = local.profile;
    merged.recents = local.recents;
    upload.push({ col: 'profile', id: 'main', value: profileDoc(merged) });
  }
  return { data: normalizeData(merged), upload };
}

export function countRecords(ops: Op[]): number {
  return ops.filter((o) => o.col !== 'profile').length;
}

// ---------- Local persistence of queue / owner / sync marker ----------

const ls = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadQueue(): Op[] {
  try {
    const q = JSON.parse(ls()?.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? (q as Op[]).filter((o) => o && typeof o.id === 'string' && typeof o.col === 'string') : [];
  } catch {
    return [];
  }
}

export function saveQueue(q: Op[]) {
  try {
    if (q.length) ls()?.setItem(QUEUE_KEY, JSON.stringify(q));
    else ls()?.removeItem(QUEUE_KEY);
  } catch {
    /* storage full: the queue stays in memory for this session */
  }
}

export function getOwner(): { uid: string; email: string } | null {
  try {
    return JSON.parse(ls()?.getItem(OWNER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setOwner(o: { uid: string; email: string } | null) {
  if (o) ls()?.setItem(OWNER_KEY, JSON.stringify(o));
  else ls()?.removeItem(OWNER_KEY);
}

export function getSyncId(): string | null {
  return ls()?.getItem(SYNC_ID_KEY) || null;
}

export function setSyncId(id: string | null) {
  if (id) ls()?.setItem(SYNC_ID_KEY, id);
  else ls()?.removeItem(SYNC_ID_KEY);
}

// ---------- Remote operations ----------

const userPath = (uid: string) => `users/${uid}`;

function opToWrite(uid: string, op: Op, syncId: string): Write {
  if (op.col === 'profile') return { kind: 'set', path: userPath(uid), value: op.value, extra: { syncId } };
  const path = `${userPath(uid)}/${op.col}/${docId(op.id)}`;
  return op.value == null ? { kind: 'delete', path } : { kind: 'set', path, value: op.value };
}

/** The account's change marker: changes whenever any device pushes. */
export async function remoteSyncId(uid: string, token: string): Promise<string | null> {
  const d = await getDoc(userPath(uid), token);
  return d?.fields.syncId ?? null;
}

export function newSyncId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Push ops. Returns whether another device changed the account since we last looked
 * (in which case the caller should pull).
 */
export async function push(uid: string, token: string, ops: Op[]): Promise<{ otherDeviceChanged: boolean; syncId: string }> {
  const before = await remoteSyncId(uid, token);
  const known = getSyncId();
  const syncId = newSyncId();
  const writes = ops.map((o) => opToWrite(uid, o, syncId));
  if (!ops.some((o) => o.col === 'profile')) writes.push({ kind: 'marker', path: userPath(uid), syncId });
  else {
    // Keep the marker write last so a partially applied multi-batch push is retried in full.
    const i = writes.findIndex((w) => w.path === userPath(uid));
    writes.push(...writes.splice(i, 1));
  }
  await commit(writes, token);
  setSyncId(syncId);
  return { otherDeviceChanged: before !== null && before !== known, syncId };
}

/** Download everything in the account. */
export async function pull(uid: string, token: string): Promise<{ data: AppData; syncId: string | null; exists: boolean }> {
  const top = await getDoc(userPath(uid), token);
  const lists = await Promise.all(COLLECTIONS.map((c) => listCollection(`${userPath(uid)}/${c}`, token)));
  const raw: Record<string, unknown> = { ...emptyData() };
  const p = (top?.value || {}) as Partial<ReturnType<typeof profileDoc>>;
  raw.profile = p.profile ?? null;
  raw.recents = p.recents ?? [];
  COLLECTIONS.forEach((c, i) => {
    raw[c] = lists[i].map((d) => d.value).filter(Boolean);
  });
  const data = normalizeData(raw);
  return { data, syncId: top?.fields.syncId ?? null, exists: !!top || hasAnyData(data) };
}

/** Delete every document in the account (used before deleting the account itself). */
export async function deleteAllRemote(uid: string, token: string): Promise<void> {
  const lists = await Promise.all(COLLECTIONS.map((c) => listCollection(`${userPath(uid)}/${c}`, token)));
  const writes: Write[] = lists.flat().map((d) => ({ kind: 'delete', path: relativePath(d.name) }));
  writes.push({ kind: 'delete', path: userPath(uid) });
  await commit(writes, token);
}
