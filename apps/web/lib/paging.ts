/**
 * Paging arithmetic for the ranking tables.
 *
 * In `lib` rather than beside the component because it decides what a reader
 * actually sees -- which fifty of eight hundred rows -- and every board now
 * repeats it. The same argument the vitest config makes about rules applies:
 * logic is not safer for being rendered rather than stored.
 */

/** Rows per page across every ranking table. */
export const PAGE_SIZE = 50;

/**
 * Page numbers, with the far ends always reachable.
 *
 * A run of every page number is unusable past about twenty; a bare
 * previous/next hides where you are in eight hundred rows. This keeps the first
 * and last page and one page either side of the current — seven slots at the
 * widest, `1 … 5 6 7 … 16` — so the row stays short enough to read at a glance
 * and the bottom of the table is always one click away.
 *
 * A gap standing for a single page is replaced by that page: `1 … 3 4 5` hides
 * exactly one number behind an ellipsis that is no shorter than the number
 * itself, which is the sort of detail that makes a pager feel wrong without
 * anyone being able to say why.
 */
export function pageNumbers(current: number, total: number, span = 1): (number | '…')[] {
  if (total <= 1) return [1];
  const wanted = new Set<number>([1, total]);
  for (let p = current - span; p <= current + span; p++) {
    if (p >= 1 && p <= total) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous) {
      const missing = p - previous - 1;
      if (missing === 1) out.push(previous + 1);
      else if (missing > 1) out.push('…');
    }
    out.push(p);
    previous = p;
  }
  return out;
}


/**
 * The rows one page shows, and how many pages there are.
 *
 * `page` is clamped rather than trusted. A reader who is on page 12 and then
 * searches for something with four matches has a page number that no longer
 * exists, and the honest answer is the last page there is rather than an empty
 * table.
 */
export function pageSlice<T>(
  rows: readonly T[],
  page: number,
  size = PAGE_SIZE,
): { current: number; totalPages: number; shown: T[] } {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  return {
    current,
    totalPages,
    shown: rows.slice((current - 1) * size, current * size),
  };
}
