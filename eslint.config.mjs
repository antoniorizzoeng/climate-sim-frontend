import * as nextConfig from 'eslint-config-next';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.local/**',
      'test-results/**',
      'playwright-report/**',
      'public/mockServiceWorker.js',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  ...nextConfig.default,
];

export default config;
