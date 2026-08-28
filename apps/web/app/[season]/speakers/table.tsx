'use client';

import { useMemo, useState } from 'react';
import type { SpeakerRow } from '@/lib/db';

type SortKey = 'z' | 'raw';
type Direction = 'desc' | 'asc';

import { PAGE_SIZE, pageNumbers } from '@/app/pager';
import { displayName } from '@/lib/names';
import DebaterLink from '@/app/debater-link';

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
  label, notes, active, direction, onClick,
}: {
  label: string;
  /** Footnote numbers explaining this column, linked to the list below. */
  notes: number[];
  active: boolean;
  direction: Direction;
  onClick: () => void;
}) {
  // Same shape as the ratings table: the footnote link sits outside the button
  // because an anchor nested inside one is invalid and would sort on click, and
  // the arrow moves out with it so the marker can sit against the word rather
  // than trailing the whole control. The arrow stays clickable for a mouse and
  // hidden from assistive technology, which has the button.
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
        {notes.length > 0 ? (
          <sup className="fnref">
            {notes.map((n, i) => (
              <span key={n}>
                {i > 0 ? ' ' : ''}
                <a href={`#fn${n}`}>{n}</a>
              </span>
            ))}
          </sup>
        ) : null}
        <span className="arrow" aria-hidden onClick={onClick}>
          {active ? (direction === 'desc' ? '▼' : '▲') : '▾'}
        </span>
      </span>
    </th>
  );
}

export default function SpeakerTable({ rows, season }: { rows: SpeakerRow[]; season: string }) {
  const [query, setQuery] = useState('');
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
            displayName(r.name).toLowerCase().includes(needle) ||
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
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

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
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>School</th>
              <th>Debater</th>
              <th>Ballots</th>
              <SortHeader label="Z-score" notes={[2]} active={sort === 'z'} direction={direction} onClick={() => toggle('z')} />
              <SortHeader label="Raw" notes={[3]} active={sort === 'raw'} direction={direction} onClick={() => toggle('raw')} />
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
                  <td className="region">{s.ballots}</td>
                  <td className="pts">
                    {Number(s.meanZ) > 0 ? '+' : ''}{Number(s.meanZ).toFixed(2)}
                    {m === null ? null : <span className="margin"> ± {m.toFixed(2)}</span>}
                  </td>
                  <td>{s.meanRaw === null ? '—' : Number(s.meanRaw).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <nav className="pager" aria-label="Pages">
          <span className="pagerrange">
            {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, sorted.length)} of{' '}
            {sorted.length}
          </span>
          <span className="pagerpages">
            {current > 1 && (
              <button type="button" onClick={() => setPage(current - 1)} aria-label="Previous page">
                ‹
              </button>
            )}
            {pageNumbers(current, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="pagergap" aria-hidden>…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  data-current={p === current || undefined}
                  aria-current={p === current ? 'page' : undefined}
                >
                  {p}
                </button>
              ),
            )}
            {current < totalPages && (
              <button type="button" onClick={() => setPage(current + 1)} aria-label="Next page">
                ›
              </button>
            )}
          </span>
            {totalPages > 3 && (
              <input
                className="pagerjumpinline"
                type="number"
                min={1}
                max={totalPages}
                placeholder={String(totalPages)}
                aria-label={`Go to a page between 1 and ${totalPages}`}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= totalPages) setPage(n);
                }}
              />
            )}

        </nav>
      )}
      {sorted.length === 0 ? <p className="empty">No debaters match “{query}”.</p> : null}
    </>
  );
}
