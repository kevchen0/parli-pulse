'use client';

import { useMemo, useState } from 'react';
import type { DebaterRow } from '@/lib/db';
import { pageSlice } from '@/lib/paging';
import TableSearch from '@/app/table-search';
import TablePager from '@/app/table-pager';
import { nameMatches } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import FootnoteRef from '@/app/footnote-ref';

/** The debaters board, filtering and paging in the browser. See the teams board. */
export default function DebatersTable({
  rows,
  season,
  initialQuery = '',
}: {
  rows: DebaterRow[];
  season: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (d) => nameMatches(d.name, needle) || (d.school ?? '').toLowerCase().includes(needle),
    );
  }, [rows, query]);

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
              <th>#</th><th>School</th><th>Debater</th>
              <th className="num">
                Points<FootnoteRef notes={[2]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={`${d.id}-${i}`}>
                <td className="rank">{d.rank}</td>
                <td>
                  {d.school ?? '—'}
                  {d.region ? <span className="region"> · {d.region}</span> : null}
                </td>
                <td>
                  <DebaterLink season={season} id={d.id} name={d.name} />
                  {d.autoQualified ? (
                    <abbr className="aq" title="Autoqualified as an individual (XXII.1.A)">
                      {' '}AQ
                    </abbr>
                  ) : null}
                </td>
                <td className="pts num">
                  {Number(d.points).toFixed(1)}
                  {d.reconciliation === 'pending' && (
                    <abbr className="tick pending" title="Not yet published in the league's sheet">
                      {' '}*
                    </abbr>
                  )}
                  {d.reconciliation === 'differs' && (
                    <abbr
                      className="tick differs"
                      title={`Up to ${Number(d.exposure).toFixed(1)} points rest on partnerships that disagree with the sheet`}
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

      <TablePager page={current} totalPages={totalPages} rows={matches.length} onPage={setPage} />
      {matches.length === 0 ? <p className="empty">No debaters match “{query}”.</p> : null}
    </>
  );
}
