'use client';

import { useMemo, useState } from 'react';
import type { SpeakerRow } from '@/lib/db';

type SortKey = 'z' | 'raw';
type Direction = 'desc' | 'asc';

import { pageSlice } from '@/lib/paging';
import TableSearch from '@/app/table-search';
import TablePager from '@/app/table-pager';
import { displayName, nameMatches } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import FootnoteRef from '@/app/footnote-ref';

/** Half-width of the 95% interval on the mean, in z units. */
const marginZ = (r: SpeakerRow): number | null =>
  r.sdZ === null || r.ballots < 2 ? null : (1.96 * Number(r.sdZ)) / Math.sqrt(r.ballots);

/**
 * Compared at the precision the table prints. Two scores that both read +0.69
 * are a tie as far as a reader is concerned, and ordering them on a fourth
 * decimal nobody can see looks arbitrary -- it put the wider interval first.
 */
const value = (r: SpeakerRow, key: SortKey): number =>
  Math.round((key === 'raw' ? Number(r.meanRaw ?? 0) : Number(r.meanZ)) * 100) / 100;

/**
 * Orders by the chosen column, then settles ties on evidence: the narrower
 * interval first, and failing that the larger number of ballots. Two debaters
 * with the same average are not equally well established, and ordering them
 * arbitrarily would reshuffle on every rebuild.
 */
function compare(a: SpeakerRow, b: SpeakerRow, key: SortKey, dir: Direction): number {
  const primary = value(b, key) - value(a, key);
  if (primary !== 0) return dir === 'desc' ? primary : -primary;
  // Settle on evidence, in the same direction regardless of sort order: the
  // narrower interval first, then the larger number of ballots, then the name
  // so the order never depends on how rows arrived.
  const ma = marginZ(a);
  const mb = marginZ(b);
  if (ma !== null && mb !== null && ma !== mb) return ma - mb;
  if (a.ballots !== b.ballots) return b.ballots - a.ballots;
  return displayName(a.name).localeCompare(displayName(b.name));
}

function SortHeader({
  label, notes, active, direction, onClick, num,
}: {
  label: string;
  /** Footnote numbers explaining this column, linked to the list below. */
  notes: number[];
  active: boolean;
  direction: Direction;
  onClick: () => void;
  /** Right-aligns the heading with the figures under it, as `.num` does. */
  num?: boolean;
}) {
  // Same shape as the ratings table: the footnote link sits outside the button
  // because an anchor nested inside one is invalid and would sort on click, and
  // the arrow moves out with it so the marker can sit against the word rather
  // than trailing the whole control. The arrow stays clickable for a mouse and
  // hidden from assistive technology, which has the button.
  return (
    <th className={num ? 'num' : undefined}>
      <span className="sorthead" data-active={active}>
        <button
          type="button"
          className="sort"
          data-active={active}
          onClick={onClick}
          aria-label={`Sort by ${label}, ${active && direction === 'desc' ? 'ascending' : 'descending'}`}
        >
          {label}
        </button>
        {notes.length > 0 ? <FootnoteRef notes={notes} /> : null}
        <span className="arrow" aria-hidden onClick={onClick}>
          {active && direction === 'asc' ? '▲' : '▼'}
        </span>
      </span>
    </th>
  );
}

export default function SpeakerTable({
  rows,
  season,
  initialQuery = '',
}: {
  rows: SpeakerRow[];
  season: string;
  /** `?q=` as the page was served, so a shared search arrives filtered. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>('z');
  const [direction, setDirection] = useState<Direction>('desc');
  const [page, setPage] = useState(1);

  // Positions are computed over everyone, so a search narrows the table
  // without renumbering it.
  const positions = useMemo(() => {
    const order = [...rows].sort((a, b) => compare(a, b, sort, 'desc'));
    return new Map(order.map((r, i) => [r, i + 1]));
  }, [rows, sort]);

  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (r) =>
            nameMatches(r.name, needle) ||
            (r.school ?? '').toLowerCase().includes(needle),
        )
      : rows;
    return [...filtered].sort((a, b) => compare(a, b, sort, direction));
  }, [rows, query, sort, direction]);

  const toggle = (key: SortKey): void => {
    if (key === sort) setDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSort(key); setDirection('desc'); }
  };

  // Sorting or searching puts the reader at the top of a new result set, so the
  // page resets with them rather than stranding them on page seven of a list
  // that no longer has seven pages.
  const { current, totalPages, shown: visible } = pageSlice(sorted, page);

  return (
    <>
      <TableSearch
        value={query}
        onChange={(next) => { setQuery(next); setPage(1); }}
        placeholder="Search debater or school"
        shown={sorted.length}
        total={rows.length}
      />

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>School</th>
              <th>Debater</th>
              <th className="num">Ballots</th>
              <SortHeader label="Z-score" notes={[2]} active={sort === 'z'} direction={direction} onClick={() => toggle('z')} num />
              <SortHeader label="Raw" notes={[3]} active={sort === 'raw'} direction={direction} onClick={() => toggle('raw')} num />
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => {
              const m = marginZ(s);
              return (
                <tr key={`${s.id}-${i}`}>
                  <td className="rank">{positions.get(s)}</td>
                  <td className="school" title={s.school ?? undefined}>
                    {s.school ?? '—'}
                    {s.region ? <span className="region"> · {s.region}</span> : null}
                  </td>
                  <td><DebaterLink season={season} id={s.id} name={s.name} /></td>
                  <td className="region num">{s.ballots}</td>
                  <td className="pts num">
                    {Number(s.meanZ) > 0 ? '+' : ''}{Number(s.meanZ).toFixed(2)}
                    {m === null ? null : <span className="margin"> ± {m.toFixed(2)}</span>}
                  </td>
                  <td className="num">{s.meanRaw === null ? '—' : Number(s.meanRaw).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePager page={current} totalPages={totalPages} rows={sorted.length} onPage={setPage} />
      {sorted.length === 0 ? <p className="empty">No debaters match “{query}”.</p> : null}
    </>
  );
}
