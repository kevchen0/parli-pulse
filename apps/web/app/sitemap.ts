import type { MetadataRoute } from 'next';
import { dbReady, getSeasons } from '@/lib/db';
import { currentSeason } from '@/lib/season';

const BASE = 'https://parli-pulse.vercel.app';

/**
 * The pages a search engine should know about.
 *
 * Season pages are listed from the database rather than typed, so a new season
 * appears here the day it opens. Debater profiles are deliberately absent: they
 * are disallowed in robots.txt and send `noindex`, and listing them in a
 * sitemap would be an invitation to index the one thing that must not be.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const seasons = dbReady() ? await getSeasons() : [];
  const ids = seasons.length > 0 ? seasons.map((s) => s.id) : [currentSeason()];

  const fixed = ['', '/about', '/privacy', '/feedback', '/method'].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.6,
  }));

  const perSeason = ids.flatMap((id) =>
    ['/points', '/points/debaters', '/points/schools', '/ratings', '/speakers'].map((path) => ({
      url: `${BASE}/${id}${path}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  );

  return [...fixed, ...perSeason];
}
