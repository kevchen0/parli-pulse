import Link from 'next/link';
import { currentSeason, seasonHref } from '@/lib/season';

export const metadata = { title: 'Method — Parli Pulse' };

/**
 * What each number on the site is, and how far to trust it.
 *
 * Global rather than season-scoped: the methods do not change with the season,
 * and a reader asking "what is this number" is not asking it about a particular
 * year. The rating specification, which quotes figures measured on one season,
 * stays under that season and is linked from here.
 */
export default function MethodPage() {
  const season = currentSeason();

  return (
    <main className="wrap prose">
      <h1>Method</h1>

      <p className="lede">
        Three kinds of number appear on this site, and they are not the same kind of
        claim. This says what each one is, how it is produced, and where it can be wrong.
      </p>

      <h2>Article XXI points</h2>
      <p>
        The league&rsquo;s own scoring, recomputed rather than copied. Every published
        ballot is read from Tabroom, a record is assembled for each entry, and the Article
        XXI rules are applied to it: the non-breaking table, the elim points table, the
        break-percentage and prelim-count adjustments, walkovers, closeouts, hybrids and
        the diminishing-returns weighting over a partnership&rsquo;s best five tournaments.
      </p>
      <p>
        Recomputing rather than mirroring is the point. It means the figures can be
        checked, and it means a disagreement is visible instead of invisible. Agreement
        currently runs at 98% of individual results and 87% of partnership season totals,
        rising to 92% across the league&rsquo;s top hundred.
      </p>
      <p>
        Most of the remaining gap is not ours to close. Some tournaments published little
        or nothing to Tabroom; the league&rsquo;s sheet carries manual adjustments no
        engine can derive; and a few rows are typos that created partnerships which never
        existed. Every difference is listed on the{' '}
        <Link href={seasonHref(season, '/diagnostic')}>reconciliation page</Link>, result
        by result.
      </p>
      <p>
        <strong>Where a figure here differs from the league&rsquo;s, the league&rsquo;s is
        correct.</strong> Nothing on this site affects qualification or standing.
      </p>

      <h2>Rating</h2>
      <p>
        Ours, and nothing to do with Article XXI. Points measure what a partnership
        accumulated; the rating measures how strong they looked against the opponents they
        actually faced. A team that enters six tournaments will out-point a better team
        that entered three, and the rating is the attempt to say so.
      </p>
      <p>
        It is Glicko-2 over every decided round, corrected for the side advantage,
        weighted by how a panel split, and then pulled toward the middle of the field in
        proportion to how little is known about each partnership. On held-out rounds it
        predicts results better than the league&rsquo;s own ranking does — 63.4% against
        59.8% — which is the test it had to pass to be published at all.
      </p>
      <p>
        <Link href={seasonHref(season, '/method/ratings')}>
          The full specification, with the equations
        </Link>
        .
      </p>

      <h2>Speaker points</h2>
      <p>
        Also ours. A raw speaker score says as much about the judge as the debater: panels
        differ by two points and more, so a season average depends heavily on who you
        drew. Each ballot is measured against the judge who gave it, using a median and an
        interquartile spread so that one punitive score cannot stretch a judge&rsquo;s
        scale and quietly compress everyone else they ranked.
      </p>
      <p>
        Judges with few ballots are shrunk toward the field, because a median over four
        ballots is noise. Every figure is shown with a confidence interval, and the board
        is gated on a minimum number of ballots.
      </p>

      <h2>What none of these do</h2>
      <ul>
        <li>
          Predict who qualifies. The AQ and AL marks describe points already scored, not
          bids awarded. At-large selection is a committee decision this site does not
          model.
        </li>
        <li>
          Include results nobody published. A round with no recorded decision is left out
          rather than guessed at, so a partnership can have real season points and no
          rating.
        </li>
        <li>
          Carry any official weight. The league publishes the rankings that count.
        </li>
      </ul>

      <p>
        Found something wrong? <Link href="/feedback">Please say so</Link> — most errors
        here were caught by someone who knew the circuit and thought a figure looked odd.
      </p>
    </main>
  );
}
