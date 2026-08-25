import Link from 'next/link';
import { dbReady, getSeasons } from '@/lib/db';
import { currentSeason, seasonHref, seasonLabel } from '@/lib/season';

export const revalidate = 300;

export default async function Home() {
  const current = currentSeason();
  const seasons = dbReady() ? await getSeasons() : [];
  const live = seasons.find((s) => s.id === current);
  const hasLive = (live?.tournaments ?? 0) > 0;
  // The most recent season that actually holds results, which during the weeks
  // either side of an opener is not the current one.
  const previous = seasons.find((s) => s.id !== current && s.tournaments > 0);

  return (
    <main className="wrap">
      <h1>Parli Pulse</h1>
      <p className="lede">
        Rankings for American high school parliamentary debate — the league&rsquo;s official
        Article XXI points, alongside an independent rating computed from round-level
        results.
      </p>

      {/* A season that has opened with nothing published is a real state, and
          saying so plainly is better than an empty table or a stale one wearing
          this season's label. */}
      <section className="nowbar">
        <p className="nowseason">{seasonLabel(current)}</p>
        {hasLive ? (
          <p className="nowstate">
            <b>{live!.tournaments}</b> tournament{live!.tournaments === 1 ? '' : 's'} counted
            so far.{' '}
            <Link href={seasonHref(current, '/points')}>See the standings →</Link>
          </p>
        ) : (
          <p className="nowstate">
            The season has not published results yet. Standings appear here as tournaments
            report.{' '}
            <Link href={seasonHref(current, '/points')}>Season page →</Link>
          </p>
        )}
      </section>

      {previous && (
        <section className="prevbar">
          <p>
            {seasonLabel(previous.id)} is complete. Final standings, speaker points
            and ratings for the whole season are kept in full.
          </p>
          <p className="prevlinks">
            <Link href={seasonHref(previous.id, '/points')}>Teams</Link>
            <Link href={seasonHref(previous.id, '/points/debaters')}>Debaters</Link>
            <Link href={seasonHref(previous.id, '/points/schools')}>Schools</Link>
            <Link href={seasonHref(previous.id, '/speakers')}>Speakers</Link>
            <Link href={seasonHref(previous.id, '/ratings')}>Ratings</Link>
          </p>
        </section>
      )}

      <h2>What is here</h2>
      <div className="grid">
        <section className="card">
          <h3>Teams, debaters and schools</h3>
          <p>
            Article XXI points under the diminishing-returns formula, individual points
            pooled across every partner, and member-school totals with hybrids counting
            half to each.
          </p>
        </section>
        <section className="card">
          <h3>Speaker points</h3>
          <p>
            Normalized within each judge, so a generous panel and a harsh one are
            comparable, with a confidence interval on every figure.
          </p>
        </section>
        <section className="card">
          <h3>Rating</h3>
          <p>
            A Glicko-2 rating over every ballot, shrunk toward the field by its own
            uncertainty and kept visually distinct from official points.
          </p>
        </section>
        <section className="card">
          <h3>Reconciliation</h3>
          <p>
            Every partnership checked against the league&rsquo;s published standings,
            result by result, with the differences shown rather than hidden.
          </p>
        </section>
      </div>

      <h2>Still to come</h2>
      <div className="grid">
        <section className="card">
          <h3>Profiles</h3>
          <p>Debater, team, school and tournament pages, including head-to-head records.</p>
        </section>
        <section className="card">
          <h3>Judge scoring</h3>
          <p>
            Panel rate, dissent frequency and speaker generosity, shrunk by sample size and
            shown as distributions rather than a leaderboard.
          </p>
        </section>
      </div>
    </main>
  );
}
