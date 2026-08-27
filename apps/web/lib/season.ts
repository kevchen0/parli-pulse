/**
 * Which season is which, and whether it is still running.
 *
 * The season is part of the URL rather than an implicit "latest", so a link
 * shared in August still means what it meant when it was shared. `/rankings`
 * redirects to whichever season is current at the time of the request; every
 * other path names its season outright.
 */

/** A season label, e.g. "2026-27". */
export type SeasonId = string;

/**
 * The season a date falls in. NPDL seasons run August to July, and Article
 * XXI.1.H excludes August tournaments from points -- but they are still that
 * season's, so the boundary is August rather than September.
 *
 * Derived rather than configured, so a season rolls over on its own. A
 * deployment that needs a redeploy to notice the calendar is a deployment that
 * will be wrong on the morning of the opener.
 */
export function seasonForDate(date: Date = new Date()): SeasonId {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 7 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** The season the site treats as current. */
export const currentSeason = (): SeasonId => process.env.SEASON ?? seasonForDate();

/**
 * Retained for the many call sites that predate seasons being routable. New
 * code should take the season from the route, so a page renders the season it
 * was asked for rather than the season the server happens to be in.
 */
export const CURRENT_SEASON = currentSeason();

/** Whether a URL segment could be a season at all, before touching the database. */
export const isSeasonId = (value: string): boolean => /^\d{4}-\d{2}$/.test(value);

/** First and last day of a season, on the convention the loader uses. */
export function seasonWindow(season: SeasonId): { startsOn: string; endsOn: string } {
  const startYear = Number(season.slice(0, 4));
  return { startsOn: `${startYear}-08-01`, endsOn: `${startYear + 1}-07-31` };
}

export type SeasonStatus = 'live' | 'final' | 'upcoming';

/**
 * Where a season sits relative to today.
 *
 * `live` means the calendar says it is running, whether or not anything has
 * been published yet -- a season that has opened but has no results is not the
 * same claim as one that is finished, and the site must not present the first
 * as the second.
 */
export function seasonStatus(season: SeasonId, today: Date = new Date()): SeasonStatus {
  const { startsOn, endsOn } = seasonWindow(season);
  const day = today.toISOString().slice(0, 10);
  if (day < startsOn) return 'upcoming';
  if (day > endsOn) return 'final';
  return 'live';
}

/** "2026-27" -> "2026–27", with the dash the typographers use. */
export const seasonLabel = (season: SeasonId): string => season.replace('-', '–');

/**
 * Whether a database is configured. The site is deliberately buildable and
 * deployable without one: Vercel needs a working project before there is
 * anything to connect it to, and a missing database should read as "not
 * connected yet" rather than a crashed page.
 */
export const hasDatabase = (): boolean => Boolean(process.env.DATABASE_URL);

/**
 * A link into a season's pages.
 *
 * `typedRoutes` verifies every href against the routes that exist, which is
 * worth keeping -- it catches a renamed page at compile time. It cannot verify
 * a path whose season is only known at request time, so the assertion lives
 * here, once, rather than at each call site. The shape is checked on the way in:
 * `path` must name a real route under the season segment.
 */
export type SeasonPath =
  | '/points'
  | '/points/debaters'
  | '/points/schools'
  | '/ratings'
  | '/speakers'
  | '/method/ratings'
  | '/internal/reconciliation';

export function seasonHref(season: SeasonId, path: SeasonPath, hash = ''): never {
  return `/${season}${path}${hash}` as never;
}

/**
 * A link to a debater's page.
 *
 * Separate from `seasonHref` because the id is only known at request time and
 * `typedRoutes` cannot check it. Any of a debater's Tabroom ids resolves; the
 * page redirects to the canonical one, so a link built from whichever id a
 * table happened to hold still lands somewhere stable.
 */
export function debaterHref(season: SeasonId, id: string): never {
  return `/${season}/debater/${encodeURIComponent(id)}` as never;
}

/**
 * The site's navigation, as data.
 *
 * Grouped by whose numbers they are, because that is the distinction the whole
 * project rests on and the one a reader most needs the navigation to make. A
 * row that put the league's points beside our own rating with nothing between
 * them would be telling the reader they are the same kind of claim.
 */
export interface NavItem {
  label: string;
  path: SeasonPath;
  /** Sub-pages, shown when this section is the current one. */
  children?: { label: string; path: SeasonPath }[];
}

export const SEASON_NAV: NavItem[] = [
  {
    label: 'Points',
    path: '/points',
    children: [
      { label: 'Teams', path: '/points' },
      { label: 'Debaters', path: '/points/debaters' },
      { label: 'Schools', path: '/points/schools' },
    ],
  },
  { label: 'Ratings', path: '/ratings' },
  { label: 'Speakers', path: '/speakers' },
];

/**
 * Pages that are not about one season.
 *
 * Ordered by how likely a reader is to want them, not alphabetically: Method
 * answers the question the tables provoke, Feedback is where a wrong number
 * gets reported, and About is the one nobody needs in a hurry.
 */
export const SITE_NAV = [
  { label: 'Method', path: '/method' },
  { label: 'Feedback', path: '/feedback' },
  { label: 'Privacy', path: '/privacy' },
  { label: 'About', path: '/about' },
] as const;
