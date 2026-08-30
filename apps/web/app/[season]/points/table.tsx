'use client';

import { useMemo, useState } from 'react';
import type { TeamRow } from '@/lib/db';
import { pageSlice } from '@/lib/paging';
import TableSearch from '@/app/table-search';
import TablePager from '@/app/table-pager';
import { nameMatches } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import FootnoteRef from '@/app/footnote-ref';

/**
 * A partnership's standing relative to the TOC, as far as points can say it.
 *
 * `bid` is the one the rules decide outright: XXII.1.E lets a partnership accept
 * an autoqualification bid only when both partners cleared the individual
 * threshold. `atLarge` marks a partnership with one partner qualified and one
 * not, which cannot accept a bid and would need an at-large one.
 *
 * At-large bids are awarded by committee against regional allocations that are
 * not modelled here, so this predicts nothing. It says which side of XXII.1.E a
 * partnership fell on, and no more.
 */
function tocStanding(team: TeamRow): 'bid' | 'atLarge' | null {
  if (team.partnersQualified >= 2) return 'bid';
  return team.partnersQualified === 1 ? 'atLarge' : null;
}

/**
 * The teams board, filtering and paging in the browser.
 *
 * It used to search through the server: a form, a `?q=`, and a fresh render for
 * every query. The ratings and speakers boards have always filtered in state and
 * are the ones that feel right to use, so this now matches them. The rows are
 * all here either way -- the page already read every partnership to rank them.
 *
 * Ranks come from the server and are not recomputed, so a search narrows the
 * table without renumbering it.
 */
export default function TeamsTable({
  rows,
  season,
  initialQuery = '',
}: {
  rows: TeamRow[];
  season: string;
  /** `?q=` as the page was served, so a shared search arrives filtered. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (x) =>
        nameMatches(x.debater1, needle) ||
        nameMatches(x.debater2, needle) ||
        (x.school ?? '').toLowerCase().includes(needle),
    );
  }, [rows, query]);

  // Searching puts the reader at the top of a new result set, so the page
  // resets with them rather than stranding them on page seven of a list that no
  // longer has seven pages.
  const { current, totalPages, shown: shown } = pageSlice(matches, page);

  return (
    <>
      <TableSearch
        value={query}
        onChange={(next) => { setQuery(next); setPage(1); }}
        placeholder="Search debaters or schools"
        shown={matches.length}
        total={rows.length}
      />

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Partnership</th>
              <th className="num">Tourns</th>
              <th className="num">
                Points<FootnoteRef notes={[2]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t, i) => {
              const standing = tocStanding(t);
              return (
                <tr key={`${t.debater1 ?? 'withheld'}-${t.debater2 ?? 'withheld'}-${i}`}>
                  <td className="rank">{t.rank}</td>
                  <td>
                    {t.school ?? '—'}
                    {t.region ? <span className="region"> · {t.region}</span> : null}
                  </td>
                  <td>
                    <DebaterLink season={season} id={t.debater1Id} name={t.debater1} />
                    {' & '}
                    <DebaterLink season={season} id={t.debater2Id} name={t.debater2} />
                    {standing === 'bid' && (
                      <abbr className="aq" title="Both partners autoqualified (XXII.1.A, XXII.1.E)">
                        {' '}AQ
                      </abbr>
                    )}
                    {standing === 'atLarge' && (
                      <abbr className="al" title="One partner autoqualified, the other did not">
                        {' '}AL
                      </abbr>
                    )}
                  </td>
                  <td className="num">{t.tournaments}</td>
                  <td className="pts num">
                    {Number(t.points).toFixed(1)}
                    {t.reconciliation === 'pending' && (
                      <abbr className="tick pending" title="Not yet published in the league's sheet">
                        {' '}*
                      </abbr>
                    )}
                    {t.reconciliation === 'differs' && (
                      <abbr
                        className="tick differs"
                        title={`League's sheet says ${Number(t.officialPoints).toFixed(1)}`}
                      >
                        {' '}*
                      </abbr>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePager page={current} totalPages={totalPages} rows={matches.length} onPage={setPage} />
      {matches.length === 0 ? <p className="empty">No partnerships match “{query}”.</p> : null}
    </>
  );
}
