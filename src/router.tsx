import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

// Tiny hash router. Hash URLs (#/diary) work on GitHub Pages without server rewrites,
// so refreshing any screen never 404s.

export interface Route {
  path: string;
  query: URLSearchParams;
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = '#' + to;
  if (opts.replace) window.location.replace(hash);
  else window.location.hash = to;
}

export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a href={'#' + to} {...rest}>
      {children}
    </a>
  );
}
