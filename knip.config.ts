import type { KnipConfig } from 'knip';

export default {
  entry: [
    // src/main.tsx and vite.config.ts are already found via index.html / the
    // Vite plugin — listing them again just trips knip's own redundancy hint.
    'api/**/*.ts',
    '!api/_lib/**', // internal modules imported by the handlers, not entries themselves
    'scripts/*.ts', // covers push-check/quest-check/auth-check/drop-all/purge-stale-users
    'scripts/bun-v8-patch.ts', // only referenced via `bun --preload ...`, invisible to knip's script parser
  ],
  project: ['src/**/*.{ts,tsx}', 'shared/**/*.ts', 'api/**/*.ts', 'scripts/**/*.ts'],
  ignoreDependencies: [
    'vercel', // deploy CLI, invoked manually — never imported
    'tailwindcss', // consumed via @tailwindcss/vite + the @theme block in src/styles.css, never imported by name
  ],
  ignoreBinaries: [
    'nslookup', // Windows DNS workaround in api/_lib/resolve-uri.ts — a system binary, not an npm package
  ],
} satisfies KnipConfig;
