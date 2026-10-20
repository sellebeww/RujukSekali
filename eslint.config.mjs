import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const config = [
  ...nextVitals,
  ...nextTs,
  prettier,
  { settings: { next: { rootDir: '.' } } },
  {
    ignores: [
      '.next/**',
      '.next-e2e/**',
      'node_modules/**',
      'drizzle/**',
      'sim/out/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The planner and the state machine stay pure: no framework, database or I/O.
    files: ['src/engine/**/*.ts', 'src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'next',
            'next/*',
            'react',
            'drizzle-orm',
            'drizzle-orm/*',
            'postgres',
            '@/server/*',
            'node:*',
            'fs',
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Inject time via input.nowMs' },
      ],
    },
  },
];

export default config;
