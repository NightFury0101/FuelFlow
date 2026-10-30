// In-memory stand-in for Firebase Auth + Cloud Firestore REST APIs, for tests only.
// It enforces the same rule as firestore.rules: a signed-in user can only touch users/{their uid}/**.

export function createFakeFirebase({ apiKey = 'test-key', projectId = 'fuelflow-test' } = {}) {
  const users = new Map(); // email -> { uid, password }
  const tokens = new Map(); // idToken -> uid
  const refresh = new Map(); // refreshToken -> uid
  const docs = new Map(); // relative path -> { fields }
  const log = [];
  let n = 0;
  const root = `projects/${projectId}/databases/(default)/documents`;

  const json = (status, body) => ({ status, body });
  const err = (status, message) => json(status, { error: { code: status, message } });
  const issue = (uid, email) => {
    const idToken = `id-${uid}-${++n}`;
    const refreshToken = `rt-${uid}-${n}`;
    tokens.set(idToken, uid);
    refresh.set(refreshToken, uid);
    return { localId: uid, email, idToken, refreshToken, expiresIn: '3600' };
  };

  function handle(url, method, headers, bodyText) {
    const u = new URL(url);
    log.push(`${method} ${u.host}${u.pathname}`);
    if (u.host === 'identitytoolkit.googleapis.com' || u.host === 'securetoken.googleapis.com') {
      if (u.searchParams.get('key') !== apiKey) return err(400, 'API_KEY_INVALID');
    }
    if (u.host === 'identitytoolkit.googleapis.com') {
      const b = JSON.parse(bodyText || '{}');
      const action = u.pathname.split(':')[1];
      if (action === 'signUp') {
        if (!/^\S+@\S+\.\S+$/.test(b.email || '')) return err(400, 'INVALID_EMAIL');
        if (!b.password || b.password.length < 6) return err(400, 'WEAK_PASSWORD : Password should be at least 6 characters');
        if (users.has(b.email)) return err(400, 'EMAIL_EXISTS');
        const uid = `u${users.size + 1}x${Math.random().toString(36).slice(2, 8)}`;
        users.set(b.email, { uid, password: b.password });
        return json(200, issue(uid, b.email));
      }
      if (action === 'signInWithPassword') {
        const user = users.get(b.email);
        if (!user || user.password !== b.password) return err(400, 'INVALID_LOGIN_CREDENTIALS');
        return json(200, issue(user.uid, b.email));
      }
      if (action === 'sendOobCode') {
        if (b.requestType === 'PASSWORD_RESET' && !users.has(b.email)) return err(400, 'EMAIL_NOT_FOUND');
        return json(200, { email: b.email });
      }
      if (action === 'delete') {
        const uid = tokens.get(b.idToken);
        if (!uid) return err(400, 'INVALID_ID_TOKEN');
        for (const [email, user] of users) if (user.uid === uid) users.delete(email);
        return json(200, {});
      }
      return err(404, 'NOT_FOUND');
    }
    if (u.host === 'securetoken.googleapis.com') {
      const p = new URLSearchParams(bodyText);
      const uid = refresh.get(p.get('refresh_token'));
      if (!uid) return err(400, 'INVALID_REFRESH_TOKEN');
      const email = [...users].find(([, v]) => v.uid === uid)?.[0];
      if (!email) return err(400, 'USER_NOT_FOUND');
      const t = issue(uid, email);
      return json(200, { id_token: t.idToken, refresh_token: t.refreshToken, expires_in: '3600', user_id: uid });
    }
    if (u.host === 'firestore.googleapis.com') {
      const auth = (headers.authorization || headers.Authorization || '').replace('Bearer ', '');
      const uid = tokens.get(auth);
      if (!uid) return err(401, 'UNAUTHENTICATED');
      const prefix = `/v1/${root}`;
      const allowed = (rel) => rel === `users/${uid}` || rel.startsWith(`users/${uid}/`);
      if (method === 'POST' && u.pathname === `${prefix}:commit`) {
        const b = JSON.parse(bodyText);
        const rels = b.writes.map((w) => (w.delete || w.update.name).slice(root.length + 1));
        if (!rels.every(allowed)) return err(403, 'PERMISSION_DENIED');
        for (const w of b.writes) {
          if (w.delete) docs.delete(w.delete.slice(root.length + 1));
          else {
            const rel = w.update.name.slice(root.length + 1);
            const prev = docs.get(rel)?.fields || {};
            const fields = w.updateMask ? { ...prev, ...w.update.fields } : w.update.fields;
            docs.set(rel, { fields });
          }
        }
        return json(200, { writeResults: b.writes.map(() => ({})) });
      }
      if (method === 'GET' && u.pathname.startsWith(prefix + '/')) {
        const rel = decodeURIComponent(u.pathname.slice(prefix.length + 1));
        if (!allowed(rel)) return err(403, 'PERMISSION_DENIED');
        const depth = rel.split('/').length;
        if (depth % 2 === 0) {
          const d = docs.get(rel);
          return d ? json(200, { name: `${root}/${rel}`, fields: d.fields }) : err(404, 'NOT_FOUND');
        }
        const all = [...docs.keys()].filter((k) => k.startsWith(rel + '/') && k.split('/').length === depth + 1).sort();
        const size = Number(u.searchParams.get('pageSize') || 300);
        const start = Number(u.searchParams.get('pageToken') || 0);
        const page = all.slice(start, start + size);
        const body = { documents: page.map((k) => ({ name: `${root}/${k}`, fields: docs.get(k).fields })) };
        if (start + size < all.length) body.nextPageToken = String(start + size);
        return json(200, page.length ? body : {});
      }
      return err(404, 'NOT_FOUND');
    }
    return err(404, 'NOT_FOUND');
  }

  /** A fetch() replacement for Node tests. */
  const fetchImpl = async (url, init = {}) => {
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const r = handle(String(url), init.method || 'GET', headers, init.body ? String(init.body) : '');
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };

  return { handle, fetch: fetchImpl, docs, users, log, config: { apiKey, projectId } };
}
