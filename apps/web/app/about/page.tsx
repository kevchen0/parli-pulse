import Link from 'next/link';

export const metadata = { title: 'About — Parli Pulse' };

export default function AboutPage() {
  return (
    <main className="wrap prose">
      <h1>About</h1>

      <p className="lede">
        Parli Pulse shows NPDL rankings for high school parliamentary debate, plus two
        measures the league does not publish: a strength rating, and speaker points
        adjusted for the judge who gave them. It is one person&rsquo;s project, built for
        a coach who wanted to see more than a points total.
      </p>

      <h2>Why it exists</h2>
      <p>
        Article XXI points measure what a partnership accumulated over a season. Enter
        more tournaments, win more rounds, score more points. That is the right way to
        decide qualification, and it is what the league publishes.
      </p>
      <p>
        It does not tell you how strong a team is. Five wins at a small local tournament
        outscore four at Stanford, because the rules do not ask who you beat. It says
        nothing about speaking either, since speaker points carry no ranking weight and
        depend as much on the judge as the debater.
      </p>
      <p>
        So the site adds two things. A rating that accounts for who you actually debated,
        and speaker scores measured against the judge who awarded them.
      </p>

      <h2>Where the numbers come from</h2>
      <p>
        Tabroom publishes every ballot for most tournaments. The site reads those, scores
        them under Article XXI, and compares the result against the league&rsquo;s own
        spreadsheet one result at a time.
      </p>
      <p>
        On the 2025-26 season it matches the league on 96% of individual results and 92%
        of partnership season totals. Across the league&rsquo;s top hundred teams, 89%
        match exactly and 95% land within two points.
      </p>
      <p>
        Most of the rest cannot be fixed here. Some tournaments published little or
        nothing to Tabroom. The league&rsquo;s spreadsheet carries manual adjustments that
        no set of rules can reproduce. A few rows are typos. Every difference is recorded,
        and I will share the list with anyone who wants it.
      </p>

      <h2>What this is not</h2>
      <p>
        It is not official and it is not affiliated with the NPDL. Where a figure here
        differs from the league&rsquo;s, the league&rsquo;s is correct and mine is either a
        bug or a disagreement worth reporting. Nothing on this site affects qualification,
        seeding or standing.
      </p>
      <p>
        The rating is mine alone. The league publishes nothing like it, Article XXI does
        not use it, and it should not be quoted as though it counted for something.
      </p>

      <h2>Corrections</h2>
      <p>
        A number that looks wrong is worth reporting even if you are not sure.{' '}
        <Link href="/feedback">How to get in touch</Link>.
      </p>
    </main>
  );
}
