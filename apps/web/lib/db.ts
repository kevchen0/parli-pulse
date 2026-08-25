import { and, desc, eq, sql } from 'drizzle-orm';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
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

export async function getTeams(limit = 5000): Promise<TeamRow[]> {
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

export async function getDebaters(limit = 5000): Promise<DebaterRow[]> {
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

export interface SpeakerRow {
  rank: number | null;
  name: string;
  school: string | null;
  region: string | null;
  ballots: number;
  meanZ: number;
  meanDisplay: number;
  /** Half-width of the 95% interval, in display points. */
  marginDisplay: number | null;
  /** Mean before judge adjustment, on the canonical scale. */
  meanRaw: number | null;
  /** Spread of this debater's own ballots, in z units. */
  sdZ: number | null;
}

export async function getSpeakers(limit = 5000): Promise<SpeakerRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select st.rank, st.ballots, st.mean_z as "meanZ", st.mean_display as "meanDisplay",
           st.margin_display as "marginDisplay", st.mean_raw as "meanRaw",
           st.sd_z as "sdZ",
           coalesce(d.first_name || ' ', '') || d.last_name as name,
           coalesce(s.short_name, s.name) as school, s.region
    from ${t.debaterSpeakerTotals} st
    join ${t.debaters} d on d.id = st.debater_id
    left join ${t.schools} s on s.id = d.school_id
    where st.season_id = ${CURRENT_SEASON} and st.rank is not null
    order by st.rank asc
    limit ${limit}
  `);
  return rows.rows as unknown as SpeakerRow[];
}

export interface SpeakerSummary {
  ranked: number;
  total: number;
  /** Ballots belonging to the ranked debaters -- what the table is built on. */
  rankedBallots: number;
  /** Mean number of distinct judges behind a ranked debater's figure. */
  avgJudges: number;
  scores: number;
  excluded: number;
}

export async function getSpeakerSummary(): Promise<SpeakerSummary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select (select count(*)::int from ${t.debaterSpeakerTotals}
            where season_id = ${CURRENT_SEASON} and rank is not null) as ranked,
           (select count(*)::int from ${t.debaterSpeakerTotals}
            where season_id = ${CURRENT_SEASON}) as total,
           (select coalesce(sum(ballots), 0)::int from ${t.debaterSpeakerTotals}
            where season_id = ${CURRENT_SEASON} and rank is not null) as "rankedBallots",
           -- How many different judges a ranked figure rests on, measured
           -- rather than asserted: the footnote quotes this.
           (select round(avg(j))::int from (
              select count(distinct s.judge_id) as j
              from ${t.debaterSpeakerTotals} st
              join ${t.debaters} d on coalesce(d.canonical_id, d.id) = st.debater_id
              join ${t.speakerScores} s on s.debater_id = d.id and s.z is not null
              where st.season_id = ${CURRENT_SEASON} and st.rank is not null
              group by st.debater_id
            ) x) as "avgJudges",
           -- Only scores that were actually normalized; the table also holds
           -- novice and JV ballots, which this measure does not rate.
           (select count(*)::int from ${t.speakerScores} where z is not null) as scores,
           (select count(*)::int from ${t.speakerScores} where excluded) as excluded
  `);
  const row = r.rows[0] as Record<string, unknown>;
  return {
    ranked: Number(row.ranked ?? 0), total: Number(row.total ?? 0),
    rankedBallots: Number(row.rankedBallots ?? 0),
    avgJudges: Number(row.avgJudges ?? 0),
    scores: Number(row.scores ?? 0), excluded: Number(row.excluded ?? 0),
  };
}

export interface DiagnosticResult {
  tournament: string;
  official: number | null;
  ours: number | null;
  delta: number | null;
  /** Inside the best five that actually determine the season total. */
  counted: boolean;
  provenance: string;
}

export interface DiagnosticRow {
  schoolName: string;
  region: string | null;
  debater1: string;
  debater2: string;
  officialRank: number | null;
  officialPoints: number;
  ourPoints: number | null;
  delta: number | null;
  mismatchedResults: number;
  results: DiagnosticResult[];
}

export interface DiagnosticSummary {
  total: number;
  exact: number;
  differ: number;
  missing: number;
}

