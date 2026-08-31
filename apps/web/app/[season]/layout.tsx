import { notFound } from 'next/navigation';
import { dbReady, getFreshness, getSeasons } from '@/lib/db';
import { currentSeason, isSeasonId, seasonStatus } from '@/lib/season';
import SeasonNav from './nav';
import SeasonPicker from './season-picker';
import FreshnessLine from './freshness';

export const revalidate = 300;

const STATUS_WORD = {
  final: 'complete',
  live: 'in progress',
  upcoming: 'not started',
} as const;

/**
 * Everything under a season, with the season stated rather than assumed.
 *
 * The season is in the URL so a link keeps its meaning: a table shared in
 * August still shows the season it showed in August, rather than silently
 * becoming next season's once one opens.
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
  const [loaded, freshness] = dbReady()
    ? await Promise.all([getSeasons(), getFreshness(season)])
    : [[], null];
  // The current season belongs in the picker whether or not anything has been
  // loaded for it: "open, nothing published yet" is a state, not an absence.
  const ids = [...new Set([...loaded.map((s) => s.id), current])].sort().reverse();
  if (loaded.length > 0 && !ids.includes(season)) notFound();

  const status = seasonStatus(season);
  const statusOf = Object.fromEntries(ids.map((id) => [id, STATUS_WORD[seasonStatus(id)]]));
  const here = loaded.find((s) => s.id === season);

  return (
    <>
      <div className="seasonhead">
        <SeasonPicker season={season} seasons={ids} statusOf={statusOf} />
        <p className="seasonstate" data-status={status}>
          {/*
            Every season that holds anything says the same thing: when it last
            moved. It used to count tournaments while running and report a last
            result once finished, which is two sentences for one fact, and the
            picker beside it already says which of the two a season is -- the
            word "complete" was on screen twice.

            The date is the last result counted, so a finished season's line
            never changes and a running one moves as the league writes results
            up.
          */}
          {status === 'upcoming'
            ? 'Not yet open'
            : here?.lastResultOn
              ? `Last updated ${formatDay(here.lastResultOn)}`
              : status === 'final'
                ? 'Complete'
                : 'Open, nothing published yet'}
        </p>
      </div>
      {/*
        Only a running season can be stale. A finished one is never ingested
        again, so its timestamp drifts forever and the warning fires on figures
        that are correct and final -- which is worse than saying nothing, since
        the one place the site reports a broken pipeline would be crying wolf on
        every archived season. The header above already says "Complete, last
        results ...", which is the useful statement for a season that is done.
      */}
      {freshness && status !== 'final' && <FreshnessLine freshness={freshness} />}
      <SeasonNav season={season} />
      <main className="wrap">{children}</main>
    </>
  );
}

/** "2026-05-30" -> "30 May 2026". Dates here are days, never instants. */
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
