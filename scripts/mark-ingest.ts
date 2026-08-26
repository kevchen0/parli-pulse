/**
 * Records that the pipeline finished.
 *
 * Runs last, so a row appears only when every step before it succeeded. A run
 * that dies half way leaves the previous timestamp untouched, and the site can
 * tell that its data has stopped moving rather than serving stale figures that
 * look current.
 *
 * The alternative was to infer freshness from an existing timestamp -- the most
 * recent `ratings.computed_at`, say -- but a season with no results writes no
 * ratings at all, so the one state where staleness matters most would have had
 * nothing to read.
 */
import { sql } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';

const SEASON = process.env.SEASON ?? '2025-26';
/** `github` when the scheduled workflow ran it, `local` from a laptop. */
const SOURCE = process.env.GITHUB_ACTIONS === 'true' ? 'github' : 'local';

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    const { rows } = await db.execute(sql`
      select count(*)::int as n from tournaments where season_id = ${SEASON}
    `);
    const tournaments = Number((rows[0] as { n: number } | undefined)?.n ?? 0);

    await db.execute(sql`
      insert into ingest_runs (season_id, finished_at, tournaments, source)
      values (${SEASON}, now(), ${tournaments}, ${SOURCE})
      on conflict (season_id) do update
        set finished_at = excluded.finished_at,
            tournaments = excluded.tournaments,
            source = excluded.source
    `);
    console.log(`ingest recorded for ${SEASON}: ${tournaments} tournaments, from ${SOURCE}`);
  } finally {
    await close();
  }
}

await main();
