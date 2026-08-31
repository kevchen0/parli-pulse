'use client';

import { Fragment, useState } from 'react';
import type { ProfileTournament } from '@/lib/db';
import { DIMINISHING_RETURNS_WEIGHTS } from '@parli-pulse/rules';
import { displayName } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import {
  entryResultLabel,
  panelLabel,
  prelimRecord,
  recordLabel,
  roundLabel,
  roundOutcome,
  sideLabel,
  walkoverLabel,
} from '@/lib/labels';

const COUNTING = DIMINISHING_RETURNS_WEIGHTS.length;

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

const shortDate = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * The season table, with each tournament opening onto its own rounds.
 *
 * These were two sections. The season table listed every tournament with its
 * record and result, and a "Round by round" list underneath repeated the same
 * tournaments, the same records and the same results as the summary line of a
 * collapsed panel -- so a reader who wanted the rounds for one tournament read
 * its name twice and scrolled past the other fourteen to find it.
 *
 * One list now. The row is the summary the second list was duplicating, and it
 * opens in place. Rounds stay collapsed by default for the reason they always
 * were: fifteen tournaments of eight rounds is a hundred and twenty rows, and
 * the season table is the argument the page is making.
 */
export default function SeasonTable({
  season,
  tournaments,
  points,
}: {
  season: string;
  tournaments: ProfileTournament[];
  /** The season total, for the foot. Null where nothing scored. */
  points: number | null;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const counted = tournaments.filter((t) => t.weight > 0);

  const toggle = (entryId: string): void =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(entryId)) next.add(entryId);
      return next;
    });

  return (
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
          {tournaments.map((t) => {
            const isOpen = open.has(t.entryId);
            return (
              <Fragment key={t.entryId}>
                <tr className={t.weight > 0 ? 'pick' : undefined}>
                  <td>
                    {/*
                      A button rather than a clickable row. The row already holds
                      a link to the partner, and a link inside a clickable region
                      is two targets in one place for a mouse and an ambiguity
                      for everything else.
                    */}
                    <button
                      type="button"
                      className="rowtoggle"
                      aria-expanded={isOpen}
                      onClick={() => toggle(t.entryId)}
                    >
                      {t.name}
                      {t.startsOn ? (
                        <span className="region"> · {shortDate(t.startsOn)}</span>
                      ) : null}
                    </button>
                  </td>
                  {/*
                    Counted from the rounds rather than read from the stored
                    pair, which folds a tied panel into the losses. Where the
                    tournament published no rounds there is nothing to count, so
                    the stored figures stand.
                  */}
                  <td className="rec">
                    {t.rounds.length > 0
                      ? recordLabel(prelimRecord(t.rounds))
                      : `${t.prelimWins}–${t.prelimLosses}`}
                  </td>
                  <td>{entryResultLabel(t.elimLevel) ?? <span className="faint">Did not break</span>}</td>
                  <td className="with">
                    {t.partner ? (
                      <DebaterLink season={season} id={t.partner.id} name={t.partner.name} />
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td className="num">
                    {t.points === null ? (
                      /*
                        A dash, like every other empty cell on the page. The
                        reason stays on the title, and the row opens onto the
                        longer version of it where the tournament published no
                        rounds at all.
                      */
                      <abbr className="noresult" title={noResultReason(t)}>
                        —
                      </abbr>
                    ) : (
                      t.points.toFixed(0)
                    )}
                  </td>
                  <td className="num weight">
                    {t.weight > 0 ? `×${t.weight.toFixed(1)}` : <span className="faint">—</span>}
                  </td>
                  <td className="num">
                    {t.weight > 0 ? t.contribution.toFixed(1) : <span className="faint">0</span>}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="roundsrow">
                    <td colSpan={7}>
                      <Rounds t={t} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>
              Season total, best {Math.min(counted.length, COUNTING)} weighted
            </td>
            <td className="num total">{points === null ? '—' : points.toFixed(1)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * What one tournament opens onto.
 *
 * A tournament with no rounds still opens, and says why rather than showing an
 * empty table. That sentence was previously only in the `title` of the "No
 * result" marker in the points column, where a phone cannot reach it.
 */
function Rounds({ t }: { t: ProfileTournament }) {
  if (t.rounds.length === 0) {
    const scored = t.points !== null;
    return (
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
            these rounds anywhere and nothing has been scored. It is a gap in the source
            rather than a nil result.
          </>
        )}
      </p>
    );
  }

  return (
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
                  {r.speaks === null ? <span className="faint">—</span> : r.speaks.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
