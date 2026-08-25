'use client';

import { useMemo, useState } from 'react';
import type { SpeakerRow } from '@/lib/db';

type SortKey = 'adjusted' | 'raw';

/** Shown before the reader asks for the rest, so the page opens quickly. */
const INITIAL_ROWS = 100;

export default function SpeakerTable({ rows }: { rows: SpeakerRow[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('adjusted');
  const [showAll, setShowAll] = useState(false);

  // Raw positions are computed once over everyone, so a search narrows the
  // table without renumbering it -- a debater keeps the same position whether
  // or not their school is filtered in.
  const rawRank = useMemo(() => {
    const order = [...rows].sort((a, b) => Number(b.meanRaw ?? 0) - Number(a.meanRaw ?? 0));
    return new Map(order.map((r, i) => [r, i + 1]));
  }, [rows]);

  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            (r.school ?? '').toLowerCase().includes(needle),
        )
      : rows;
    return [...filtered].sort((a, b) =>
      sort === 'raw'
        ? Number(b.meanRaw ?? 0) - Number(a.meanRaw ?? 0)
        : Number(b.meanDisplay) - Number(a.meanDisplay),
    );
  }, [rows, query, sort]);

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_ROWS);
  const hidden = sorted.length - visible.length;

  return (
    <>
      <div className="controls">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search debater or school"
          aria-label="Search debater or school"
        />
        <div className="segmented" role="group" aria-label="Sort by">
          {(['adjusted', 'raw'] as const).map((k) => (
            <button
              key={k}
              type="button"
              data-active={sort === k}
              onClick={() => setSort(k)}
            >
              {k === 'adjusted' ? 'Adjusted' : 'Raw'}
            </button>
          ))}
        </div>
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>School</th>
              <th>Debater</th>
              <th>Ballots</th>
              <th>Adjusted</th>
              <th>Raw</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={`${s.name}-${s.school ?? ''}-${i}`}>
                <td className="rank">{sort === 'adjusted' ? s.rank : rawRank.get(s)}</td>
                <td>
                  {s.school ?? '—'}
                  {s.region ? <span className="region"> · {s.region}</span> : null}
                </td>
                <td>{s.name}</td>
                <td className="region">{s.ballots}</td>
                <td className="pts">
                  {Number(s.meanDisplay).toFixed(2)}
                  {s.marginDisplay === null ? null : (
                    <span className="margin"> ± {Number(s.marginDisplay).toFixed(2)}</span>
                  )}
                </td>
                <td>{s.meanRaw === null ? '—' : Number(s.meanRaw).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 ? (
        <button type="button" className="showall" onClick={() => setShowAll(true)}>
          Show all {sorted.length}
        </button>
      ) : null}
      {sorted.length === 0 ? <p className="empty">No debaters match “{query}”.</p> : null}
    </>
  );
}
