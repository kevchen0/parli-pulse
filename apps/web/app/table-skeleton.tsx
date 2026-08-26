/**
 * What a table looks like while its data is on the way.
 *
 * Rows rather than a bare spinner: the page keeps its shape, so the header,
 * search box and pager do not jump when the real rows arrive. A spinner in an
 * empty space says "wait"; a skeleton says "wait, and this is what for".
 */
export default function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skelrow" aria-hidden>
          <span className="skelcell rank" />
          <span className="skelcell wide" />
          <span className="skelcell mid" />
          <span className="skelcell num" />
        </div>
      ))}
    </div>
  );
}
