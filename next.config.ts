import type { NextConfig } from 'next';

const demoExport = process.env.DEMO_EXPORT === '1';
const demoBasePath = '/climate-sim-frontend';

const nextConfig: NextConfig = {
  ...(demoExport
    ? {
        output: 'export',
        basePath: demoBasePath,
        assetPrefix: demoBasePath,
        trailingSlash: true,
        images: { unoptimized: true },
        env: { NEXT_PUBLIC_DEMO_BASE_PATH: demoBasePath },
      }
    : { output: 'standalone' }),
  devIndicators: false,
};

export default nextConfig;
