import type { ThemePref } from './types';

/** The theme to show. FuelFlow is dark by default; "system" follows the phone's setting. */
export function resolveTheme(pref: ThemePref | undefined, prefersLight: boolean): 'dark' | 'light' {
  if (pref === 'system') return prefersLight ? 'light' : 'dark';
  return pref === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f5f2' : '#0b0d0c');
}
