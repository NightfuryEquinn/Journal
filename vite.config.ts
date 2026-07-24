import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { journsApiPlugin } from './scripts/vite-api-plugin';

export default defineConfig(({ mode }) => {
  // Expose all .env keys to the Vite Node process (API middleware needs MONGODB_*).
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), tailwindcss(), journsApiPlugin()],
  };
});
