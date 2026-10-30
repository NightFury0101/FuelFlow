import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { AppData } from '../types';
import { emptyData } from '../storage';
import { cloudEnabled } from './config';
import {
  AuthError,
  deleteAuthAccount,
  freshSession,
  isSessionEnded,
  loadSession,
  saveSession,
  sendPasswordReset,
  sendVerifyEmail,
  signIn as authSignIn,
  signUp as authSignUp,
  SESSION_KEY,
  type Session,
} from './auth';
import { CloudError } from './firestore';
import {
  applyOps,
  countRecords,
  deleteAllRemote,
  diff,
  getOwner,
  getSyncId,
  hasAnyData,
  loadQueue,
  mergeQueue,
  pull,
  push,
  QUEUE_KEY,
  remoteSyncId,
  saveQueue,
  setOwner,
  setSyncId,
  settleQueue,
  unionData,
  type Op,
} from './sync';

export type SyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudApi {
  enabled: boolean;
  account: { email: string; uid: string } | null;
  state: SyncState;
  message: string | null;
  lastSynced: number | null;
  pending: number;
  signIn(mode: 'in' | 'up', email: string, password: string): Promise<string>;
  signOut(force?: boolean): Promise<{ ok: boolean; pending: number }>;
  resetPassword(email: string): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  syncNow(): Promise<void>;
  /** Called by the store after every local change. */
  onLocalChange(prev: AppData, next: AppData): void;
}

const LOCAL_ONLY_KEYS = ['fuelflow:anthropic-key', 'fuelflow:gemini-key', 'fuelflow:ai-provider', 'fuelflow:coach:v1'];

