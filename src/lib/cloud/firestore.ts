// Minimal Cloud Firestore client over the REST API.
// Docs: https://firebase.google.com/docs/firestore/use-rest-api
//
// Every record is stored as one document whose `json` field holds the record as JSON.
// This keeps the format simple, and the security rules (firestore.rules) limit each user to
// their own documents under users/{uid}.

import { getFirebaseConfig } from './config';

export class CloudError extends Error {
  constructor(
    message: string,
    public kind: 'network' | 'auth' | 'denied' | 'quota' | 'server' | 'bad',
  ) {
    super(message);
  }
}

export type Write =
  | { kind: 'set'; path: string; value: unknown; extra?: Record<string, string> } // extra = additional string fields (e.g. syncId)
  | { kind: 'marker'; path: string; syncId: string } // only touches syncId/updatedAt on a document
  | { kind: 'delete'; path: string };

function projectId(): string {
  const c = getFirebaseConfig();
  if (!c) throw new CloudError('Accounts aren’t set up for this FuelFlow yet.', 'bad');
  return c.projectId;
}

const root = () => `projects/${projectId()}/databases/(default)/documents`;
const api = () => `https://firestore.googleapis.com/v1/${root()}`;

/** Firestore document IDs can't contain "/" and some other characters, so encode anything unusual. */
export function docId(id: string): string {
  const enc = id.replace(/[^A-Za-z0-9_-]/g, (ch) => '~' + ch.charCodeAt(0).toString(16).padStart(2, '0'));
  return enc === '' || /^__.*__$/.test(enc) ? `~${enc}` : enc;
}

async function request(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  } catch {
    throw new CloudError('You’re offline. Changes will sync when you’re back online.', 'network');
  }
  if (res.ok || res.status === 404) return res;
  if (res.status === 401) throw new CloudError('Your session has ended. Please sign in again.', 'auth');
  if (res.status === 403) throw new CloudError('The cloud refused this change. Check the Firestore security rules.', 'denied');
  if (res.status === 429) throw new CloudError('The cloud is busy. Retrying shortly.', 'quota');
  if (res.status >= 500) throw new CloudError('The cloud is having trouble. Retrying shortly.', 'server');
  throw new CloudError(`Sync failed (error ${res.status}).`, 'bad');
}

interface FsDoc {
  name: string;
  fields?: Record<string, { stringValue?: string; timestampValue?: string }>;
}

function decode(doc: FsDoc): unknown {
  const raw = doc.fields?.json?.stringValue;
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Read one document. Returns null when it doesn't exist. */
export async function getDoc(path: string, token: string): Promise<{ value: unknown; fields: Record<string, string> } | null> {
  const res = await request(`${api()}/${path}`, token);
  if (res.status === 404) return null;
  const doc = (await res.json()) as FsDoc;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) if (v.stringValue != null) fields[k] = v.stringValue;
  return { value: decode(doc), fields };
}

/** Read every document in a collection (following pages). */
export async function listCollection(path: string, token: string): Promise<Array<{ name: string; value: unknown }>> {
  const out: Array<{ name: string; value: unknown }> = [];
  let pageToken = '';
  for (let guard = 0; guard < 200; guard++) {
    const q = new URLSearchParams({ pageSize: '300' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await request(`${api()}/${path}?${q}`, token);
    if (res.status === 404) break;
    const j = (await res.json()) as { documents?: FsDoc[]; nextPageToken?: string };
    for (const d of j.documents || []) out.push({ name: d.name, value: decode(d) });
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

function toFsWrite(w: Write) {
  const name = `${root()}/${w.path}`;
  const now = { timestampValue: new Date().toISOString() };
  if (w.kind === 'delete') return { delete: name };
  if (w.kind === 'marker') {
    return { update: { name, fields: { syncId: { stringValue: w.syncId }, updatedAt: now } }, updateMask: { fieldPaths: ['syncId', 'updatedAt'] } };
  }
  const fields: Record<string, unknown> = { json: { stringValue: JSON.stringify(w.value) }, updatedAt: now };
  for (const [k, v] of Object.entries(w.extra || {})) fields[k] = { stringValue: v };
  return { update: { name, fields }, updateMask: { fieldPaths: Object.keys(fields) } };
}

export const MAX_BATCH = 400;

/** Apply writes atomically per batch of up to 400. */
export async function commit(writes: Write[], token: string): Promise<void> {
  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const chunk = writes.slice(i, i + MAX_BATCH);
    await request(`${api()}:commit`, token, { method: 'POST', body: JSON.stringify({ writes: chunk.map(toFsWrite) }) });
  }
}

/** The path of a document relative to the database root, from its full resource name. */
export function relativePath(name: string): string {
  const marker = '/documents/';
  const i = name.indexOf(marker);
  return i >= 0 ? name.slice(i + marker.length) : name;
}
