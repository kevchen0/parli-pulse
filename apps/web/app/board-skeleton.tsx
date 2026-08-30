import TableSkeleton, { type SkeletonColumn } from '@/app/table-skeleton';

/**
 * A board while its rows are on the way.
 *
 * The heading, the lede, the search field and the column headings are not data.
 * They are the same on every render of a given route, so this renders them for
 * real and shimmers only the figures. The reader gets the page they asked for
 * immediately and watches the numbers arrive, rather than watching a grey
 * diagram of a page rearrange itself into a different one.
 *
 * That is the fix for the shape problem. The previous fallback was shared by
 * Points, Ratings, Speakers and the reconciliation, so it could only draw four
 * unlabelled columns -- against real tables of four, five, six and seven -- and
 * omitted the search field, which pushed the whole table down when the rows
 * landed. A `loading.tsx` is per segment and knows its own route, so each one
 * now passes its own shape and nothing has to be guessed.
 */
export default function BoardSkeleton({
  title,
  lede,
  metas,
  search,
  columns,
  rows = 18,
}: {
  title: string;
  lede?: string;
  /** Widths of the bars standing in for the count line, in source order. */
  metas?: readonly string[];
  /** Placeholder of the real search field, where the board has one. */
  search?: string;
  columns: readonly SkeletonColumn[];
  rows?: number;
}) {
  return (
    <>
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {metas && metas.length > 0 ? (
        <p className="meta" aria-hidden>
          {metas.map((w, i) => (
            <span key={i} className="skelcell" style={{ width: w }} />
          ))}
        </p>
      ) : null}
      {search ? (
        <div className="controls" aria-hidden>
          {/*
            A div rather than a disabled input. It carries the field's own rules
            so the box is the same height either way, and an input nobody can
            type into is a worse thing to hand a reader than a plain shape.
          */}
          <div className="skelsearch">{search}</div>
        </div>
      ) : null}
      <TableSkeleton columns={columns} rows={rows} />
    </>
  );
}