/** Partnerships whose totals disagree, worst first. */
export async function getDiagnostics(limit = 200): Promise<DiagnosticRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select school_name as "schoolName", region, debater1, debater2,
           official_rank as "officialRank", official_points as "officialPoints",
           our_points as "ourPoints", delta,
           mismatched_results as "mismatchedResults", results
    from ${t.standingDiagnostics}
    where season_id = ${CURRENT_SEASON}
      and (our_points is null or abs(delta) >= 0.051)
    order by our_points is null desc, abs(delta) desc nulls first
    limit ${limit}
  `);
  return rows.rows as unknown as DiagnosticRow[];
}

export async function getDiagnosticSummary(): Promise<DiagnosticSummary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select count(*)::int as total,
           count(*) filter (where delta is not null and abs(delta) < 0.051)::int as exact,
           count(*) filter (where delta is not null and abs(delta) >= 0.051)::int as differ,
           count(*) filter (where our_points is null)::int as missing
    from ${t.standingDiagnostics} where season_id = ${CURRENT_SEASON}
  `);
  const row = r.rows[0] as Record<string, unknown>;
  return {
    total: Number(row.total ?? 0), exact: Number(row.exact ?? 0),
    differ: Number(row.differ ?? 0), missing: Number(row.missing ?? 0),
  };
}

export interface TournamentDiagnostic {
  tournament: string;
  differing: number;
  points: number;
}

/** Tournaments ranked by how many differing results they contribute. */
export async function getTournamentDiagnostics(): Promise<TournamentDiagnostic[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select r->>'tournament' as tournament,
           count(*)::int as differing,
           sum(abs(coalesce((r->>'delta')::real, (r->>'official')::real, 0)))::real as points
    from ${t.standingDiagnostics} d, jsonb_array_elements(d.results) r
    where d.season_id = ${CURRENT_SEASON}
      and (r->>'ours' is null or (r->>'delta')::real <> 0)
    group by 1 order by 2 desc limit 20
  `);
  return rows.rows as unknown as TournamentDiagnostic[];
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

export interface RatingRow {
  subjectId: string;
  debater1: string;
  debater2: string;
  school: string | null;
  region: string | null;
  rating: number;
  deviation: number;
  rounds: number;
  /** The partnership's Article XXI rank, for contrast. Null if unranked. */
  pointsRank: number | null;
  points: number | null;
}

/**
 * Partnership ratings, gated on the minimum round count.
 *
 * Ordered on the rating less its deviation rather than the rating itself, which
 * is what the table shows first: a partnership rises by being confirmed as well
 * as by winning. Both figures are stored and both are displayed.
 */
export async function getRatings(limit = 5000): Promise<RatingRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select r.subject_id as "subjectId", r.rating, r.deviation,
           r.rounds_counted as rounds,
           coalesce(a.first_name || ' ', '') || a.last_name as debater1,
           coalesce(b.first_name || ' ', '') || b.last_name as debater2,
           coalesce(s.short_name, s.name) as school, s.region,
           ts.rank as "pointsRank", ts.points
    from ${t.ratings} r
    join ${t.debaters} a on a.id = split_part(r.subject_id, '|', 1)
    join ${t.debaters} b on b.id = split_part(r.subject_id, '|', 2)
    left join ${t.teamSeasonTotals} ts
      on ts.season_id = r.season_id
     and least(ts.debater1_id, ts.debater2_id) || '|'
      || greatest(ts.debater1_id, ts.debater2_id) = r.subject_id
    left join ${t.schools} s on s.id = coalesce(ts.school_id, a.school_id)
    where r.season_id = ${CURRENT_SEASON}
      and r.subject_kind = 'partnership'
      and r.tournament_id is null
      and r.rounds_counted >= ${MIN_RATED_ROUNDS}
    order by (r.rating - r.deviation) desc
    limit ${limit}
  `);
  return rows.rows as unknown as RatingRow[];
}

export interface RatingSummary {
  ranked: number;
  total: number;
  /** Rated rounds behind the ranked partnerships. */
  rankedRounds: number;
  /** Tournaments that formed a rating period. */
  periods: number;
}

export async function getRatingSummary(): Promise<RatingSummary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select (select count(*)::int from ${t.ratings}
            where season_id = ${CURRENT_SEASON} and tournament_id is null
              and rounds_counted >= ${MIN_RATED_ROUNDS}) as ranked,
           (select count(*)::int from ${t.ratings}
            where season_id = ${CURRENT_SEASON} and tournament_id is null) as total,
           -- Rounds, not rows: a round is counted by both partnerships in it.
           (select (coalesce(sum(rounds_counted), 0) / 2)::int from ${t.ratings}
            where season_id = ${CURRENT_SEASON} and tournament_id is null
              and rounds_counted >= ${MIN_RATED_ROUNDS}) as "rankedRounds",
           (select count(distinct tournament_id)::int from ${t.ratings}
            where season_id = ${CURRENT_SEASON} and tournament_id is not null) as periods
  `);
  const row = r.rows[0] as Record<string, unknown>;
  return {
    ranked: Number(row.ranked ?? 0),
    total: Number(row.total ?? 0),
    rankedRounds: Number(row.rankedRounds ?? 0),
    periods: Number(row.periods ?? 0),
  };
}
