import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { validEmail } from '../lib/cloud/auth';
import { Field, Segmented, Sheet } from './ui';
import { Icon } from './Icon';

type Mode = 'in' | 'up' | 'reset';

export function AuthSheet({ open, onClose, initialMode = 'in' }: { open: boolean; onClose: () => void; initialMode?: 'in' | 'up' }) {
  const store = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setPassword('');
      setError(null);
      setNotice(null);
      setTried(false);
    }
  }, [open, initialMode]);

  const emailOk = validEmail(email);
  const pwOk = mode === 'reset' || password.length >= 6;

  const submit = async () => {
    setTried(true);
    setError(null);
    if (!emailOk || !pwOk) return;
    setBusy(true);
    try {
      if (mode === 'reset') {
        await store.cloud.resetPassword(email);
        setNotice(`If an account exists for ${email.trim()}, a reset link is on its way. Check your inbox and spam folder.`);
      } else {
        const msg = await store.cloud.signIn(mode, email, password);
        store.showToast(msg);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'up' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in';

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode !== 'reset' && (
          <Segmented<'in' | 'up'>
            label="Sign in or create account"
            value={mode}
            onChange={(v) => (setMode(v), setError(null), setTried(false))}
            options={[
              { value: 'in', label: 'Sign in' },
              { value: 'up', label: 'Create account' },
            ]}
          />
        )}
        <p className="muted small">
          {mode === 'up'
            ? 'Back up your diary and use FuelFlow on any phone. Anything already on this phone is added to your new account.'
            : mode === 'reset'
              ? 'Enter your email and we’ll send you a link to choose a new password.'
              : 'Sign in to restore your data or keep it in sync across devices.'}
        </p>
        <Field label="Email" error={tried && !emailOk ? 'Enter a valid email address' : null}>
          <input type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        {mode !== 'reset' && (
          <Field label="Password" hint={mode === 'up' ? 'At least 6 characters' : undefined} error={tried && !pwOk ? 'At least 6 characters' : null}>
            <div className="key-input">
              <input
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Password"
              />
              <button type="button" className="link-btn" onClick={() => setShow((x) => !x)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
        )}
        {error && (
          <p className="notice warn" role="alert">
            <Icon name="alert" size={16} /> {error}
          </p>
        )}
        {notice && (
          <p className="notice ok" role="status">
            <Icon name="check" size={16} /> {notice}
          </p>
        )}
        <button type="submit" className="btn btn-primary block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'up' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
        </button>
        {mode === 'in' && (
          <button type="button" className="link-btn center-btn" onClick={() => (setMode('reset'), setError(null), setTried(false))}>
            Forgot password?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="link-btn center-btn" onClick={() => (setMode('in'), setNotice(null), setError(null))}>
            Back to sign in
          </button>
        )}
        {mode === 'up' && (
          <p className="muted small">
            By creating an account you agree to the{' '}
            <a className="accent" href="#/terms" onClick={onClose}>
              Terms of use
            </a>{' '}
            and{' '}
            <a className="accent" href="#/privacy" onClick={onClose}>
              Privacy policy
            </a>
            . Your data is stored in your private account and you can delete it at any time.
          </p>
        )}
      </form>
    </Sheet>
  );
}
