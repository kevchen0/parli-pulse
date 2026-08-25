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
  typedRoutes: true,

  /**
   * TLS itself is Vercel's: certificates are provisioned and renewed
   * automatically, so there is nothing to install. These are the headers that
   * do not come for free.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Two years, so the browser refuses plain HTTP for this host well
          // before a certificate could lapse.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The site has no camera, microphone or location feature and should
          // not be able to acquire one by accident.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default config;
