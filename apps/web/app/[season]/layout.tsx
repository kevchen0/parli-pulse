import { notFound } from 'next/navigation';
import Link from 'next/link';
import { dbReady, getSeasons } from '@/lib/db';
import { currentSeason, isSeasonId, seasonHref, seasonLabel, seasonStatus } from '@/lib/season';

export const revalidate = 300;

/**
 * Everything under a season, with the season stated rather than assumed.
 *
 * The season is in the URL so a link keeps its meaning: a table shared in
 * August still shows the season it showed in August, rather than becoming next
 * season's the moment one opens. The strip below says which season is on screen
 * and whether it is still running, because a finished season presented without
 * that qualifier reads as this week's results.
 */
export default async function SeasonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  if (!isSeasonId(season)) notFound();

  const current = currentSeason();
  const status = seasonStatus(season);
  const seasons = dbReady() ? await getSeasons() : [];
  // The current season belongs in the picker whether or not anything has been
  // loaded for it: "open, nothing published yet" is a state, not an absence.
  const known = [...new Set([...seasons.map((s) => s.id), current])].sort().reverse();
  if (seasons.length > 0 && !known.includes(season)) notFound();

  const loaded = seasons.find((s) => s.id === season);
  const ended = loaded?.lastResultOn ?? null;

  return (
    <>
      <div className="seasonbar" data-status={status}>
        <nav className="seasonpick" aria-label="Season">
          {known.map((id) => (
            <Link
              key={id}
              href={seasonHref(id, '/rankings')}
              data-active={id === season}
              aria-current={id === season ? 'page' : undefined}
            >
              {seasonLabel(id)}
            </Link>
          ))}
        </nav>
        <p className="seasonstate">
          {status === 'final' && (
            <>
              <b>Final.</b> This season is complete
              {ended ? ` — last results ${formatDay(ended)}` : ''}.
            </>
          )}
          {status === 'live' && loaded && loaded.tournaments > 0 && (
            <>
              <b>In progress.</b> {loaded.tournaments} tournament
              {loaded.tournaments === 1 ? '' : 's'} counted
              {ended ? `, through ${formatDay(ended)}` : ''}.
            </>
          )}
          {status === 'live' && (!loaded || loaded.tournaments === 0) && (
            <>
              <b>No results yet.</b> This season has opened but nothing has been published.
            </>
          )}
          {status === 'upcoming' && <><b>Not started.</b> This season has not opened.</>}
        </p>
      </div>
      {children}
    </>
  );
}

/** "2026-05-30" -> "30 May 2026". Dates are days here, never instants. */
function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
