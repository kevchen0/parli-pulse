import Link from 'next/link';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { seasonHref } from '@/lib/season';
import { dbReady, getRatingSummary, getRatings } from '@/lib/db';
import RatingTable from './table';
import FootnoteRef from '@/app/footnote-ref';

import { plural } from '@/lib/labels';

export const revalidate = 300;

/**
 * The heading and the lede are not data, so they are not behind the boundary.
 * They render at once and the board streams in under them, which is what lets
 * the fallback be a bar rather than a drawing of the table.
 */
export default async function RatingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { season } = await params;
  const sp = await searchParams;
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;

  return (
    <>
      <h1>Ratings</h1>
      <p className="lede">Glicko-2 rating adjusted for deviation.</p>
      <RatingsBoard season={season} initialQuery={(sp.q ?? '').trim()} />
    </>
  );
}

async function RatingsBoard({ season, initialQuery }: { season: string; initialQuery: string }) {
  const [ratings, summary] = await Promise.all([getRatings(season), getRatingSummary(season)]);
  if (ratings.length === 0) {
    return (
      <p className="empty">
        No ratings yet for this season. A rating needs decided rounds to build on, so
        these appear once tournaments have been debated and their results published.
      </p>
    );
  }

  return (
    <>
      <p className="meta">
        <span>
          <b>{summary.ranked}</b> {plural(summary.ranked, 'partnership')} with {MIN_RATED_ROUNDS} or more rounds
          <FootnoteRef notes={[1]} />
        </span>
        <span><b>{summary.rankedRounds.toLocaleString()}</b> {plural(summary.rankedRounds, 'round')} behind them</span>
        <span><b>{summary.periods}</b> {plural(summary.periods, 'tournament')} rated</span>
        <span>Open divisions only</span>
        <span className="methodlink"><Link href="/method#rating">How this is calculated &rarr;</Link></span>
      </p>

      <RatingTable rows={ratings} season={season} initialQuery={initialQuery} />

      <ol className="footnotes">
        <li id="fn1">
          {MIN_RATED_ROUNDS} rated rounds is one tournament, which is what it takes to be
          ranked. Below that there is not a tournament&rsquo;s worth of evidence to place a
          partnership against the field at all. Everyone keeps a rating either way, and
          the board is ordered on the rating pulled toward the field average, so a
          partnership with few rounds sits near the middle of the field until it has
          confirmed more rather than riding a short run.
        </li>
        <li id="fn2">
          <b>Rating</b> is the raw estimate moved toward the field average, further when
          the deviation is wider. A partnership with a narrow deviation shows close to its
          full estimate; one with a wide deviation shows a number close to the average. It
          is what the table sorts by, so a partnership climbs by being confirmed as well as
          by winning. Sorting by <b>Raw estimate</b> shows the figure before the move.{' '}
          <Link href="/method#shrink">Two numbers, two jobs &rarr;</Link>
        </li>
        <li id="fn3">
          <b>Raw estimate</b> is the Glicko-2 figure itself. 1500 is the baseline, and 100
          points of difference means the stronger side wins about 66% of the time. The ± is the
          rating deviation, or how far the true strength could reasonably sit from the
          estimate. It narrows with every round debated and widens with the number of weeks
          since the partnership last competed.{' '}
          <Link href="/method#why">Why Glicko-2 &rarr;</Link>
        </li>
        <li id="fn4">
          <b>XXI rank</b> is the partnership&rsquo;s place in the official season standings,
          shown for comparison. The two columns measure different things and are expected to
          disagree.
        </li>
      </ol>
    </>
  );
}
