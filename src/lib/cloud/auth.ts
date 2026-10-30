// Firebase Authentication over its REST API (email + password).
// Docs: https://firebase.google.com/docs/reference/rest/auth

import { getFirebaseConfig } from './config';

export interface Session {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
}

export const SESSION_KEY = 'fuelflow:session';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'An account with this email already exists. Sign in instead.',
  EMAIL_NOT_FOUND: 'Email or password is incorrect.',
  INVALID_PASSWORD: 'Email or password is incorrect.',
  INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  WEAK_PASSWORD: 'Use a password of at least 6 characters.',
  INVALID_EMAIL: 'Enter a valid email address.',
  MISSING_EMAIL: 'Enter your email address.',
  MISSING_PASSWORD: 'Enter your password.',
  OPERATION_NOT_ALLOWED: 'Email sign-in isn’t switched on in this Firebase project yet.',
  TOKEN_EXPIRED: 'Your session has ended. Please sign in again.',
  INVALID_REFRESH_TOKEN: 'Your session has ended. Please sign in again.',
  INVALID_ID_TOKEN: 'Your session has ended. Please sign in again.',
  USER_NOT_FOUND: 'This account no longer exists.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'For your security, sign in again first.',
  API_KEY_INVALID: 'FuelFlow’s Firebase settings aren’t valid. Check firebaseConfig.',
};

/** Firebase returns e.g. "WEAK_PASSWORD : Password should be at least 6 characters". */
export function errorCode(message: string): string {
  return message.split(':')[0].trim().split(' ')[0];
}

const SESSION_ENDED = new Set(['TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN', 'INVALID_ID_TOKEN', 'USER_NOT_FOUND', 'USER_DISABLED']);
export function isSessionEnded(e: unknown): boolean {
  return e instanceof AuthError && SESSION_ENDED.has(e.code);
}

async function post(url: string, body: Record<string, unknown> | URLSearchParams): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: body instanceof URLSearchParams ? body.toString() : JSON.stringify(body),
    });
  } catch {
    throw new AuthError('Couldn’t reach the server. Check your internet connection.', 'NETWORK');
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) {
    const code = errorCode(json.error?.message || `HTTP_${res.status}`);
    throw new AuthError(MESSAGES[code] || `Something went wrong (${code}). Try again.`, code);
  }
  return json;
}

function cfg() {
  const c = getFirebaseConfig();
  if (!c) throw new AuthError('Accounts aren’t set up for this FuelFlow yet.', 'NO_CONFIG');
  return c;
}

const idt = (method: string) => `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(cfg().apiKey)}`;

function toSession(j: Record<string, unknown>, fallbackEmail: string): Session {
  return {
    uid: String(j.localId),
    email: String(j.email || fallbackEmail),
    idToken: String(j.idToken),
    refreshToken: String(j.refreshToken),
    expiresAt: Date.now() + Number(j.expiresIn || 3600) * 1000,
  };
}

export async function signUp(email: string, password: string): Promise<Session> {
  const j = await post(idt('signUp'), { email: email.trim(), password, returnSecureToken: true });
  return toSession(j, email.trim());
}

export async function signIn(email: string, password: string): Promise<Session> {
  const j = await post(idt('signInWithPassword'), { email: email.trim(), password, returnSecureToken: true });
  return toSession(j, email.trim());
}

export async function sendPasswordReset(email: string): Promise<void> {
  await post(idt('sendOobCode'), { requestType: 'PASSWORD_RESET', email: email.trim() });
}

export async function sendVerifyEmail(idToken: string): Promise<void> {
  await post(idt('sendOobCode'), { requestType: 'VERIFY_EMAIL', idToken });
}

export async function deleteAuthAccount(idToken: string): Promise<void> {
  await post(idt('delete'), { idToken });
}

export async function refreshSession(s: Session): Promise<Session> {
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg().apiKey)}`;
  const j = await post(url, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refreshToken }));
  return {
    uid: String(j.user_id || s.uid),
    email: s.email,
    idToken: String(j.id_token),
    refreshToken: String(j.refresh_token || s.refreshToken),
    expiresAt: Date.now() + Number(j.expires_in || 3600) * 1000,
  };
}

// ---------- Session persistence ----------

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    return s && s.uid && s.refreshToken ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

let refreshing: Promise<Session> | null = null;

/** A session whose ID token is valid for at least two more minutes (refreshing once if needed). */
export async function freshSession(s: Session): Promise<Session> {
  if (s.expiresAt - Date.now() > 120_000) return s;
  if (!refreshing) {
    refreshing = refreshSession(s)
      .then((n) => {
        saveSession(n);
        return n;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
