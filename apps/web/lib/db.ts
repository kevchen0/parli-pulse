import { and, desc, eq, sql } from 'drizzle-orm';
import { createDb } from '@parli-pulse/db';
import * as t from '@parli-pulse/db';
import { CURRENT_SEASON } from './season';

/**
 * One pool per server instance. Next re-evaluates modules on each request in
 * development, so the handle is cached on globalThis to avoid opening a new
 * pool every time a page renders.
 */
declare global {
  // eslint-disable-next-line no-var
  var __parliDb: ReturnType<typeof createDb> | undefined;
}

const handle = (): ReturnType<typeof createDb> => {
  globalThis.__parliDb ??= createDb();
  return globalThis.__parliDb;
};

export const dbReady = (): boolean => Boolean(process.env.DATABASE_URL);

export interface TeamRow {
  rank: number | null;
  points: number;
  school: string | null;
  region: string | null;
  debater1: string;
  debater2: string;
  tournaments: number;
}

export async function getTeams(limit = 300): Promise<TeamRow[]> {
  const { db } = handle();
  const d1 = t.debaters;
  const rows = await db.execute(sql`
    select ts.rank, ts.points, ts.tournaments_counted as tournaments,
           coalesce(s.short_name, s.name) as school, s.region,
           coalesce(a.first_name || ' ', '') || a.last_name as debater1,
           coalesce(b.first_name || ' ', '') || b.last_name as debater2
    from ${t.teamSeasonTotals} ts
    join ${d1} a on a.id = ts.debater1_id
    join ${t.debaters} b on b.id = ts.debater2_id
    left join ${t.schools} s on s.id = ts.school_id
    where ts.season_id = ${CURRENT_SEASON}
    order by ts.rank asc
    limit ${limit}
  `);
  return rows.rows as unknown as TeamRow[];
}

export interface DebaterRow {
  rank: number | null;
  points: number;
  name: string;
  school: string | null;
  region: string | null;
  autoQualified: boolean;
}

export async function getDebaters(limit = 300): Promise<DebaterRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select ds.rank, ds.points, ds.auto_qualified as "autoQualified",
           coalesce(d.first_name || ' ', '') || d.last_name as name,
           coalesce(s.short_name, s.name) as school, s.region
    from ${t.debaterSeasonTotals} ds
    join ${t.debaters} d on d.id = ds.debater_id
    left join ${t.schools} s on s.id = d.school_id
    where ds.season_id = ${CURRENT_SEASON}
    order by ds.rank asc
    limit ${limit}
  `);
  return rows.rows as unknown as DebaterRow[];
}

export interface SchoolRow {
  rank: number | null;
  points: number;
  name: string;
  region: string | null;
}

export async function getSchools(): Promise<SchoolRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select ss.rank, ss.points, coalesce(s.short_name, s.name) as name, s.region
    from ${t.schoolSeasonTotals} ss
    join ${t.schools} s on s.id = ss.school_id
    where ss.season_id = ${CURRENT_SEASON}
    order by ss.rank asc
  `);
  return rows.rows as unknown as SchoolRow[];
}

export interface Summary {
  tournaments: number;
  teams: number;
  debaters: number;
  ballots: number;
  disagreements: number;
}

export async function getSummary(): Promise<Summary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select
      (select count(*) from ${t.tournaments} where season_id = ${CURRENT_SEASON}) as tournaments,
      (select count(*) from ${t.teamSeasonTotals} where season_id = ${CURRENT_SEASON}) as teams,
      (select count(*) from ${t.debaterSeasonTotals} where season_id = ${CURRENT_SEASON}) as debaters,
      (select count(*) from ${t.ballots}) as ballots,
      (select count(*) from ${t.disagreements} where status = 'open') as disagreements
  `);
  const row = r.rows[0] as Record<string, unknown>;
  return {
    tournaments: Number(row.tournaments ?? 0),
    teams: Number(row.teams ?? 0),
    debaters: Number(row.debaters ?? 0),
    ballots: Number(row.ballots ?? 0),
    disagreements: Number(row.disagreements ?? 0),
  };
}
