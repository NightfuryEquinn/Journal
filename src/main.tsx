import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Push reminders only — the worker has no fetch handler and caches nothing.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* unsupported or blocked context — push simply stays unavailable */
    });
  });
}
