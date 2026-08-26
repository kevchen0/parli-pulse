import type { Freshness } from '@/lib/db';

/** "3 hours", "2 days" — coarse on purpose; nobody needs the minutes. */
function ago(hours: number): string {
  if (hours < 1) return 'less than an hour ago';
  if (hours < 2) return 'an hour ago';
  if (hours < 36) return `${Math.round(hours)} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * How fresh the data is, and a warning when it has stopped moving.
 *
 * The ingest runs nightly and writes its timestamp only after every step has
 * succeeded, so a gap means a run failed. Nothing else on the site would show
 * that: a failed run leaves every table exactly as it was, still looking
 * current. Quiet when things are working, loud when they are not.
 */
export default function FreshnessLine({ freshness }: { freshness: Freshness }) {
  if (freshness.ageHours === null) return null;

  if (freshness.stale) {
    return (
      <p className="freshness stale" role="status">
        <b>These figures may be out of date.</b> The last successful update was{' '}
        {ago(freshness.ageHours)}; results are normally refreshed every night.
      </p>
    );
  }

  return (
    <p className="freshness" role="status">
      Updated {ago(freshness.ageHours)}
    </p>
  );
}
