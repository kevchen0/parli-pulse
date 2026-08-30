'use client';

import { useMemo, useState } from 'react';
import type { RatingRow } from '@/lib/db';

type SortKey = 'shown' | 'rating' | 'rounds';
type Direction = 'desc' | 'asc';

import { pageSlice } from '@/lib/paging';
import TableSearch from '@/app/table-search';
import TablePager from '@/app/table-pager';
import { displayName, nameMatches } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import FootnoteRef from '@/app/footnote-ref';

/**
 * The rating a partnership has established, as opposed to the one it might
 * have: the rating pulled toward the field in proportion to its deviation.
 *
 * This is what the table sorts on by default. A partnership that has won a
 * great deal over twelve rounds and one that has won as much over ninety are
 * not making the same claim, and ordering on the rating alone puts the twelve
 * first -- which reports how little is known, not who is better. Computed by
 * `npm run rate` and stored, so the site and the pipeline cannot disagree about
 * the order; the method is at /method#rating.
 */
const shown = (r: RatingRow): number => Number(r.shrunk ?? r.rating);

const value = (r: RatingRow, key: SortKey): number =>
  key === 'rating' ? Number(r.rating) : key === 'rounds' ? r.rounds : shown(r);

/**
 * Orders by the chosen column, then settles ties on evidence, in the same
 * direction whichever way the column is sorted: the narrower deviation first,
 * then the greater number of rounds, then the name, so the order never depends
 * on how rows happened to arrive.
 */
function compare(a: RatingRow, b: RatingRow, key: SortKey, dir: Direction): number {
  const primary = Math.round(value(b, key)) - Math.round(value(a, key));
  if (primary !== 0) return dir === 'desc' ? primary : -primary;
  if (a.deviation !== b.deviation) return Number(a.deviation) - Number(b.deviation);
  if (a.rounds !== b.rounds) return b.rounds - a.rounds;
  return displayName(a.debater1).localeCompare(displayName(b.debater1));
}

function SortHeader({
  label, notes, active, direction, onClick,
}: {
  label: string;
  notes: number[];
  active: boolean;
  direction: Direction;
  onClick: () => void;
}) {
  // The footnote link sits outside the button, because an anchor nested inside
  // one is invalid and a click on the reference would also sort the table. The
  // arrow moves out with it so the marker can sit against the word it belongs
  // to rather than trailing the whole control; it stays clickable for a mouse
  // and is hidden from assistive technology, which has the button.
  return (
    <th>
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
          {active ? (direction === 'desc' ? '▼' : '▲') : '▾'}
        </span>
      </span>
    </th>
  );
}

export default function RatingTable({
  rows,
  season,
  initialQuery = '',
}: {
  rows: RatingRow[];
  season: string;
  /** `?q=` as the page was served, so a shared search arrives filtered. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>('shown');
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
            nameMatches(r.debater1, needle) ||
            nameMatches(r.debater2, needle) ||
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
              <th>Partnership</th>
              <SortHeader label="Rounds" notes={[]} active={sort === 'rounds'} direction={direction} onClick={() => toggle('rounds')} />
              <SortHeader label="Established" notes={[2]} active={sort === 'shown'} direction={direction} onClick={() => toggle('shown')} />
              <SortHeader label="Rating" notes={[3]} active={sort === 'rating'} direction={direction} onClick={() => toggle('rating')} />
              <th>
                <span className="sorthead">
                  XXI rank
                  <FootnoteRef notes={[4]} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.subjectId}>
                <td className="rank">{positions.get(r)}</td>
                <td className="school" title={r.school ?? undefined}>
                  {r.school ?? '—'}
                  {r.region ? <span className="region"> · {r.region}</span> : null}
                </td>
                <td>
                  <DebaterLink season={season} id={r.subjectId.split('|')[0]!} name={r.debater1} />
                  {' & '}
                  <DebaterLink season={season} id={r.subjectId.split('|')[1]!} name={r.debater2} />
                </td>
                <td className="region">{r.rounds}</td>
                <td className="pts">{Math.round(shown(r))}</td>
                <td>
                  {Math.round(Number(r.rating))}
                  <span className="margin"> ± {Math.round(Number(r.deviation))}</span>
                </td>
                <td className="region">{r.pointsRank ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager page={current} totalPages={totalPages} rows={sorted.length} onPage={setPage} />
      {sorted.length === 0 ? <p className="empty">No partnerships match “{query}”.</p> : null}
    </>
  );
}
