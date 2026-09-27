import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { journsApiPlugin } from './scripts/vite-api-plugin';

/** vercel.json's headers, read once so `vite preview` mirrors prod (CSP etc.) — one source of truth. */
function readVercelHeaders(): Record<string, string> {
  const vercelConfig = JSON.parse(
    readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'),
  ) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[];
  };

  return Object.fromEntries(
    (vercelConfig.headers?.[0]?.headers ?? []).map((h) => [h.key, h.value]),
  );
}

export default defineConfig(({ mode }) => {
  // Expose all .env keys to the Vite Node process (API middleware needs MONGODB_*).
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), tailwindcss(), journsApiPlugin()],
    // Not applied to `vite dev`: its HMR client needs a looser CSP than prod.
    preview: { headers: readVercelHeaders() },
  };
});
