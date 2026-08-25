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
        <span><b>{summary.ranked}</b> partnerships with 10 or more rounds</span>
        <span><b>{summary.rankedRounds.toLocaleString()}</b> rounds behind them</span>
        <span><b>{summary.periods}</b> tournaments rated</span>
        <span>open divisions only<sup className="fnref"><a href="#fn5">5</a></sup></span>
      </p>

      <RatingTable rows={ratings} />

      <ol className="footnotes">
        <li id="fn1">
          <b>Established</b> is the rating less its uncertainty, and it is what the table sorts
          by. A partnership climbs it by being confirmed as well as by winning, so twelve
          excellent rounds do not outrank ninety nearly as good. Sorting by <b>Rating</b>
          instead shows the raw estimate.
        </li>
        <li id="fn2">
          <b>Rating.</b> A Glicko-2 rating: 1500 is the starting point for a partnership nobody
          has seen, and roughly 100 points of difference means the stronger side wins about
          two rounds in three. The ± figure is the rating deviation — how far the true strength
          could reasonably sit from the estimate. It narrows as a partnership debates more and
          widens again while they are away.
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
          own measure; the league publishes nothing like it.
        </li>
      </ol>
    </>
  );
}
