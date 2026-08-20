/**
 * Plain .mjs rather than .ts on purpose: loading a TypeScript config requires
 * the `typescript` package to be present before Next has even started, which
 * makes the build fail early and obscurely when a hosting provider prunes dev
 * dependencies. A .mjs config loads with no toolchain at all.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  // The rules and db packages are plain TypeScript sources rather than built
  // artifacts, so Next compiles them alongside the app.
  transpilePackages: ['@parli-pulse/rules', '@parli-pulse/db'],
  experimental: { typedRoutes: true },
};

export default config;
