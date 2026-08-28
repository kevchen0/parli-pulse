import Link from 'next/link';
import { dbReady, getSeasons } from '@/lib/db';
import { seasonLabel, seasonStatus } from '@/lib/season';

export const metadata = { title: 'About — Parli Pulse' };

export const revalidate = 300;

/**
 * Who made this, what it covers, and what it does not have.
 *
 * Deliberately holds nothing that another page owns. The arithmetic is on
 * Method, the data policy is on Privacy, and the unofficial notice is in the
 * masthead of every page. What is left is the part only this page can carry:
 * a named person, the scope of the data, and the gaps.
 *
 * Coverage reads the database rather than being typed out, because a page
 * describing which seasons exist is exactly the page that goes stale first.
 */
export default async function AboutPage() {
  const seasons = dbReady() ? await getSeasons() : [];
  const withResults = seasons.filter((s) => s.tournaments > 0);

  return (
    <main className="wrap prose">
      <h1>About</h1>

      <p className="lede">
        Parli Pulse shows NPDL rankings for high school parliamentary debate, with a
        strength rating and judge-adjusted speaker points that the league does not publish.
      </p>

      <h2>Who made it</h2>
      <p>
        Kevin Chen, who debated for Nueva. It started as a way to answer a question the
        official standings cannot: not who has accumulated the most points, but who is
        actually strong.
      </p>
      <p>
        My own results are in the data. They are computed by the same code as everyone
        else&rsquo;s and I do not adjust them.
      </p>

      <h2>What it covers</h2>
      {withResults.length > 0 ? (
        <ul>
          {withResults.map((s) => (
            <li key={s.id}>
              <b>{seasonLabel(s.id)}</b> &mdash; {s.tournaments} tournament
              {s.tournaments === 1 ? '' : 's'}
              {seasonStatus(s.id) === 'final' ? ', complete' : ', in progress'}.
            </li>
          ))}
        </ul>
      ) : (
        <p>No season holds results yet.</p>
      )}
      <p>
        Seasons before 2025-26 are not loaded. Article XXI has changed materially over the
        years, so points scored under an older version of the rules are not comparable to
        current ones, and recomputing them under today&rsquo;s rules would produce figures
        that never existed.
      </p>
      <p>
        A season in progress fills in as the league scores each tournament, which is a lag
        rather than a gap: a tournament appears here once the league has written it up.
      </p>

      <h2>What it does not have</h2>
      <ul>
        <li>
          Results from tournaments that published nothing to Tabroom, unless they have been
          entered by hand. A few every season publish little or nothing.
        </li>
        <li>Team, school and tournament pages, and head-to-head records. Planned.</li>
        <li>Judge statistics of any kind.</li>
        <li>
          Ratings that carry between seasons. Each season is rated on its own rounds and
          starts from scratch, so a board in September is thin by construction.
        </li>
      </ul>

      <h2>Where to look next</h2>
      <ul>
        <li>
          <Link href="/method">Method</Link> &mdash; how every figure on the site is
          produced, and how closely the points match the league&rsquo;s own.
        </li>
        <li>
          <Link href="/privacy">Privacy</Link> &mdash; what appears here, what never does,
          and how to have a name removed.
        </li>
        <li>
          <Link href="/feedback">Feedback</Link> &mdash; report a wrong number, a missing
          partnership, or suggest a feature.
        </li>
      </ul>
    </main>
  );
}
