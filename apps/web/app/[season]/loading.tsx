import TableSkeleton from '@/app/table-skeleton';

/**
 * Shown the moment a section link is clicked, before the server has answered.
 *
 * Without it Next holds the reader on the page they are leaving until the new
 * one is ready, so a click looks like it did nothing.
 *
 * Deliberately unlabelled. This one boundary covers Points, Ratings, Speakers
 * and the reconciliation, which have different columns, and naming one set
 * would tell a reader waiting for Schools that Partnership and Tourns are on
 * their way. Each table supplies its own labelled fallback alongside its data.
 *
 * No `main` element: this renders as the layout's children and the layout
 * already supplies one. Nesting a second is invalid, and the parser rearranges
 * the result badly enough that hydration cannot reconcile it.
 */
export default function SeasonLoading() {
  return (
    <>
      <div className="skelhead" aria-hidden>
        <span className="skelcell title" />
        <span className="skelcell lede" />
      </div>
      <TableSkeleton headings={false} rows={14} />
    </>
  );
}
