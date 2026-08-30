'use client';

import { PAGE_SIZE, pageNumbers } from '@/lib/paging';

/**
 * The pager for a table that pages in state.
 *
 * Was written twice, identically, inside the ratings and speakers tables. The
 * three points boards need the same thing now that they filter in the browser
 * rather than through the server, so it lives here once.
 */
export default function TablePager({
  page,
  totalPages,
  rows,
  onPage,
}: {
  page: number;
  totalPages: number;
  /** Rows the current search leaves, which is what the range counts against. */
  rows: number;
  onPage: (next: number) => void;
}) {
  if (rows <= PAGE_SIZE) return null;

  return (
    <nav className="pager" aria-label="Pages">
      <span className="pagerrange">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows)} of {rows}
      </span>
      <span className="pagerpages">
        {page > 1 && (
          <button type="button" onClick={() => onPage(page - 1)} aria-label="Previous page">
            ‹
          </button>
        )}
        {pageNumbers(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pagergap" aria-hidden>…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              data-current={p === page || undefined}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        {page < totalPages && (
          <button type="button" onClick={() => onPage(page + 1)} aria-label="Next page">
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
            if (Number.isFinite(n) && n >= 1 && n <= totalPages) onPage(n);
          }}
        />
      )}
    </nav>
  );
}
