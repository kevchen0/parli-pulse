/**
 * What a table looks like while its data is on the way.
 *
 * It is a real `table` inside a real `.tablewrap`, with the same headings the
 * page is about to render. That is the point: padding, font metrics, borders and
 * column widths are inherited rather than re-guessed, so the skeleton is the
 * size of the thing it stands in for and nothing moves when the rows arrive.
 *
 * Hand-sizing it did not work. A row built from a plain div came out around
 * thirty pixels against the real forty, and rows whose school or partnership
 * wraps to two lines are half as tall again — so the skeleton read as a smaller,
 * different table rather than as the one being loaded.
 */
export interface SkeletonColumn {
  label: string;
  /** Right-aligned, as the real numeric columns are. */
  num?: boolean;
  /** Width of the shimmer bar, as a share of the cell. */
  fill?: string;
}

export default function TableSkeleton({
  columns = GENERIC_COLUMNS,
  rows = 50,
  headings = true,
}: {
  columns?: readonly SkeletonColumn[];
  rows?: number;
  /**
   * Off where the fallback covers several tables and cannot know which is
   * coming. Naming the wrong columns is worse than naming none: a reader who
   * reads "Partnership" and then gets "Region" has been told something false
   * about the page they are waiting for.
   */
  headings?: boolean;
}) {
  return (
    <div className="tablewrap skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={c.num ? 'num' : undefined}>
                {headings ? c.label : <span className="skelcell" style={{ width: '3.5rem' }} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-hidden>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.label} className={c.num ? 'num' : undefined}>
                  <span className="skelcell" style={{ width: c.fill ?? '60%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Four unlabelled columns, for a fallback that does not know its table yet. */
export const GENERIC_COLUMNS: SkeletonColumn[] = [
  { label: 'a', fill: '1.4rem' },
  { label: 'b', fill: '70%' },
  { label: 'c', fill: '75%' },
  { label: 'd', num: true, fill: '2.4rem' },
];

/** The three points tables, so a fallback always matches its page. */
export const TEAM_COLUMNS: SkeletonColumn[] = [
  { label: '#', fill: '1.4rem' },
  { label: 'School', fill: '70%' },
  { label: 'Partnership', fill: '85%' },
  { label: 'Tourns', num: true, fill: '1.2rem' },
  { label: 'Points', num: true, fill: '2.4rem' },
];

export const DEBATER_COLUMNS: SkeletonColumn[] = [
  { label: '#', fill: '1.4rem' },
  { label: 'School', fill: '70%' },
  { label: 'Debater', fill: '75%' },
  { label: 'Points', num: true, fill: '2.4rem' },
];

export const SCHOOL_COLUMNS: SkeletonColumn[] = [
  { label: '#', fill: '1.4rem' },
  { label: 'School', fill: '65%' },
  { label: 'Region', fill: '2.5rem' },
  { label: 'Points', num: true, fill: '2.8rem' },
];

/*
 * Ratings and Speakers left-align their figures -- a value sits under the first
 * letter of its heading -- so neither set marks a column `num`. Copying the
 * points tables here would right-align the shimmer and put the bars somewhere
 * the real digits never appear.
 */
export const RATING_COLUMNS: SkeletonColumn[] = [
  { label: '#', fill: '1.4rem' },
  { label: 'School', fill: '70%' },
  { label: 'Partnership', fill: '85%' },
  { label: 'Rounds', fill: '1.5rem' },
  { label: 'Established', fill: '2.2rem' },
  { label: 'Rating', fill: '3.4rem' },
  { label: 'XXI rank', fill: '1.5rem' },
];

export const SPEAKER_COLUMNS: SkeletonColumn[] = [
  { label: '#', fill: '1.4rem' },
  { label: 'School', fill: '70%' },
  { label: 'Debater', fill: '75%' },
  { label: 'Ballots', fill: '1.5rem' },
  { label: 'Z-score', fill: '3.2rem' },
  { label: 'Raw', fill: '2.6rem' },
];
