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
          {status === 'final' &&
            `Complete${here?.lastResultOn ? `, last results ${formatDay(here.lastResultOn)}` : ''}`}
          {/*
            A running season says when it last moved, not how far it has got.
            The count belongs to the board below, which states it already, and
            "1 tournament counted" is a scale nobody needs in September and a
            number that reads as small all season. The date is the last result
            counted, the same figure a complete season reports.
          */}
          {status === 'live' &&
            (here?.lastResultOn
              ? `Last updated ${formatDay(here.lastResultOn)}`
              : 'Open, nothing published yet')}
          {status === 'upcoming' && 'Not yet open'}
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
