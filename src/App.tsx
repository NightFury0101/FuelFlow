import { lazy, Suspense, useEffect, useState } from 'react';
import { StoreProvider, useStore, mealForNow } from './lib/store';
import { todayKey } from './lib/date';
import { AddFoodSheet } from './components/AddFoodSheet';
import { Link, useRoute } from './router';
import { Icon, type IconName } from './components/Icon';
import { Toast } from './components/ui';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Diary } from './pages/Diary';

// Heavier, less-visited screens load on demand.
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Coach = lazy(() => import('./pages/Coach').then((m) => ({ default: m.Coach })));
const Premium = lazy(() => import('./pages/Premium').then((m) => ({ default: m.Premium })));

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

  useEffect(() => {
    window.scrollTo(0, 0);
    const titles: Record<string, string> = { '/': 'Home', '/diary': 'Diary', '/progress': 'Progress', '/profile': 'Profile', '/premium': 'Premium', '/coach': 'Coach' };
    document.title = `${titles[path] ?? 'FuelFlow'} · FuelFlow`;
  }, [path]);

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
