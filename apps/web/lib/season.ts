/** The season the site presents by default. Archive seasons render separately. */
export const CURRENT_SEASON = '2025-26';

/**
 * Whether a database is configured. The site is deliberately buildable and
 * deployable without one: Vercel needs a working project before there is
 * anything to connect it to, and a missing database should read as "not
 * connected yet" rather than a crashed page.
 */
export const hasDatabase = (): boolean => Boolean(process.env.DATABASE_URL);
