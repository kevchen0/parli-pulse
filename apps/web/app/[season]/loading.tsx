import TableSkeleton from '@/app/table-skeleton';

/**
 * Shown the moment a section link is clicked, before the server has answered.
 *
 * Without it Next holds the reader on the page they are leaving until the new
 * one is ready, so a click looks like it did nothing. This covers moving between
 * sections; paging and searching within one table are handled by a Suspense
 * boundary inside the page, because changing a search parameter reuses the
 * segment and never reaches here.
 */
export default function SeasonLoading() {
  return (
    <main className="wrap">
      <div className="skelhead" aria-hidden>
        <span className="skelcell title" />
        <span className="skelcell lede" />
      </div>
      <TableSkeleton />
    </main>
  );
}
