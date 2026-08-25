import Link from 'next/link';

export const metadata = { title: 'About — Parli Pulse' };

export default function AboutPage() {
  return (
    <main className="wrap prose">
      <h1>About</h1>

      <p className="lede">
        Parli Pulse is an independent mirror of NPDL rankings, plus two measures the
        league does not publish. It is one person&rsquo;s project, built for a coach who
        wanted to see more than a points total.
      </p>

      <h2>Why it exists</h2>
      <p>
        Article XXI points answer one question well: what did a partnership accumulate
        over a season? Enter more tournaments, win more rounds, score more points. That is
        the right basis for qualification, and it is what the league publishes.
      </p>
      <p>
        It is not a description of how strong a team is. Five wins at a small local
        outscore four at Stanford, because the rules do not ask who you beat. Nor does it
        say anything about who is speaking well, since speaker points carry no ranking
        weight and vary as much with the judge as the debater.
      </p>
      <p>
        So this site does three things. It recomputes the league&rsquo;s own points from
        published results, so they can be checked. It adds a strength rating that prices
        who you actually debated. And it normalizes speaker points against the judge who
        awarded them.
      </p>

      <h2>How the numbers are produced</h2>
      <p>
        Results come from Tabroom, which publishes every ballot for most tournaments.
        Those are scored against Article XXI, then reconciled against the league&rsquo;s own
        spreadsheet result by result. The reconciliation is public, on the{' '}
        <Link href="/2025-26/diagnostic">diagnostic page</Link>, including the places we
        disagree.
      </p>
      <p>
        Agreement currently runs at 98% of individual results and 87% of partnership
        season totals, rising to 92% across the league&rsquo;s top hundred. Most of the
        remaining gap is not ours to close: some tournaments published little or nothing
        to Tabroom, and the league&rsquo;s sheet carries manual adjustments that no engine
        can derive.
      </p>

      <h2>What this is not</h2>
      <p>
        It is not official and it is not affiliated with the NPDL. Where a figure here
        differs from the league&rsquo;s, the league&rsquo;s is correct and ours is a bug or
        a disagreement worth reporting. Nothing here affects qualification, seeding or
        standing.
      </p>
      <p>
        The rating in particular is our own. The league publishes nothing like it, Article
        XXI does not use it, and it should not be quoted as though it carried weight.
      </p>

      <h2>Corrections</h2>
      <p>
        A wrong number is worth reporting even if you are not sure it is wrong.{' '}
        <Link href="/feedback">How to get in touch</Link>.
      </p>
    </main>
  );
}
