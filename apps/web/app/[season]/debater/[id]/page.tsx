import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import {
  dbReady,
  getDebaterProfile as loadProfile,
  resolveDebaterId as lookupDebater,
} from '@/lib/db';

// generateMetadata and the page both need these, and Next calls them as two
// separate renders of the same request.
const resolveDebaterId = cache(lookupDebater);
const getDebaterProfile = cache(loadProfile);
import { debaterHref, seasonHref, seasonLabel } from '@/lib/season';
import DebaterLink from '@/app/debater-link';
import SeasonTable from './season-table';
import { DIMINISHING_RETURNS_WEIGHTS, TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';

export const revalidate = 300;

/**
 * The page title is the debater's name, which is the one piece of a profile a
 * suppressed debater must not have leak into a browser tab or a search result.
 * `resolveDebaterId` returns null for them, so the title falls back to the
 * generic one and the page itself 404s.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; id: string }>;
}) {
  // Never indexed, on every branch. The rest of the site is open to search
  // engines; a profile is a page about one minor, and a search result for their
  // name is a different exposure from a page somebody navigated to. robots.txt
  // also disallows this route -- that stops the fetch, this stops an index
  // built from an inbound link.
  const noindex = { robots: { index: false, follow: false } } as const;
  const { season, id } = await params;
  if (!dbReady()) return { title: 'Parli Pulse', ...noindex };
  const canonical = await resolveDebaterId(id);
  if (!canonical) return { title: 'Not found — Parli Pulse', ...noindex };
  const p = await getDebaterProfile(season, canonical);
  if (!p) return { title: 'Not found — Parli Pulse', ...noindex };
  return {
    title: `${p.name} — ${seasonLabel(season)} — Parli Pulse`,
    description: p.school
      ? `${p.name} of ${p.school}: Article XXI points, speaker points and partnership ratings for ${seasonLabel(season)}.`
      : undefined,
    ...noindex,
  };
}

const COUNTING = DIMINISHING_RETURNS_WEIGHTS.length;

/**
 * Identity is resolved here, above the streaming boundary, and only the profile
 * itself is suspended.
 *
 * `notFound()` and `redirect()` can only set a status code before the response
 * begins. Called from inside a `Suspense` child they still render the right
 * thing, but the status has already gone out as 200 and the redirect becomes a
 * client-side hop -- so a crawler is told a missing debater exists, and a link
 * to a merged id never resolves to the canonical one for anything that does not
 * run JavaScript. The resolution is one indexed lookup, so hoisting it costs a
 * few milliseconds of the streamed head.
 */
export default async function DebaterPage({
  params,
}: {
  params: Promise<{ season: string; id: string }>;
}) {
  const { season, id } = await params;
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;

  const canonical = await resolveDebaterId(id);
  // A missing debater and a withheld one are the same response deliberately.
  // A page that said "this debater has asked not to be listed" would publish
  // the fact of the request, which is the one thing the request was about.
  if (!canonical) notFound();
  if (canonical !== id) redirect(debaterHref(season, canonical));

  // No Suspense boundary. One around this page would stream a shell and then
  // stall exactly as the boards did: React 19.2 queues the reveal and, on this
  // version pair, never completes it, so the season table would render and then
  // be replaced by the fallback with nothing inside it hydrated -- and the
  // table's whole point now is that its rows open.
  return <Profile season={season} canonical={canonical} />;
}

async function Profile({ season, canonical }: { season: string; canonical: string }) {
  const p = await getDebaterProfile(season, canonical);
  if (!p) notFound();

  const counted = p.tournaments.filter((t) => t.weight > 0);
  const empty = p.tournaments.length === 0;
  const best = p.partnerships.find((x) => x.ranked) ?? p.partnerships[0] ?? null;

  return (
    <>
      <p className="crumb">
        <Link href={seasonHref(season, '/points/debaters')}>Debaters</Link>
        <span aria-hidden> · </span>
        {seasonLabel(season)}
      </p>
      <h1>
        {p.name}
        {p.autoQualified && (
          <abbr className="aq" title={`Autoqualified as an individual: ${TOC_AUTOQUAL_POINTS}+ points (XXII.1.A)`}>
            {' '}AQ
          </abbr>
        )}
      </h1>
      <p className="lede subject">
        {p.school ?? 'School unknown'}
        {p.region ? <span className="region"> · {p.region}</span> : null}
      </p>

      <div className="figures">
        <Figure
          label="Article XXI points"
          value={p.points === null ? '—' : p.points.toFixed(1)}
          note={p.rank ? ordinal(p.rank) : 'Unranked'}
          href={seasonHref(season, '/points/debaters')}
        />
        <Figure
          label="Speaker points"
          value={p.speaker ? p.speaker.meanDisplay.toFixed(2) : '—'}
          note={
            p.speaker
              ? `${p.speaker.rank ? `${ordinal(p.speaker.rank)}, ` : ''}${p.speaker.ballots} ballots`
              : 'Below the ballot threshold'
          }
          href={seasonHref(season, '/speakers')}
        />
        {/*
          The established figure rather than the raw rating, so the number and
          the place beneath it are the same claim: the board is ordered on the
          established figure, and a card reading 1934 above "1st" was pairing a
          rating with a rank that rating did not earn.

          `best` needs no change to follow it. The partnerships come back
          ordered on the established figure already, so the first ranked one was
          always the one this card meant.

          No ± here. The deviation belongs to the raw rating, and printing it
          beside the established number would offer it as an interval on a
          figure it is not an interval on -- the board does not print one in its
          Established column either. Rounds carry the weight of evidence.
        */}
        <Figure
          label={p.partnerships.length > 1 ? 'Best established rating' : 'Established rating'}
          value={best ? Math.round(best.shrunk).toString() : '—'}
          note={
            best
              ? [
                  best.ratingRank ? ordinal(best.ratingRank) : 'Unranked',
                  `${best.rounds} rounds`,
                ].join(' · ')
              : 'Not rated'
          }
          href={seasonHref(season, '/ratings')}
        />
      </div>

      {empty && (
        <p className="note aqnote nothing">
          <b>Nothing yet for {seasonLabel(season)}.</b> This debater has no results in
          this season. While a season is running that is the ordinary state until the
          league writes up a tournament they attended, rather than a sign anything is
          missing. The season control above stays on this debater, so it will take you to
          a season they did compete in.
        </p>
      )}

      {p.autoQualified && (
        <p className="note aqnote">
          Cleared the {TOC_AUTOQUAL_POINTS}-point individual autoqualification line
          (XXII.1.A). A partnership may only accept a bid when <em>both</em> partners
          cleared it.
        </p>
      )}

      {!empty && (
      <>
      <h2>Season</h2>
      <p className="note">
        Every tournament, most recent first. Article XXI.7 counts the best{' '}
        {COUNTING} at falling weights — {DIMINISHING_RETURNS_WEIGHTS.join(', ')} — so most
        results here contribute nothing to the total, which is the rule working rather
        than a result being ignored. The {counted.length === 1 ? 'one that counts is' : `${counted.length} that count are`}{' '}
        marked. Open a tournament for its rounds: every round we hold a ballot for, with
        the split shown where a panel was divided, and speaker points this debater&rsquo;s
        own, adjusted for the judge who gave them.
      </p>

      <SeasonTable season={season} tournaments={p.tournaments} points={p.points} />

      {p.partnerships.length > 0 && (
        <>
          <h2>Partnerships</h2>
          <p className="note">
            <b>Points</b> are the league&rsquo;s: this partnership&rsquo;s Article XXI season
            total, on a different scale from the individual figure above, which pools a
            debater&rsquo;s results across every partner. <b>Rating</b> is ours — a
            Glicko-2 strength estimate, with the deviation saying how much it has been
            confirmed. A partnership under {MIN_RATED_ROUNDS} rated rounds keeps a rating
            but is not placed on the board — and the board is ordered on the rating pulled
            toward the field by that deviation, not on the rating itself, so a place on it
            and the figure here do not move together.{' '}
            <Link href="/method#rating">How it works</Link>.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>With</th>
                  <th className="num">Points</th>
                  <th className="num">Rating</th>
                  <th className="num">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {p.partnerships.map((x) => (
                  <tr key={x.subjectId}>
                    <td>
                      {x.partner ? (
                        <DebaterLink season={season} id={x.partner.id} name={x.partner.name} />
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                    <td className="pts num">
                      {x.points === null ? (
                        <span className="faint">—</span>
                      ) : (
                        x.points.toFixed(1)
                      )}
                    </td>
                    <td className="num">
                      {Math.round(x.rating)}
                      <span className="margin"> ± {Math.round(x.deviation)}</span>
                    </td>
                    <td className="num">
                      {x.rounds}
                      {!x.ranked && (
                        <abbr
                          className="tick pending"
                          title={`Under ${MIN_RATED_ROUNDS} rated rounds, so this partnership keeps a rating but is not placed on the board.`}
                        >
                          {' '}*
                        </abbr>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      </>
      )}
    </>
  );
}

function Figure({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
}) {
  return (
    <div className="figure">
      <h3>
        <Link href={href as never}>{label}</Link>
      </h3>
      <p className="fval">{value}</p>
      <p className="fnote">{note}</p>
    </div>
  );
}

const ordinal = (n: number): string => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};
