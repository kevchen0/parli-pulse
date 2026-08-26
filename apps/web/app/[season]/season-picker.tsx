'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { SeasonId } from '@/lib/season';

/**
 * Where changing the season lands.
 *
 * A debater's page is the same page in every season, so switching seasons on
 * one should stay on that debater rather than dropping the reader on the points
 * table -- their profile exists in the new season even before it has results,
 * and says so. Every other page goes to Points, which is what this control did
 * for all of them before profiles existed.
 *
 * Only the debater route is carried across, deliberately. A path is only worth
 * preserving when it is certain to exist in the target season, and this control
 * cannot ask the server before it navigates.
 */
export function seasonDestination(pathname: string | null, season: SeasonId): string {
  const debater = pathname?.match(/^\/\d{4}-\d{2}\/debater\/([^/]+)\/?$/);
  return debater ? `/${season}/debater/${debater[1]}` : `/${season}/points`;
}

/**
 * The season, as a labelled control rather than a row of year pills.
 *
 * A season is a filter over the whole site, not a page, so it sits in the
 * header and looks like something you change rather than somewhere you go. The
 * status travels with the label: a reader who has landed on a finished season
 * should learn that from the control they are looking at, not from a sentence
 * further down.
 *
 * It is a real `<select>`. A custom dropdown here would buy nothing and cost
 * keyboard behaviour, screen-reader support and the native picker on a phone.
 */
export default function SeasonPicker({
  season,
  seasons,
  statusOf,
}: {
  season: SeasonId;
  seasons: SeasonId[];
  statusOf: Record<SeasonId, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="seasonpicker">
      <span>Season</span>
      <select
        value={season}
        onChange={(e) => router.push(seasonDestination(pathname, e.target.value) as never)}
        aria-label="Choose a season"
      >
        {seasons.map((id) => (
          <option key={id} value={id}>
            {id.replace('-', '–')} · {statusOf[id]}
          </option>
        ))}
      </select>
    </label>
  );
}
