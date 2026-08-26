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
} from '@/lib/labels';
import { DIMINISHING_RETURNS_WEIGHTS, TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';

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
  if (!dbReady()) return <p className="empty">Database not connected.</p>;

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
  const best = p.partnerships.find((x) => x.ranked) ?? p.partnerships[0] ?? null;

  return (
    <>
      <p className="crumb">
        <Link href={seasonHref(season, '/points/debaters')}>Debaters</Link>
        <span aria-hidden> · </span>
        {seasonLabel(season)}
      </p>
      <h1>{p.name}</h1>
      <p className="lede subject">
        {p.school ?? 'School unknown'}
        {p.region ? <span className="region"> · {p.region}</span> : null}
      </p>

      <div className="figures">
        <Figure
          label="Article XXI points"
          value={p.points === null ? '—' : p.points.toFixed(1)}
          note={p.rank ? `${ordinal(p.rank)} among debaters` : 'Unranked'}
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
          label="Partnership rating"
          value={best ? Math.round(best.rating).toString() : '—'}
          note={best ? `± ${Math.round(best.deviation)} over ${best.rounds} rounds` : 'Not rated'}
          href={seasonHref(season, '/ratings')}
        />
      </div>

      {p.autoQualified && (
        <p className="note aqnote">
          Cleared the {TOC_AUTOQUAL_POINTS}-point individual autoqualification line
          (XXII.1.A). A partnership may only accept a bid when <em>both</em> partners
          cleared it.
        </p>
      )}

      <h2>Season</h2>
      <p className="note">
        Every tournament, in order. Article XXI.7 counts the best{' '}
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
                  {t.points === null ? <span className="faint">—</span> : t.points.toFixed(0)}
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
            Our own Glicko-2 rating, not the league&rsquo;s. A partnership is rated once it
            has debated, and ranked on the board once it has debated ten rounds — the
            deviation says how much the figure has been confirmed.{' '}
            <Link href={seasonHref(season, '/method/ratings')}>How it works</Link>.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>With</th>
                  <th className="num">Rating</th>
                  <th className="num">Rounds</th>
                  <th>On the board</th>
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
                    <td className="num">
                      {Math.round(x.rating)}
                      <span className="margin"> ± {Math.round(x.deviation)}</span>
                    </td>
                    <td className="num">{x.rounds}</td>
                    <td>
                      {x.ranked ? (
                        <Link href={seasonHref(season, '/ratings')}>Ranked</Link>
                      ) : (
                        <span className="faint">Under ten rounds</span>
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
  );
}

function TournamentRounds({ season, t }: { season: string; t: ProfileTournament }) {
  if (t.rounds.length === 0) {
    return (
      <details className="rounds">
        <summary>
          <span className="rtitle">{t.name}</span>
          <span className="rmeta">no rounds published</span>
        </summary>
        <p className="note inset">
          The tournament published no round data we could read, so its result was scored
          from the record the league recorded rather than from ballots.
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
              const outcome = roundOutcome(r.ballotsWon, r.ballots, r.bye);
              const panel = panelLabel(r.ballotsWon, r.ballots);
              return (
                <tr key={`${r.label}-${i}`}>
                  <td>{roundLabel(r.kind, r.elimLevel, r.label, r.isConsolation)}</td>
                  <td className="faint">{sideLabel(r.side) ?? '—'}</td>
                  <td>
                    {r.opponent ? (
                      <>
                        {r.opponent.names.map(displayName).join(' & ')}
                        {r.opponent.school ? (
                          <span className="region"> · {r.opponent.school}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="faint">{r.bye ? 'None — bye' : '—'}</span>
                    )}
                  </td>
                  <td>
                    <span className={`outcome ${outcome.state}`}>{outcome.text}</span>
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
