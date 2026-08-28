import Link from 'next/link';
import { dbReady, getSeasons } from '@/lib/db';
import { currentSeason, seasonLabel, seasonStatus } from '@/lib/season';

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
  // The live season belongs in the list before it holds anything: "open, nothing
  // scored yet" is a state a reader needs, and dropping the row reads as though
  // the season does not exist.
  const current = currentSeason();
  const listed = seasons.some((s) => s.id === current)
    ? seasons
    : [{ id: current, tournaments: 0, lastResultOn: null }, ...seasons];

  return (
    <main className="wrap prose">
      <h1>About</h1>

      <p className="lede">
        parli-pulse is an independent, open-sourced project to bring more analytics to
        parliamentary debate.
      </p>

      <h2>About me</h2>
      <p>
        I&rsquo;m Kevin Chen, an ex-parli debater who debated for Nueva from 2023 to 2026.
        Ever since I was introduced to debate.land and DebateDrills rankings for Public
        Forum debate, I&rsquo;ve always wanted more in-depth data visualization for
        parliamentary debate. We can&rsquo;t let the PF kids have everything! This project
        is entirely developed and maintained by me (and Claude), and I appreciate any
        comments and suggestions about how to improve it.
      </p>
      <p>
        My own results are in the data. They are computed by the same code as everyone
        else&rsquo;s and I do not adjust them.
      </p>

      <h2>What it covers</h2>
      <ul>
        {listed.map((s) => (
          <li key={s.id}>
            <b>{seasonLabel(s.id)}</b>{' '}
            {seasonStatus(s.id) === 'final'
              ? `— ${s.tournaments} tournaments, complete.`
              : s.tournaments > 0
                ? `— the live season. ${s.tournaments} tournament${s.tournaments === 1 ? '' : 's'} so far.`
                : '— the live season. Nothing scored yet.'}
          </li>
        ))}
      </ul>
      <p>
        Seasons before 2025&ndash;26 are not loaded. Article XXI has changed materially over the
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
          Results from tournaments that never posted to Tabroom. A few every season post
          little or nothing, and those are entered by hand or missing.
        </li>
        <li>
          Team, school and tournament pages, and head-to-head records. We are working on
          these.
        </li>
        <li>Judge statistics.</li>
        <li>
          Ratings carried over from a previous season. Each season is rated on its own
          rounds, so early in a season most teams have not debated enough to be ranked.
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
          <Link href="/feedback">Feedback</Link> &mdash; report a wrong number or a bug, or
          suggest a feature.
        </li>
      </ul>
    </main>
  );
}