export function useCloud(dataRef: MutableRefObject<AppData>, replaceData: (d: AppData) => void): CloudApi {
  const enabled = cloudEnabled();
  const [session, setSessionState] = useState<Session | null>(() => (enabled ? loadSession() : null));
  const sessionRef = useRef(session);
  const queueRef = useRef<Op[]>(enabled ? loadQueue() : []);
  const [pending, setPending] = useState(queueRef.current.length);
  const [status, setStatus] = useState<{ state: SyncState; message: string | null; lastSynced: number | null }>({
    state: session ? 'syncing' : 'off',
    message: null,
    lastSynced: null,
  });
  const running = useRef<Promise<void> | null>(null);
  const again = useRef<'push' | 'full' | null>(null);
  const lastFull = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const retry = useRef<number | undefined>(undefined);

  const setSession = useCallback((s: Session | null) => {
    sessionRef.current = s;
    saveSession(s);
    setSessionState(s);
  }, []);

  const setQueue = useCallback((q: Op[]) => {
    queueRef.current = q;
    saveQueue(q);
    setPending(q.length);
  }, []);

  const handleError = useCallback(
    (e: unknown) => {
      if (isSessionEnded(e) || (e instanceof CloudError && e.kind === 'auth')) {
        // Keep the data and the unsynced queue; just ask the person to sign in again.
        sessionRef.current = null;
        saveSession(null);
        setSessionState(null);
        setStatus({ state: 'error', message: 'Your session has ended. Sign in again to keep syncing — nothing on this phone is lost.', lastSynced: null });
        return;
      }
      if ((e instanceof CloudError && e.kind === 'network') || (e instanceof AuthError && e.code === 'NETWORK')) {
        setStatus((s) => ({ ...s, state: 'offline', message: 'You’re offline. Changes will sync when you’re back online.' }));
        return;
      }
      const message = e instanceof Error ? e.message : 'Sync failed.';
      setStatus((s) => ({ ...s, state: 'error', message }));
      window.clearTimeout(retry.current);
      retry.current = window.setTimeout(() => void run('full'), 30_000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Push the queue; on 'full' (or if another device changed things) also pull. */
  const run = useCallback(
    (mode: 'push' | 'full'): Promise<void> => {
      if (running.current) {
        if (mode === 'full' || !again.current) again.current = mode;
        return running.current;
      }
      const job = (async () => {
        const s0 = sessionRef.current;
        if (!s0) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setStatus((s) => ({ ...s, state: 'offline', message: 'You’re offline. Changes will sync when you’re back online.' }));
          return;
        }
        if (mode === 'push' && !queueRef.current.length) return;
        setStatus((s) => ({ ...s, state: 'syncing', message: null }));
        try {
          const s = await freshSession(s0);
          if (s !== s0) setSession(s);
          let needPull = mode === 'full';
          if (queueRef.current.length) {
            const sent = queueRef.current;
            const r = await push(s.uid, s.idToken, sent);
            setQueue(settleQueue(queueRef.current, sent));
            if (r.otherDeviceChanged) needPull = true;
          }
          if (mode === 'full' && !queueRef.current.length) {
            // One cheap read tells us whether any other device changed the account.
            const marker = await remoteSyncId(s.uid, s.idToken);
            needPull = marker !== getSyncId() || Date.now() - lastFull.current > 24 * 3600_000;
          }
          if (needPull) {
            const r = await pull(s.uid, s.idToken);
            setSyncId(r.syncId);
            lastFull.current = Date.now();
            replaceData(applyOps(r.data, queueRef.current));
          }
          setStatus({ state: 'synced', message: null, lastSynced: Date.now() });
        } catch (e) {
          handleError(e);
        }
      })().finally(() => {
        running.current = null;
        const next = again.current;
        again.current = null;
        if (next) void run(next);
      });
      running.current = job;
      return job;
    },
    [handleError, replaceData, setQueue, setSession],
  );

  // Sync when the app opens, comes back online, or returns to the foreground.
  useEffect(() => {
    if (!enabled) return;
    if (sessionRef.current) void run('full');
    const online = () => void run('full');
    const visible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFull.current > 60_000) void run('full');
    };
    const storage = (e: StorageEvent) => {
      if (e.key === QUEUE_KEY) {
        queueRef.current = loadQueue();
        setPending(queueRef.current.length);
      }
      if (e.key === SESSION_KEY) {
        const s = loadSession();
        sessionRef.current = s;
        setSessionState(s);
      }
    };
    const offline = () => setStatus((s) => (sessionRef.current ? { ...s, state: 'offline', message: 'You’re offline. Changes will sync when you’re back online.' } : s));
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('storage', storage);
      window.clearTimeout(timer.current);
      window.clearTimeout(retry.current);
    };
  }, [enabled, run]);

  const onLocalChange = useCallback(
    (prev: AppData, next: AppData) => {
      if (!sessionRef.current) return;
      const ops = diff(prev, next);
      if (!ops.length) return;
      setQueue(mergeQueue(queueRef.current, ops));
      setStatus((st) => (st.state === 'synced' ? { ...st, state: 'syncing', message: null } : st));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void run('push'), 1200);
    },
    [run, setQueue],
  );

  const clearDevice = useCallback(() => {
    setSession(null);
    setOwner(null);
    setSyncId(null);
    setQueue([]);
    try {
      for (const k of LOCAL_ONLY_KEYS) localStorage.removeItem(k);
      window.dispatchEvent(new Event('fuelflow:ai-changed'));
    } catch {
      /* ignore */
    }
    replaceData(emptyData());
    setStatus({ state: 'off', message: null, lastSynced: null });
  }, [replaceData, setQueue, setSession]);

  return useMemo<CloudApi>(
    () => ({
      enabled,
      account: session ? { email: session.email, uid: session.uid } : null,
      state: status.state,
      message: status.message,
      lastSynced: status.lastSynced,
      pending,
      onLocalChange,

      async signIn(mode, email, password) {
        const owner = getOwner();
        const s = mode === 'up' ? await authSignUp(email, password) : await authSignIn(email, password);
        if (owner && owner.uid !== s.uid && queueRef.current.length) {
          throw new AuthError(`This phone has changes from ${owner.email} that haven’t synced yet. Sign in as ${owner.email} first.`, 'OTHER_OWNER');
        }
        const r = await pull(s.uid, s.idToken);
        const local = dataRef.current;
        let merged: AppData;
        let upload: Op[] = [];
        let message: string;
        if (owner && owner.uid === s.uid) {
          merged = applyOps(r.data, queueRef.current);
          message = 'Signed in. You’re up to date.';
        } else if (!owner && hasAnyData(local)) {
          const u = unionData(r.data, local);
          merged = u.data;
          upload = u.upload;
          const n = countRecords(upload);
          message = r.exists ? (n ? `Signed in — added ${n} item${n === 1 ? '' : 's'} from this phone to your account.` : 'Signed in. You’re up to date.') : 'Account created — everything on this phone is now backed up.';
        } else {
          if (owner) setQueue([]);
          merged = r.data;
          message = r.exists ? 'Signed in — your data is restored.' : mode === 'up' ? 'Account created.' : 'Signed in.';
        }
        setSession(s);
        setOwner({ uid: s.uid, email: s.email });
        setSyncId(r.syncId);
        lastFull.current = Date.now();
        setQueue(mergeQueue(queueRef.current, upload));
        replaceData(merged);
        setStatus({ state: 'synced', message: null, lastSynced: Date.now() });
        if (mode === 'up') sendVerifyEmail(s.idToken).catch(() => undefined);
        void run('push');
        return message;
      },

      async signOut(force = false) {
        if (sessionRef.current && queueRef.current.length) await run('push');
        const left = queueRef.current.length;
        if (left && !force) return { ok: false, pending: left };
        clearDevice();
        return { ok: true, pending: 0 };
      },

      async resetPassword(email) {
        await sendPasswordReset(email);
      },

      async deleteAccount(password) {
        const current = sessionRef.current;
        if (!current) throw new AuthError('Sign in first.', 'NO_SESSION');
        const s = await authSignIn(current.email, password); // confirms it's really them
        await deleteAllRemote(s.uid, s.idToken);
        await deleteAuthAccount(s.idToken);
        clearDevice();
      },

      syncNow: () => run('full'),
    }),
    [enabled, session, status, pending, onLocalChange, run, setQueue, setSession, replaceData, dataRef, clearDevice],
  );
}
