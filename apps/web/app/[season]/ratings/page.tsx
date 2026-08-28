import Link from 'next/link';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { seasonHref } from '@/lib/season';
import { dbReady, getRatingSummary, getRatings } from '@/lib/db';
import RatingTable from './table';

export const revalidate = 300;

export default async function RatingsPage(
  { params }: { params: Promise<{ season: string }> },
) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
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
      <h1>Ratings</h1>
      <p className="lede">Glicko-2 rating adjusted for deviation.</p>

      <p className="meta">
        <span><b>{summary.ranked}</b> partnerships with {MIN_RATED_ROUNDS} or more rounds</span>
        <span><b>{summary.rankedRounds.toLocaleString()}</b> rounds behind them</span>
        <span><b>{summary.periods}</b> tournaments rated</span>
        <span>Open divisions only</span>
        <span className="methodlink"><Link href="/method/ratings">How this is calculated &rarr;</Link></span>
      </p>

      <RatingTable rows={ratings} season={season} />

      <ol className="footnotes">
        <li id="fn1">
          <b>Rounds.</b> {summary.ranked} partnerships have {MIN_RATED_ROUNDS} or more,
          and only those are ranked. Under {MIN_RATED_ROUNDS} rounds the deviation stays
          wide enough that a few lucky results move a rating further than a season of good
          ones, so a place on the board would report who has been measured least. Every
          partnership keeps a rating either way; the gate decides only who is ranked.
        </li>
        <li id="fn2">
          <b>Established</b> is the rating pulled toward the field average by an amount set
          by its deviation: a narrow deviation keeps almost all of the distance between the
          rating and the average, a wide one gives up most of it. It is what the table sorts
          by, so a partnership climbs by being confirmed as well as by winning. Sorting by{' '}
          <b>Rating</b> shows the raw estimate.{' '}
          <Link href="/method/ratings#prior">The formula &rarr;</Link>
        </li>
        <li id="fn3">
          <b>Rating</b> is the Glicko-2 estimate. 1500 is the baseline, and 100 points of
          difference means the stronger side wins about 66% of the time. The ± figure is the
          rating deviation, or how far the true strength could reasonably sit from the
          estimate. It narrows with every round debated and widens with the number of weeks
          since the partnership last competed.{' '}
          <Link href="/method/ratings#reading">Two numbers, two jobs &rarr;</Link>
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
