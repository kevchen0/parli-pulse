import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  dbReady,
  getDebaterProfile as loadProfile,
  resolveDebaterId as lookupDebater,
  type ProfileTournament,
} from '@/lib/db';

// generateMetadata and the page both need these, and Next calls them as two
// separate renders of the same request.
const resolveDebaterId = cache(lookupDebater);
const getDebaterProfile = cache(loadProfile);
import { debaterHref, seasonHref, seasonLabel } from '@/lib/season';
import { displayName } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import {
  entryResultLabel,
  panelLabel,
  roundLabel,
  roundOutcome,
  sideLabel,
  walkoverLabel,
} from '@/lib/labels';
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
  const { season, id } = await params;
  if (!dbReady()) return { title: 'Parli Pulse' };
  const canonical = await resolveDebaterId(id);
  if (!canonical) return { title: 'Not found — Parli Pulse' };
  const p = await getDebaterProfile(season, canonical);
  if (!p) return { title: 'Not found — Parli Pulse' };
  return {
    title: `${p.name} — ${seasonLabel(season)} — Parli Pulse`,
    description: p.school
      ? `${p.name} of ${p.school}: Article XXI points, speaker points and partnership ratings for ${seasonLabel(season)}.`
      : undefined,
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

  return (
    <Suspense fallback={<p className="empty">Loading…</p>}>
      <Profile season={season} canonical={canonical} />
    </Suspense>
  );
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
        <Figure
          label={p.partnerships.length > 1 ? 'Best partnership rating' : 'Partnership rating'}
          value={best ? Math.round(best.rating).toString() : '—'}
          note={
            best
              ? [
                  best.ratingRank ? ordinal(best.ratingRank) : 'Unranked',
                  `± ${Math.round(best.deviation)}`,
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
        marked.
      </p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Tournament</th>
              <th>Record</th>
              <th>Result</th>
              <th>With</th>
              <th className="num">Points</th>
              <th className="num">Weight</th>
              <th className="num">Counts</th>
            </tr>
          </thead>
          <tbody>
            {p.tournaments.map((t) => (
              <tr key={t.entryId} className={t.weight > 0 ? 'pick' : undefined}>
                <td>
                  {t.name}
                  {t.startsOn ? <span className="region"> · {shortDate(t.startsOn)}</span> : null}
                </td>
                <td className="rec">
                  {t.prelimWins}–{t.prelimLosses}
                </td>
                <td>{entryResultLabel(t.elimLevel) ?? <span className="faint">Did not break</span>}</td>
                <td className="with">
                  {t.partner ? (
                    <DebaterLink season={season} id={t.partner.id} name={t.partner.name} />
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
                <td className="pts num">
                  {t.points === null ? (
                    <abbr className="noresult" title={noResultReason(t)}>
                      No result
                    </abbr>
                  ) : (
                    t.points.toFixed(0)
                  )}
                </td>
                <td className="num weight">
                  {t.weight > 0 ? `×${t.weight.toFixed(1)}` : <span className="faint">—</span>}
                </td>
                <td className="num">
                  {t.weight > 0 ? (
                    t.contribution.toFixed(1)
                  ) : (
                    <span className="faint">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>
                Season total, best {Math.min(counted.length, COUNTING)} weighted
              </td>
              <td className="num total">{p.points === null ? '—' : p.points.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

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
            <Link href={seasonHref(season, '/method/ratings')}>How it works</Link>.
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

      <h2>Round by round</h2>
      <p className="note">
        Every round we hold a ballot for. A panel is decided on a majority of its
        ballots, and the split is shown where there was one. Speaker points are this
        debater&rsquo;s own, adjusted for the judge who gave them.
      </p>
      {p.tournaments.map((t) => (
        <TournamentRounds key={t.entryId} season={season} t={t} />
      ))}
      </>
      )}
    </>
  );
}

/**
 * Why a tournament produced no scored result.
 *
 * Three different things, and a reader who sees a blank in the points column
 * deserves to know which. An entry excluded under XXI.1.G scored nothing by
 * rule; a tournament with no rounds published to Tabroom is a gap in the
 * source; anything else was ingested but never scored, which usually means the
 * event does not count toward Article XXI at all.
 */
function noResultReason(t: ProfileTournament): string {
  if (t.excludedReason === 'teamSize') {
    return 'Not a two-person team, so the entry scores nothing under XXI.1.G.';
  }
  if (t.excludedReason) return `Excluded: ${t.excludedReason}.`;
  if (t.rounds.length === 0) {
    return 'This tournament published no results we could read. Nothing has been scored for it.';
  }
  return 'Rounds were published but the tournament scores no Article XXI points — a round robin, an exhibition, or a division outside the open one.';
}

function TournamentRounds({ season, t }: { season: string; t: ProfileTournament }) {
  if (t.rounds.length === 0) {
    const scored = t.points !== null;
    return (
      <details className="rounds">
        <summary>
          <span className="rtitle">{t.name}</span>
          <span className="rmeta">{scored ? 'no rounds published' : 'no results'}</span>
        </summary>
        <p className="note inset">
          {scored ? (
            <>
              The tournament published no round data we could read, so its result was
              scored from the record the league recorded rather than from ballots.
            </>
          ) : (
            <>
              <b>No results published.</b> This tournament put nothing we could read on
              Tabroom, and nothing has been hand-entered for it, so there is no record of
              these rounds anywhere and nothing has been scored. It is a gap in the
              source rather than a nil result.
            </>
          )}
        </p>
      </details>
    );
  }
  return (
    <details className="rounds">
      <summary>
        <span className="rtitle">{t.name}</span>
        <span className="rmeta">
          {t.prelimWins}–{t.prelimLosses}
          {entryResultLabel(t.elimLevel) ? ` · ${entryResultLabel(t.elimLevel)}` : ''}
          {' · '}
          {t.rounds.length === 1 ? '1 round' : `${t.rounds.length} rounds`}
        </span>
      </summary>
      <div className="tablewrap inset">
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Side</th>
              <th>Opponent</th>
              <th>Result</th>
              <th className="num">Speaks</th>
            </tr>
          </thead>
          <tbody>
            {t.rounds.map((r, i) => {
              const walk = r.walkover ? walkoverLabel(r.walkover) : null;
              const outcome = roundOutcome(r.ballotsWon, r.ballots, r.bye);
              const panel = walk ? null : panelLabel(r.ballotsWon, r.ballots);
              return (
                <tr key={`${r.label}-${i}`}>
                  <td>{roundLabel(r.kind, r.elimLevel, r.label, r.isConsolation)}</td>
                  <td className="faint">{sideLabel(r.side) ?? '—'}</td>
                  <td>
                    {r.opponent ? (
                      <>
                        {r.opponent.names.map(displayName).join(' & ')}
                        {r.opponent.school ? (
                          <span className="region">
                            {' · '}
                            {r.opponent.school}
                            {walk ? ' — same school' : ''}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="faint">{r.bye ? 'None — bye' : '—'}</span>
                    )}
                  </td>
                  <td>
                    {walk ? (
                      <abbr className="outcome walk" title={walk.title}>
                        {walk.text}
                      </abbr>
                    ) : (
                      <span className={`outcome ${outcome.state}`}>{outcome.text}</span>
                    )}
                    {panel ? <span className="margin"> {panel}</span> : null}
                  </td>
                  <td className="num">
                    {r.speaks === null ? (
                      <span className="faint">—</span>
                    ) : (
                      r.speaks.toFixed(1)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
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

const shortDate = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
