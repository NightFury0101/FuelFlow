import { lazy, Suspense, useEffect } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { Link, useRoute } from './router';
import { Icon, type IconName } from './components/Icon';
import { Toast } from './components/ui';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Diary } from './pages/Diary';

// Heavier, less-visited screens load on demand.
const Scan = lazy(() => import('./pages/Scan').then((m) => ({ default: m.Scan })));
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Coach = lazy(() => import('./pages/Coach').then((m) => ({ default: m.Coach })));
const Premium = lazy(() => import('./pages/Premium').then((m) => ({ default: m.Premium })));

const NAV: Array<{ to: string; label: string; icon: IconName; center?: boolean; sideOnly?: boolean }> = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/diary', label: 'Diary', icon: 'diary' },
  { to: '/scan', label: 'Scan', icon: 'scan', center: true },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/coach', label: 'Coach', icon: 'sparkles', sideOnly: true },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

function Nav({ path }: { path: string }) {
  const active = (to: string) => (to === '/' ? path === '/' : path.startsWith(to) || (to === '/profile' && path === '/premium'));
  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.filter((n) => !n.sideOnly).map((n) => (
          <Link key={n.to} to={n.to} className={'bn-item' + (active(n.to) ? ' on' : '') + (n.center ? ' center' : '')} aria-current={active(n.to) ? 'page' : undefined}>
            <span className="bn-icon">
              <Icon name={n.icon} size={n.center ? 24 : 22} />
            </span>
            <span className="bn-label">{n.label}</span>
          </Link>
        ))}
      </nav>
      <aside className="side-nav" aria-label="Main">
        <div className="brand-mark">
          <span className="logo-dot" /> FuelFlow
        </div>
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

  useEffect(() => {
    window.scrollTo(0, 0);
    const titles: Record<string, string> = { '/': 'Home', '/diary': 'Diary', '/scan': 'Scan', '/progress': 'Progress', '/profile': 'Profile', '/premium': 'Premium', '/coach': 'Coach' };
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
    case '/scan':
      page = <Scan />;
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
      <Nav path={path} />
      <main className="main" id="main">
        {store.saveError && (
          <p className="notice warn" role="alert">
            <Icon name="alert" size={16} /> {store.saveError}
          </p>
        )}
        <Suspense fallback={<div className="page-loading" aria-label="Loading" />}>{page}</Suspense>
      </main>
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
