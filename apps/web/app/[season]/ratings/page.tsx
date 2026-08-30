import Link from 'next/link';
import { Suspense } from 'react';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { seasonHref } from '@/lib/season';
import { dbReady, getRatingSummary, getRatings } from '@/lib/db';
import RatingTable from './table';
import FootnoteRef from '@/app/footnote-ref';
import LoadingBar from '@/app/loading-bar';

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
      <Suspense fallback={<LoadingBar label="Loading the ratings" />}>
        <RatingsBoard season={season} initialQuery={(sp.q ?? '').trim()} />
      </Suspense>
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
          <b>{summary.ranked}</b> partnerships with {MIN_RATED_ROUNDS} or more rounds
          <FootnoteRef notes={[1]} />
        </span>
        <span><b>{summary.rankedRounds.toLocaleString()}</b> rounds behind them</span>
        <span><b>{summary.periods}</b> tournaments rated</span>
        <span>Open divisions only</span>
        <span className="methodlink"><Link href="/method#rating">How this is calculated &rarr;</Link></span>
      </p>

      <RatingTable rows={ratings} season={season} initialQuery={initialQuery} />

      <ol className="footnotes">
        <li id="fn1">
          Under {MIN_RATED_ROUNDS} rounds a deviation is wide enough that a short lucky
          run places higher than a season of steady results, so those partnerships are left
          unranked. Many of them appear at a single tournament. They keep a rating either
          way, but are only ranked after meeting the {MIN_RATED_ROUNDS} round threshold.
        </li>
        <li id="fn2">
          <b>Established</b> is the rating moved toward the field average, further when the
          deviation is wider. A partnership with a narrow deviation shows close to its full
          rating; one with a wide deviation shows a number close to the average. It is what
          the table sorts by, so a partnership climbs by being confirmed as well as by
          winning. Sorting by <b>Rating</b> shows the raw estimate.{' '}
          <Link href="/method#prior">The formula &rarr;</Link>
        </li>
        <li id="fn3">
          <b>Rating</b> is the Glicko-2 estimate. 1500 is the baseline, and 100 points of
          difference means the stronger side wins about 66% of the time. The ± figure is the
          rating deviation, or how far the true strength could reasonably sit from the
          estimate. It narrows with every round debated and widens with the number of weeks
          since the partnership last competed.{' '}
          <Link href="/method#shrink">Two numbers, two jobs &rarr;</Link>
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
