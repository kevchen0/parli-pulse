import TableSkeleton from '@/app/table-skeleton';

/**
 * Shown the moment a section link is clicked, before the server has answered.
 *
 * Without it Next holds the reader on the page they are leaving until the new
 * one is ready, so a click looks like it did nothing.
 *
 * Re-exported by a `loading.tsx` in each table segment rather than living in
 * one at `[season]/`. A `loading.tsx` opens a Suspense boundary over its whole
 * subtree, and a page that streams has already sent its status line: from one
 * at the season level a debater profile could not answer 404 for a debater who
 * does not exist, nor redirect a merged id to the canonical one with anything
 * better than a client-side hop. Pages that need to answer with a status do
 * not get a boundary above them.
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
