'use client';

import { useRouter } from 'next/navigation';
import type { SeasonId } from '@/lib/season';

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

  return (
    <label className="seasonpicker">
      <span>Season</span>
      <select
        value={season}
        onChange={(e) => router.push(`/${e.target.value}/points` as never)}
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
