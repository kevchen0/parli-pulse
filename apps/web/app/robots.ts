import type { MetadataRoute } from 'next';

/**
 * The site is open to search engines. Debater profiles are not.
 *
 * A table is a page about a competition. A profile is a page about one minor,
 * and indexing it makes their name a search result for anyone who looks up that
 * name for any reason — which is a different kind of exposure from a page
 * somebody navigated to, and the one this project has no business creating.
 *
 * Two mechanisms again, because they do different jobs: this asks a crawler not
 * to fetch, and `generateMetadata` on the profile route sends `noindex` for a
 * crawler that fetched anyway. A page nobody crawls is still indexable from an
 * inbound link.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/*/debater/', '/*/internal/', '/api/'],
      },
    ],
    sitemap: 'https://parli-pulse.vercel.app/sitemap.xml',
  };
}
