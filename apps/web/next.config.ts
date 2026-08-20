import type { NextConfig } from 'next';

const config: NextConfig = {
  // The rules and db packages are plain TypeScript sources rather than built
  // artifacts, so Next compiles them alongside the app.
  transpilePackages: ['@parli-pulse/rules', '@parli-pulse/db'],
  experimental: { typedRoutes: true },
};

export default config;
