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
 * A search box over the table below it.
 *
 * A plain GET form: it needs no JavaScript, the result is a URL that can be
 * shared, and the browser's own history works. `name="q"` is read back by the
 * page, so a search survives a reload and a page change.
 */
export function TableSearch({
  action,
  query,
  placeholder,
}: {
  action: string;
  query: string;
  placeholder: string;
}) {
  return (
    <form className="tablesearch" method="get" action={action} role="search">
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="submit">Search</button>
      {query ? (
        <Link href={action as never} className="clearsearch">
          Clear
        </Link>
      ) : null}
    </form>
  );
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
  query = '',
}: {
  page: number;
  total: number;
  basePath: string;
  rows: number;
  query?: string;
}) {
  if (total <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return (qs ? `${basePath}?${qs}` : basePath) as never;
  };
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
            // The gap is where a reader with eight hundred rows actually needs
            // to act, so it takes a page number rather than stating that some
            // pages are missing. A GET form, so it works without JavaScript.
            <form key={`jump-${i}`} className="pagerjump" method="get" action={basePath}>
              {query ? <input type="hidden" name="q" value={query} /> : null}
              <input
                type="number"
                name="page"
                min={1}
                max={total}
                placeholder="…"
                aria-label={`Go to a page between 1 and ${total}`}
              />
            </form>
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
