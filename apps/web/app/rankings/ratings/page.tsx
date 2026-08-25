import Link from 'next/link';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { dbReady, getRatingSummary, getRatings } from '@/lib/db';
import RatingTable from './table';

export const revalidate = 300;

export default async function RatingsPage() {
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const [ratings, summary] = await Promise.all([getRatings(), getRatingSummary()]);
  if (ratings.length === 0) {
    return <p className="empty">No ratings yet. Run <code>npm run rate</code>.</p>;
  }

  return (
    <>
      <p className="lede" style={{ marginTop: '-1rem' }}>
        A strength rating, not a season total. Article XXI points measure what a partnership
        accumulated — five wins at a small local outscore four at Stanford — while this measures
        how good they have looked against whoever they actually debated. The two disagree on
        purpose. <b>The league&rsquo;s ranking is the official one.</b>
      </p>

      <p className="meta">
        <span><b>{summary.ranked}</b> partnerships with {MIN_RATED_ROUNDS} or more rounds</span>
        <span><b>{summary.rankedRounds.toLocaleString()}</b> rounds behind them</span>
        <span><b>{summary.periods}</b> tournaments rated</span>
        <span>open divisions only<sup className="fnref"><a href="#fn5">5</a></sup></span>
        <span className="methodlink"><Link href="/rankings/ratings/method">How this is calculated &rarr;</Link></span>
      </p>

      <RatingTable rows={ratings} />

      <ol className="footnotes">
        <li id="fn1">
          <b>Established</b> is the rating pulled back toward the middle of the field, by an
          amount that depends on how little is known about it &mdash; a settled rating barely
          moves, one resting on a handful of rounds moves most of the way back. It is what the
          table sorts by, so a partnership climbs it by being confirmed as well as by winning:
          twelve excellent rounds do not outrank ninety nearly as good, and a team that has
          only ever debated its own region cannot ride a thin rating to the top.
          Sorting by <b>Rating</b> instead shows the raw estimate.{' '}
          <Link href="/rankings/ratings/method#prior">The formula and why it is needed &rarr;</Link>
        </li>
        <li id="fn2">
          <b>Rating.</b> A Glicko-2 rating: 1500 is the starting point for a partnership nobody
          has seen, and roughly 100 points of difference means the stronger side wins about
          two rounds in three. The ± figure is the rating deviation — how far the true strength
          could reasonably sit from the estimate. It narrows as a partnership debates more and
          widens again while they are away. This is the number a prediction should use; the
          uncertainty belongs in the width of the answer rather than in the estimate.{' '}
          <Link href="/rankings/ratings/method#reading">Two numbers, two jobs &rarr;</Link>
        </li>
        <li id="fn3">
          <b>Rounds.</b> Rated rounds, not ballots: a three-judge panel is one round, won on a
          majority, and counted a little more heavily when the panel was unanimous. Partnerships
          below ten rounds still have a rating but are not ranked on it, because under ten the
          uncertainty is doing most of the talking.
        </li>
        <li id="fn4">
          <b>XXI rank</b> is the partnership&rsquo;s place in the official season standings, for
          comparison. The two columns measure different things and are expected to differ; where
          they do, the league&rsquo;s figure is the one that counts.
        </li>
        <li id="fn5">
          Open divisions only. A win from the opposition is worth slightly more than the same win
          from proposition, because opposition takes about 52% of decided rounds. Elimination
          rounds carry no bonus of their own — beating a stronger opponent is already worth more,
          and elim opponents are stronger, so a multiplier would count that twice. This is our
          own measure; the league publishes nothing like it.{' '}
          <Link href="/rankings/ratings/method">Full methodology &rarr;</Link>
        </li>
      </ol>
    </>
  );
}
