import { lazy, Suspense, useEffect, useState } from 'react';
import { StoreProvider, useStore, mealForNow } from './lib/store';
import { todayKey } from './lib/date';
import { applyTheme, resolveTheme } from './lib/theme';
import { AddFoodSheet } from './components/AddFoodSheet';
import { Link, useRoute } from './router';
import { Icon, type IconName } from './components/Icon';
import { Toast } from './components/ui';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Diary } from './pages/Diary';

// Heavier screens load separately so the first screen appears fast, then they are
// preloaded in the background so every screen also opens without a connection.
const loaders = {
  progress: () => import('./pages/Progress'),
  profile: () => import('./pages/Profile'),
  coach: () => import('./pages/Coach'),
  premium: () => import('./pages/Premium'),
  legal: () => import('./pages/Legal'),
};
const Progress = lazy(() => loaders.progress().then((m) => ({ default: m.Progress })));
const Profile = lazy(() => loaders.profile().then((m) => ({ default: m.Profile })));
const Coach = lazy(() => loaders.coach().then((m) => ({ default: m.Coach })));
const Premium = lazy(() => loaders.premium().then((m) => ({ default: m.Premium })));
const Privacy = lazy(() => loaders.legal().then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => loaders.legal().then((m) => ({ default: m.Terms })));

function preloadScreens() {
  const go = () => Object.values(loaders).forEach((load) => load().catch(() => undefined));
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(go);
  else window.setTimeout(go, 1500);
}

const NAV: Array<{ to: string; label: string; icon: IconName; sideOnly?: boolean }> = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/diary', label: 'Diary', icon: 'diary' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/coach', label: 'Coach', icon: 'sparkles', sideOnly: true },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

function Nav({ path, onLog }: { path: string; onLog: () => void }) {
  const active = (to: string) => (to === '/' ? path === '/' : path.startsWith(to) || (to === '/profile' && path === '/premium'));
  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.filter((n) => !n.sideOnly).flatMap((n, i) => {
          const link = (
            <Link key={n.to} to={n.to} className={'bn-item' + (active(n.to) ? ' on' : '')} aria-current={active(n.to) ? 'page' : undefined}>
              <span className="bn-icon">
                <Icon name={n.icon} size={22} />
              </span>
              <span className="bn-label">{n.label}</span>
            </Link>
          );
          return i === 2
            ? [
                <button key="log" className="bn-item center" onClick={onLog} aria-label="Log food">
                  <span className="bn-icon">
                    <Icon name="plus" size={26} />
                  </span>
                  <span className="bn-label">Log</span>
                </button>,
                link,
              ]
            : [link];
        })}
      </nav>
      <aside className="side-nav" aria-label="Main">
        <div className="brand-mark">
          <span className="logo-dot" /> FuelFlow
        </div>
        <button className="btn btn-primary sn-log" onClick={onLog}>
          <Icon name="plus" size={18} /> Log food
        </button>
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={'sn-item' + (active(n.to) ? ' on' : '')} aria-current={active(n.to) ? 'page' : undefined}>
            <Icon name={n.icon} size={20} />
            {n.label}
          </Link>
        ))}
        <p className="sn-tag muted small">Eat smarter. Track better. Become stronger.</p>
      </aside>
    </>
  );
}

function Shell() {
  const store = useStore();
  const { path } = useRoute();
  const [logOpen, setLogOpen] = useState(false);

  useEffect(preloadScreens, []);

  // Appearance: the saved choice, or follow the phone's light/dark setting.
  const themePref = store.profile?.theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => applyTheme(resolveTheme(themePref, mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [themePref]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const titles: Record<string, string> = { '/': 'Home', '/diary': 'Diary', '/progress': 'Progress', '/profile': 'Profile', '/premium': 'Premium', '/coach': 'Coach', '/privacy': 'Privacy policy', '/terms': 'Terms of use' };
    document.title = `${titles[path] ?? 'FuelFlow'} · FuelFlow`;
  }, [path]);

  // Privacy and terms are readable before setting up a profile too.
  if (path === '/privacy' || path === '/terms') {
    return (
      <div className="app legal-only">
        <main className="main" id="main">
          <Suspense fallback={<div className="page-loading" aria-label="Loading" />}>{path === '/privacy' ? <Privacy /> : <Terms />}</Suspense>
        </main>
      </div>
    );
  }

  if (!store.profile?.onboarded) return <Onboarding />;

  let page;
  switch (path) {
    case '/':
      page = <Home />;
      break;
    case '/diary':
      page = <Diary />;
      break;
    case '/progress':
      page = <Progress />;
      break;
    case '/profile':
      page = <Profile />;
      break;
    case '/coach':
      page = <Coach />;
      break;
    case '/premium':
      page = <Premium />;
      break;
    default:
      page = (
        <div className="page">
          <h1>Page not found</h1>
          <Link to="/" className="btn btn-primary">
            Go home
          </Link>
        </div>
      );
  }

  return (
    <div className={'app' + (path === '/coach' ? ' route-coach' : '')}>
      <Nav path={path} onLog={() => setLogOpen(true)} />
      <main className="main" id="main">
        {store.saveError && (
          <p className="notice warn" role="alert">
            <Icon name="alert" size={16} /> {store.saveError}
          </p>
        )}
        <Suspense fallback={<div className="page-loading" aria-label="Loading" />}>{page}</Suspense>
      </main>
      <AddFoodSheet open={logOpen} onClose={() => setLogOpen(false)} date={todayKey()} meal={mealForNow(store.profile!.meals)} />
      {store.toast && <Toast key={store.toast.id} text={store.toast.text} onUndo={store.toast.undo} onClose={store.dismissToast} />}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
