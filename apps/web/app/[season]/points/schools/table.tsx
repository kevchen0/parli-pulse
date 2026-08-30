'use client';

import { useMemo, useState } from 'react';
import type { SchoolRow } from '@/lib/db';
import { pageSlice } from '@/lib/paging';
import TableSearch from '@/app/table-search';
import TablePager from '@/app/table-pager';
import FootnoteRef from '@/app/footnote-ref';

/** The schools board, filtering and paging in the browser. See the teams board. */
export default function SchoolsTable({
  rows,
  initialQuery = '',
}: {
  rows: SchoolRow[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.region ?? '').toLowerCase().includes(needle),
    );
  }, [rows, query]);

  const { current, totalPages, shown: shown } = pageSlice(matches, page);

  return (
    <>
      <TableSearch
        value={query}
        onChange={(next) => { setQuery(next); setPage(1); }}
        placeholder="Search schools or regions"
        shown={matches.length}
        total={rows.length}
      />

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Region</th>
              <th className="num">
                Points<FootnoteRef notes={[1]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => (
              <tr key={`${s.name}-${i}`}>
                <td className="rank">{s.rank}</td>
                <td>{s.name}</td>
                <td className="region">{s.region ?? '—'}</td>
                <td className="pts num">
                  {Number(s.points).toFixed(1)}
                  {s.reconciliation === 'pending' && (
                    <abbr className="tick pending" title="Not yet published in the league's sheet">
                      {' '}*
                    </abbr>
                  )}
                  {s.reconciliation === 'differs' && (
                    <abbr
                      className="tick differs"
                      title={`Up to ${Number(s.exposure).toFixed(1)} points rest on partnerships that disagree with the sheet`}
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
      {matches.length === 0 ? <p className="empty">No schools match “{query}”.</p> : null}
    </>
  );
}
