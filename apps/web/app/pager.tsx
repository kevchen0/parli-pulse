import Link from 'next/link';

/** Rows per page across every ranking table. */
export const PAGE_SIZE = 50;

/**
 * Page numbers, with the far ends always reachable.
 *
 * A run of every page number is unusable past about twenty; a bare
 * previous/next hides where you are in eight hundred rows. This keeps the first
 * and last page, a window around the current one, and an ellipsis for the gap —
 * so a reader can always get to the bottom of the table in one click, which on
 * a rankings page is where the interesting part often is.
 */
export function pageNumbers(current: number, total: number, span = 2): (number | '…')[] {
  if (total <= 1) return [1];
  const wanted = new Set<number>([1, total]);
  for (let p = current - span; p <= current + span; p++) {
    if (p >= 1 && p <= total) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push('…');
    out.push(p);
    previous = p;
  }
  return out;
}

export const pageCount = (rows: number, size = PAGE_SIZE): number =>
  Math.max(1, Math.ceil(rows / size));

/** Clamps a `?page=` value to something that exists. */
export function clampPage(raw: string | undefined, total: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), total);
}

/**
 * The pager for a server-rendered table, as links.
 *
 * Links rather than buttons so a page can be shared, opened in a new tab and
 * found by a search engine. `basePath` is already season-qualified.
 */
export default function Pager({
  page,
  total,
  basePath,
  rows,
}: {
  page: number;
  total: number;
  basePath: string;
  rows: number;
}) {
  if (total <= 1) return null;
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`) as never;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, rows);

  return (
    <nav className="pager" aria-label="Pages">
      <span className="pagerrange">
        {first}–{last} of {rows}
      </span>
      <span className="pagerpages">
        {page > 1 && (
          <Link href={href(page - 1)} rel="prev" aria-label="Previous page">
            ‹
          </Link>
        )}
        {pageNumbers(page, total).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pagergap" aria-hidden>
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              data-current={p === page || undefined}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Link>
          ),
        )}
        {page < total && (
          <Link href={href(page + 1)} rel="next" aria-label="Next page">
            ›
          </Link>
        )}
      </span>
    </nav>
  );
}
