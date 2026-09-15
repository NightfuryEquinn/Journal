import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.vercel/**',
      'node_modules/**',
      'public/**',
      'eslint.config.js',
      'knip.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Only the two classic, well-understood hooks rules — react-hooks@7
      // ships many newer React-Compiler-readiness diagnostics that this app
      // predates. Revisit if/when React Compiler is adopted.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Warn, not error: src/hud.tsx and src/app.tsx export helpers alongside
      // components, which is fine for this app's HMR needs.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowCompoundComponents: true },
      ],

      // tsc -b already enforces this via noUnusedLocals/noUnusedParameters —
      // one source of truth, avoid duplicate noise.
      '@typescript-eslint/no-unused-vars': 'off',

      // Already the repo's actual style (verbatimModuleSyntax); self-fixable.
      '@typescript-eslint/consistent-type-imports': 'error',

      // Both already have a matching eslint-disable-next-line in the codebase
      // (api/_lib/db.ts, api/_lib/vercel.ts) written in anticipation of this.
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  eslintConfigPrettier,
);
