import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isNativeApp } from './lib/platform';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: cache the app so it opens without a connection (production builds only).
// The store apps already carry every file inside the app, so they don't need it.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' && !isNativeApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
