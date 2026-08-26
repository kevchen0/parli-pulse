import { and, desc, eq, sql } from 'drizzle-orm';
import { MIN_RATED_ROUNDS, fieldSpread } from '@parli-pulse/rating';
import { weightedBreakdown } from '@parli-pulse/rules';
import { createDb } from '@parli-pulse/db';
import * as t from '@parli-pulse/db';
import type { SeasonId } from './season';
import { compareRounds, walkoverDirection } from './labels';

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

/**
 * A debater's display name, or null where a removal request is honoured.
 *
 * One fragment rather than the expression repeated at each call site: it was
 * already written out five times, and a suppression check that has to be
 * remembered five times is a suppression check that will be missed once. The
 * alias is the table alias the surrounding query uses; it is always a literal
 * in this file, never anything a reader supplies.
 *
 * Null rather than a placeholder string so the caller cannot render it by
 * accident -- see apps/web/lib/names.ts.
 */
const debaterName = (alias: string) =>
  sql.raw(
    `case when ${alias}.suppressed then null` +
      ` else coalesce(${alias}.first_name || ' ', '') || ${alias}.last_name end`,
  );

export interface TeamRow {
  rank: number | null;
  points: number;
  school: string | null;
  region: string | null;
  /** Null where the debater has asked not to be named. */
  debater1: string | null;
  debater2: string | null;
  debater1Id: string;
  debater2Id: string;
  tournaments: number;
  /**
   * How many of the two partners autoqualified individually (XXII.1.A).
   *
   * Two means the partnership may accept a bid under XXII.1.E. One means it
   * cannot, and would need an at-large bid. This is counted rather than
   * flagged because the difference between one and two is the whole question.
   *
   * The count is the only usable signal here: partnership points and individual
   * points are different scales -- an individual pools across every partner --
   * so comparing a partnership total to the individual threshold marks nobody.
   * On 2025-26 the highest-scoring partnership without both partners qualified
   * held 39 points against a 40-point individual line.
   */
  partnersQualified: number;
  /**
   * How this total stands against the league's published sheet.
   *
   * `pending` means the sheet has no row for this partnership yet, which during
   * a season is the normal state for a tournament the league has not written up.
   * `differs` means it has one and we disagree, which is a real problem with one
   * of the two figures and is worth a reader knowing about.
   */
  reconciliation: 'agrees' | 'differs' | 'pending';
  /** The league's figure, where it has one. */
  officialPoints: number | null;
}

export async function getTeams(season: SeasonId, limit = 5000): Promise<TeamRow[]> {
  const { db } = handle();
  const d1 = t.debaters;
  const rows = await db.execute(sql`
    select ts.rank, ts.points, ts.tournaments_counted as tournaments,
           ts.debater1_id as "debater1Id", ts.debater2_id as "debater2Id",
           coalesce(s.short_name, s.name) as school, s.region,
           ${debaterName('a')} as debater1,
           ${debaterName('b')} as debater2,
           (coalesce(qa.auto_qualified, false)::int
            + coalesce(qb.auto_qualified, false)::int) as "partnersQualified",
           sd.official_points as "officialPoints",
           case
             when sd.id is null then 'pending'
             when abs(coalesce(sd.delta, 0)) > 0.05 then 'differs'
             else 'agrees'
           end as reconciliation
    from ${t.teamSeasonTotals} ts
    join ${d1} a on a.id = ts.debater1_id
    join ${t.debaters} b on b.id = ts.debater2_id
    left join ${t.debaterSeasonTotals} qa
      on qa.season_id = ts.season_id and qa.debater_id = ts.debater1_id
    left join ${t.debaterSeasonTotals} qb
      on qb.season_id = ts.season_id and qb.debater_id = ts.debater2_id
    left join ${t.schools} s on s.id = ts.school_id
    -- The link is stored by build-diagnostics rather than re-derived here;
    -- matching partnerships on surnames is how two real Menlo teams eighty
    -- points apart became one.
    left join ${t.standingDiagnostics} sd
      on sd.team_id = ts.id and sd.season_id = ts.season_id
    where ts.season_id = ${season}
    order by ts.rank asc
    limit ${limit}
  `);
  return rows.rows as unknown as TeamRow[];
}

export interface DebaterRow {
  /** Canonical debater id, for the link to their page. */
  id: string;
  rank: number | null;
  points: number;
  /** Null where the debater has asked not to be named. */
  name: string | null;
  school: string | null;
  region: string | null;
  autoQualified: boolean;
  /**
   * Whether the results behind this total are settled against the sheet.
   *
   * Derived, not compared: the league publishes nothing per debater that we
   * mirror, so this reports exposure to unsettled partnerships rather than a
   * measured difference in the debater's own figure.
   *
   * It is thresholded on size for a reason. Flagging every total with any
   * unsettled partnership behind it marked 42 of 47 schools -- true, and so
   * nearly universal that it carried no information. Exposure of at least one
   * per cent of the total marks 14, which is a signal.
   */
  reconciliation: 'agrees' | 'differs' | 'pending';
  /** Points of disagreement behind this total, summed across partnerships. */
  exposure: number;
}

export async function getDebaters(season: SeasonId, limit = 5000): Promise<DebaterRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    -- How each partnership stands against the sheet, so a debater or school
    -- total can say whether the results behind it are settled.
    with team_state as (
      select ts.id, ts.debater1_id, ts.debater2_id, ts.school_id,
             case
               when sd.id is null then 'pending'
               when abs(coalesce(sd.delta, 0)) > 0.05 then 'differs'
               else 'agrees'
             end as state,
             abs(coalesce(sd.delta, 0)) as gap
      from ${t.teamSeasonTotals} ts
      left join ${t.standingDiagnostics} sd
        on sd.team_id = ts.id and sd.season_id = ts.season_id
      where ts.season_id = ${season}
    ),
    per_debater as (
      select debater_id,
             sum(gap) as exposure,
             bool_or(state = 'differs') as any_differs,
             bool_or(state = 'pending') as any_pending
      from (
        select debater1_id as debater_id, state, gap from team_state
        union all
        select debater2_id as debater_id, state, gap from team_state
      ) x group by debater_id
    )
    select ds.debater_id as id,
           ds.rank, ds.points, ds.auto_qualified as "autoQualified",
           coalesce(pd.exposure, 0) as exposure,
           case
             when pd.any_differs and coalesce(pd.exposure, 0) >= 0.01 * ds.points
               then 'differs'
             when pd.any_pending then 'pending'
             else 'agrees'
           end as reconciliation,
           ${debaterName('d')} as name,
           coalesce(s.short_name, s.name) as school, s.region
    from ${t.debaterSeasonTotals} ds
    join ${t.debaters} d on d.id = ds.debater_id
    left join ${t.schools} s on s.id = d.school_id
    left join per_debater pd on pd.debater_id = ds.debater_id
    where ds.season_id = ${season}
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
  /** As on debaters: exposure to unsettled partnerships, not a measured gap. */
  reconciliation: 'agrees' | 'differs' | 'pending';
  exposure: number;
}

export async function getSchools(season: SeasonId): Promise<SchoolRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    with team_state as (
      select ts.school_id,
             case
               when sd.id is null then 'pending'
               when abs(coalesce(sd.delta, 0)) > 0.05 then 'differs'
               else 'agrees'
             end as state,
             abs(coalesce(sd.delta, 0)) as gap
      from ${t.teamSeasonTotals} ts
      left join ${t.standingDiagnostics} sd
        on sd.team_id = ts.id and sd.season_id = ts.season_id
      where ts.season_id = ${season}
    ),
    per_school as (
      select school_id, sum(gap) as exposure,
             bool_or(state = 'differs') as any_differs,
             bool_or(state = 'pending') as any_pending
      from team_state where school_id is not null group by school_id
    )
    select ss.rank, ss.points, coalesce(s.short_name, s.name) as name, s.region,
           coalesce(ps.exposure, 0) as exposure,
           case
             when ps.any_differs and coalesce(ps.exposure, 0) >= 0.01 * ss.points
               then 'differs'
             when ps.any_pending then 'pending'
             else 'agrees'
           end as reconciliation
    from ${t.schoolSeasonTotals} ss
    join ${t.schools} s on s.id = ss.school_id
    left join per_school ps on ps.school_id = ss.school_id
    where ss.season_id = ${season}
    order by ss.rank asc
  `);
  return rows.rows as unknown as SchoolRow[];
}

export interface SpeakerRow {
  /** Canonical debater id, for the link to their page. */
  id: string;
  rank: number | null;
  /** Null where the debater has asked not to be named. */
  name: string | null;
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

export async function getSpeakers(season: SeasonId, limit = 5000): Promise<SpeakerRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select st.debater_id as id,
           st.rank, st.ballots, st.mean_z as "meanZ", st.mean_display as "meanDisplay",
           st.margin_display as "marginDisplay", st.mean_raw as "meanRaw",
           st.sd_z as "sdZ",
           ${debaterName('d')} as name,
           coalesce(s.short_name, s.name) as school, s.region
    from ${t.debaterSpeakerTotals} st
    join ${t.debaters} d on d.id = st.debater_id
    left join ${t.schools} s on s.id = d.school_id
    where st.season_id = ${season} and st.rank is not null
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

export async function getSpeakerSummary(season: SeasonId): Promise<SpeakerSummary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select (select count(*)::int from ${t.debaterSpeakerTotals}
            where season_id = ${season} and rank is not null) as ranked,
           (select count(*)::int from ${t.debaterSpeakerTotals}
            where season_id = ${season}) as total,
           (select coalesce(sum(ballots), 0)::int from ${t.debaterSpeakerTotals}
            where season_id = ${season} and rank is not null) as "rankedBallots",
           -- How many different judges a ranked figure rests on, measured
           -- rather than asserted: the footnote quotes this.
           (select round(avg(j))::int from (
              select count(distinct s.judge_id) as j
              from ${t.debaterSpeakerTotals} st
              join ${t.debaters} d on coalesce(d.canonical_id, d.id) = st.debater_id
              join ${t.speakerScores} s on s.debater_id = d.id and s.z is not null
              where st.season_id = ${season} and st.rank is not null
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
export async function getDiagnostics(season: SeasonId, limit = 200): Promise<DiagnosticRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select school_name as "schoolName", region, debater1, debater2,
           official_rank as "officialRank", official_points as "officialPoints",
           our_points as "ourPoints", delta,
           mismatched_results as "mismatchedResults", results
    from ${t.standingDiagnostics}
    where season_id = ${season}
      and (our_points is null or abs(delta) >= 0.051)
    order by our_points is null desc, abs(delta) desc nulls first
    limit ${limit}
  `);
  return rows.rows as unknown as DiagnosticRow[];
}

export async function getDiagnosticSummary(season: SeasonId): Promise<DiagnosticSummary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select count(*)::int as total,
           count(*) filter (where delta is not null and abs(delta) < 0.051)::int as exact,
           count(*) filter (where delta is not null and abs(delta) >= 0.051)::int as differ,
           count(*) filter (where our_points is null)::int as missing
    from ${t.standingDiagnostics} where season_id = ${season}
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
export async function getTournamentDiagnostics(season: SeasonId): Promise<TournamentDiagnostic[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select r->>'tournament' as tournament,
           count(*)::int as differing,
           sum(abs(coalesce((r->>'delta')::real, (r->>'official')::real, 0)))::real as points
    from ${t.standingDiagnostics} d, jsonb_array_elements(d.results) r
    where d.season_id = ${season}
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

export async function getSummary(season: SeasonId): Promise<Summary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select
      (select count(*) from ${t.tournaments} where season_id = ${season}) as tournaments,
      (select count(*) from ${t.teamSeasonTotals} where season_id = ${season}) as teams,
      (select count(*) from ${t.debaterSeasonTotals} where season_id = ${season}) as debaters,
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
  /** Null where the debater has asked not to be named. */
  debater1: string | null;
  debater2: string | null;
  school: string | null;
  region: string | null;
  rating: number;
  deviation: number;
  /**
   * The rating pulled toward the field by its deviation, which is what the
   * board is ordered on. See /rankings/ratings/method.
   */
  shrunk: number;
  rounds: number;
  /** The partnership's Article XXI rank, for contrast. Null if unranked. */
  pointsRank: number | null;
  points: number | null;
}

/**
 * Partnership ratings, gated on the minimum round count.
 *
 * Ordered on the shrunk figure rather than the rating itself, which is what the
 * table shows first: a partnership rises by being confirmed as well as by
 * winning. Both figures are stored and both are displayed.
 */
export async function getRatings(season: SeasonId, limit = 5000): Promise<RatingRow[]> {
  const { db } = handle();
  const rows = await db.execute(sql`
    select r.subject_id as "subjectId", r.rating, r.deviation,
           r.shrunk_rating as shrunk, r.rounds_counted as rounds,
           ${debaterName('a')} as debater1,
           ${debaterName('b')} as debater2,
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
    where r.season_id = ${season}
      and r.subject_kind = 'partnership'
      and r.tournament_id is null
      and r.rounds_counted >= ${MIN_RATED_ROUNDS}
    order by r.shrunk_rating desc nulls last
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

export async function getRatingSummary(season: SeasonId): Promise<RatingSummary> {
  const { db } = handle();
  const r = await db.execute(sql`
    select (select count(*)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is null
              and rounds_counted >= ${MIN_RATED_ROUNDS}) as ranked,
           (select count(*)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is null) as total,
           -- Rounds, not rows: a round is counted by both partnerships in it.
           (select (coalesce(sum(rounds_counted), 0) / 2)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is null
              and rounds_counted >= ${MIN_RATED_ROUNDS}) as "rankedRounds",
           (select count(distinct tournament_id)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is not null) as periods
  `);
  const row = r.rows[0] as Record<string, unknown>;
  return {
    ranked: Number(row.ranked ?? 0),
    total: Number(row.total ?? 0),
    rankedRounds: Number(row.rankedRounds ?? 0),
    periods: Number(row.periods ?? 0),
  };
}

/**
 * Parameters the methodology page states.
 *
 * Read from the season being displayed rather than written into the prose, so a
 * page describing how the number is produced cannot drift from the number.
 */
export interface RatingMethodFigures {
  /** Field spread, by method of moments over the ranked partnerships. */
  tau: number;
  measured: number;
  oppWinPct: number;
  /** Proposition advantage in rating points. Negative when opposition wins more. */
  sideAdvantage: number;
  rounds: number;
  periods: number;
  partnerships: number;
}

export async function getRatingMethodFigures(season: SeasonId): Promise<RatingMethodFigures> {
  const { db } = handle();
  const ranked = (await db.execute(sql`
    select rating, deviation from ${t.ratings}
    where season_id = ${season} and subject_kind = 'partnership'
      and tournament_id is null and rounds_counted >= ${MIN_RATED_ROUNDS}
  `)).rows as unknown as { rating: number; deviation: number }[];

  const tau = fieldSpread(
    ranked.map((r) => ({ rating: Number(r.rating), deviation: Number(r.deviation) })),
  );

  const counts = (await db.execute(sql`
    select (select count(*)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is null) as partnerships,
           (select count(distinct tournament_id)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is not null) as periods,
           (select (coalesce(sum(rounds_counted), 0) / 2)::int from ${t.ratings}
            where season_id = ${season} and tournament_id is null) as rounds
  `)).rows[0] as { partnerships: number; periods: number; rounds: number };

  // Decided open rounds, resolved on a majority of the ballots on one side.
  const sides = (await db.execute(sql`
    select count(*) filter (where side = 2)::int as opp, count(*)::int as total
    from (
      select b.section_id, min(b.side) as side,
             count(*) filter (where b.won) as w,
             count(*) filter (where b.won is not null) as d
      from ${t.ballots} b
      join ${t.rounds} rd on rd.id = b.round_id
      join ${t.events} e on e.id = rd.event_id
      join ${t.tournaments} tn on tn.id = e.tournament_id
      where tn.season_id = ${season} and e.division = 'open' and b.is_bye = false
      group by b.section_id, b.entry_id
    ) as s
    where s.d > 0 and s.w * 2 > s.d
  `)).rows[0] as { opp: number; total: number };

  const oppWinPct = sides.total ? (100 * sides.opp) / sides.total : 0;
  const p = 1 - oppWinPct / 100;
  const sideAdvantage = p > 0 && p < 1 ? 173.7178 * Math.log(p / (1 - p)) : 0;

  return {
    tau,
    measured: ranked.length,
    oppWinPct,
    sideAdvantage,
    rounds: Number(counts.rounds ?? 0),
    periods: Number(counts.periods ?? 0),
    partnerships: Number(counts.partnerships ?? 0),
  };
}

/**
 * The seasons the site can show, newest first.
 *
 * Built from what has actually been loaded rather than from a list somebody
 * maintains: a season appears in the picker when it has data, and the current
 * season appears whether or not it does, because "opened, nothing published
 * yet" is a state the site has to be able to render.
 */
export interface SeasonSummary {
  id: SeasonId;
  /** Tournaments loaded. Zero for a season that has opened but not started. */
  tournaments: number;
  /** Last day of competition loaded, or null when there is nothing yet. */
  lastResultOn: string | null;
}

export async function getSeasons(): Promise<SeasonSummary[]> {
  const { db } = handle();
  const rows = (await db.execute(sql`
    select s.id,
           count(distinct t.id)::int as tournaments,
           max(coalesce(t.ends_on, t.starts_on)) as "lastResultOn"
    from ${t.seasons} s
    left join ${t.tournaments} t on t.season_id = s.id
    group by s.id
    order by s.id desc
  `)).rows as unknown as SeasonSummary[];
  return rows.map((r) => ({
    id: r.id,
    tournaments: Number(r.tournaments ?? 0),
    lastResultOn: r.lastResultOn ?? null,
  }));
}

/**
 * When the pipeline last finished for a season, and whether that is worrying.
 *
 * The ingest runs nightly, so a gap beyond a day and a half means a run failed.
 * Nothing else on the site would show it: a failure leaves every table exactly
 * as it was, serving figures that look current.
 */
export interface Freshness {
  finishedAt: Date | null;
  tournaments: number;
  source: string | null;
  /** Hours since the last successful run, or null if there has never been one. */
  ageHours: number | null;
  /** Past the point where a nightly run should have replaced it. */
  stale: boolean;
}

/** A nightly job plus room for a slow run and a clock difference. */
const STALE_AFTER_HOURS = 36;

export async function getFreshness(season: SeasonId): Promise<Freshness> {
  const { db } = handle();
  const rows = (await db.execute(sql`
    select finished_at as "finishedAt", tournaments, source
    from ${t.ingestRuns} where season_id = ${season}
  `)).rows as unknown as { finishedAt: string; tournaments: number; source: string }[];

  const row = rows[0];
  if (!row) return { finishedAt: null, tournaments: 0, source: null, ageHours: null, stale: false };

  const finishedAt = new Date(row.finishedAt);
  const ageHours = (Date.now() - finishedAt.getTime()) / 3_600_000;
  return {
    finishedAt,
    tournaments: Number(row.tournaments ?? 0),
    source: row.source ?? null,
    ageHours,
    stale: ageHours > STALE_AFTER_HOURS,
  };
}

// ---------------------------------------------------------------------------
// Debater profiles
// ---------------------------------------------------------------------------

/** A name that may have been withheld: `null` means a removal request. */
export interface Named {
  id: string;
  name: string | null;
}

export interface ProfileRound {
  /** Tabroom's own label -- "1", "Finals", "Octafinals". */
  label: string;
  kind: string;
  elimLevel: string | null;
  isConsolation: boolean;
  /** 1 or 2 as Tabroom records it; null where it did not. */
  side: number | null;
  /**
   * Ballots won and ballots cast **on this entry's side** of the section.
   *
   * Never the section total: Tabroom writes one ballot per judge per entry, so
   * a three-judge round holds six rows and reading the sum as the panel size
   * turns every ordinary round into a tie. That is pattern A in
   * plan/10-mistakes.md, which has now been made three times in three places.
   */
  ballotsWon: number;
  ballots: number;
  /** A round advanced without debating. Not a win and not a loss. */
  bye: boolean;
  /** Null where the section holds no opposing entry -- a bye, or an unentered room. */
  opponent: { names: (string | null)[]; school: string | null; schoolId: string | null } | null;
  /**
   * A same-school elim round that nobody won: the teams did not debate.
   *
   * `advanced` is the entry that went through, `conceded` the one that stepped
   * aside, and `unknown` a round whose stage is unrecorded so the direction
   * cannot be read. Null is an ordinary round, including the 87 same-school
   * elim sections in 2025-26 that *were* decided -- two teams from one school
   * meeting is not by itself a walkover, and calling a debated 2-1 octafinal a
   * concession would be inventing something the ballots contradict.
   */
  walkover: 'advanced' | 'conceded' | 'unknown' | null;
  /** This debater's own speaker score, judge-normalized and raw. */
  speaks: number | null;
  rawSpeaks: number | null;
}

export interface ProfileTournament {
  tournamentId: string;
  name: string;
  startsOn: string | null;
  entryId: string;
  /** Null where the tournament produced no scored result for this entry. */
  points: number | null;
  /** Why the result scores nothing, where it does not. */
  excludedReason: string | null;
  /** The XXI.7.A weight this result drew: 0 for anything outside the best five. */
  weight: number;
  contribution: number;
  prelimWins: number;
  prelimLosses: number;
  elimLevel: string | null;
  wonFinal: boolean;
  school: string | null;
  schoolId: string | null;
  /** Who they debated with. Null where the entry names nobody else. */
  partner: Named | null;
  rounds: ProfileRound[];
}

export interface ProfilePartnership {
  subjectId: string;
  partner: Named | null;
  rating: number;
  deviation: number;
  shrunk: number;
  rounds: number;
  /** Whether it clears the round gate and appears on the ratings board. */
  ranked: boolean;
  /** Place on the ratings board, which is ordered on the shrunk figure. */
  ratingRank: number | null;
  /** The partnership's Article XXI season total, where the league scores one. */
  points: number | null;
}

export interface DebaterProfile {
  /** The canonical id. Other ids for the same person redirect to it. */
  id: string;
  name: string;
  school: string | null;
  region: string | null;
  points: number | null;
  rank: number | null;
  autoQualified: boolean;
  speaker: {
    rank: number | null;
    ballots: number;
    meanDisplay: number;
    marginDisplay: number | null;
    meanRaw: number | null;
  } | null;
  tournaments: ProfileTournament[];
  partnerships: ProfilePartnership[];
}

/**
 * The canonical id for a debater, or null if no such debater exists.
 *
 * A person can hold several Tabroom student ids -- a club or independent
 * registration issues a new one -- and `debaters.canonical_id` records the
 * merge. Any of them addresses the profile; the page redirects to the
 * canonical one so a shared link is stable and the same season is not indexed
 * under three URLs.
 */
export async function resolveDebaterId(id: string): Promise<string | null> {
  const { db } = handle();
  const rows = (await db.execute(sql`
    with target as (
      select coalesce(canonical_id, id) as canonical from ${t.debaters} where id = ${id}
    )
    select target.canonical,
           -- Suppression is a fact about the person, not about one of their
           -- registrations. Asking only the record that was linked would leave
           -- a page reachable through whichever id the flag was not set on.
           bool_or(d.suppressed) as suppressed
    from target
    join ${t.debaters} d on coalesce(d.canonical_id, d.id) = target.canonical
    group by target.canonical
  `)).rows as unknown as { canonical: string; suppressed: boolean }[];
  const row = rows[0];
  if (!row) return null;
  // A withheld debater has no page. Their results still count everywhere the
  // rules require -- see apps/web/lib/names.ts -- but there is no version of
  // this page that is not about the person who asked not to have one.
  if (row.suppressed) return null;
  return row.canonical;
}

/**
 * Everything a debater's page shows, for one season.
 *
 * Assembled from four queries rather than one join: a debater has tens of
 * results and hundreds of rounds, and a single query would multiply the two.
 *
 * The tournament list is deliberately built on the **same** filter `rollup`
 * applies -- scored results with no `excluded_reason`, pooled across every
 * registration the canonical id covers. The weights then come from
 * `weightedBreakdown`, which is what `weightedTotal` itself is built on. Both
 * choices are there so the figures on the page add up to the total beside
 * them: a breakdown computed a second way is pattern G from
 * plan/10-mistakes.md, and here it would be visibly wrong to any reader who
 * added up the column.
 */
export async function getDebaterProfile(
  season: SeasonId,
  canonicalId: string,
): Promise<DebaterProfile | null> {
  const { db } = handle();

  const identity = (await db.execute(sql`
    select ${debaterName('d')} as name,
           coalesce(s.short_name, s.name) as school, s.region,
           ds.points, ds.rank, coalesce(ds.auto_qualified, false) as "autoQualified",
           st.rank as "speakerRank", st.ballots, st.mean_display as "meanDisplay",
           st.margin_display as "marginDisplay", st.mean_raw as "meanRaw"
    from ${t.debaters} d
    left join ${t.schools} s on s.id = d.school_id
    left join ${t.debaterSeasonTotals} ds
      on ds.debater_id = d.id and ds.season_id = ${season}
    left join ${t.debaterSpeakerTotals} st
      on st.debater_id = d.id and st.season_id = ${season}
    where d.id = ${canonicalId}
  `)).rows as unknown as {
    name: string | null; school: string | null; region: string | null;
    points: number | null; rank: number | null; autoQualified: boolean;
    speakerRank: number | null; ballots: number | null; meanDisplay: number | null;
    marginDisplay: number | null; meanRaw: number | null;
  }[];
  const me = identity[0];
  // `name` is null only when suppressed, which resolveDebaterId already
  // refuses. Checked again rather than assumed: this is the one place a
  // withheld name could reach a page title.
  if (!me || me.name === null) return null;

  const entries = (await db.execute(sql`
    select en.id as "entryId", tr.id as "tournamentId", tr.name, tr.starts_on as "startsOn",
           er.points, er.excluded_reason as "excludedReason",
           en.prelim_wins as "prelimWins", en.prelim_losses as "prelimLosses",
           en.elim_level as "elimLevel", en.won_final as "wonFinal",
           coalesce(sc.short_name, sc.name) as school, en.school_id as "schoolId",
           p.id as "partnerId", p.name as "partnerName"
    from ${t.entryDebaters} ed
    join ${t.debaters} d on d.id = ed.debater_id
    join ${t.entries} en on en.id = ed.entry_id
    join ${t.events} ev on ev.id = en.event_id
    join ${t.tournaments} tr on tr.id = ev.tournament_id
    left join ${t.entryResults} er on er.entry_id = en.id
    left join ${t.schools} sc on sc.id = en.school_id
    -- The other person on the entry, by canonical identity so a partner who
    -- competed under two registrations is one partner.
    --
    -- The name comes from the canonical record pc, not from the registration
    -- pd that happens to sit on this entry. A record recovered from an entry
    -- label carries a surname and no first name, so reading the name off the
    -- row would print the same partner as "Lucas Miller" at fourteen
    -- tournaments and "Miller" at the fifteenth -- one link, two names, and a
    -- reader with no way to tell it is one person.
    left join lateral (
      select pc.id, ${debaterName('pc')} as name
      from ${t.entryDebaters} ped
      join ${t.debaters} pd on pd.id = ped.debater_id
      join ${t.debaters} pc on pc.id = coalesce(pd.canonical_id, pd.id)
      where ped.entry_id = en.id
        and coalesce(pd.canonical_id, pd.id) <> ${canonicalId}
      order by pc.last_name, pc.id
      limit 1
    ) p on true
    where coalesce(d.canonical_id, d.id) = ${canonicalId}
      and tr.season_id = ${season}
    -- Most recent first: a reader arrives asking how someone is doing now, and
    -- a season read top-down should open on the last thing that happened.
    order by tr.starts_on desc nulls last, tr.id desc
  `)).rows as unknown as {
    entryId: string; tournamentId: string; name: string; startsOn: string | null;
    points: number | null; excludedReason: string | null;
    prelimWins: number; prelimLosses: number; elimLevel: string | null; wonFinal: boolean;
    school: string | null; schoolId: string | null;
    partnerId: string | null; partnerName: string | null;
  }[];
  // No early return for an empty season. A debater who exists but has not
  // competed yet is not a missing page -- during a live season that is every
  // debater until the league writes up the first tournament, and answering 404
  // would tell a reader their link had rotted. The page says there is nothing
  // yet instead. The only 404s are an id nobody holds and a withheld debater,
  // both decided by `resolveDebaterId` before the response starts.

  const rounds = entries.length === 0 ? [] : (await db.execute(sql`
    select b.entry_id as "entryId", ro.name as label, ro.kind::text as kind,
           ro.elim_level::text as "elimLevel", ro.is_consolation as "isConsolation",
           max(b.side) as side,
           count(*) as ballots,
           count(*) filter (where b.won) as "ballotsWon",
           bool_or(b.is_bye) as bye,
           max(o.entry_id) as "opponentEntry",
           max(o.ballots) as "opponentBallots",
           max(o.won) as "opponentWon",
           avg(ss.display) as speaks,
           avg(ss.raw) as "rawSpeaks",
           min(ro.id) as "roundId"
    from ${t.ballots} b
    join ${t.rounds} ro on ro.id = b.round_id
    -- The other side of the section, aggregated the same way as this one. A
    -- walkover is a section *nobody* won, so the opponent's tally is needed to
    -- tell one from an ordinary loss.
    left join lateral (
      select b2.entry_id,
             count(*) as ballots,
             count(*) filter (where b2.won) as won
      from ${t.ballots} b2
      where b2.section_id = b.section_id and b2.entry_id <> b.entry_id
      group by b2.entry_id
      order by b2.entry_id
      limit 1
    ) o on true
    -- This debater's own speaks, not the entry's: the partner's scores belong
    -- on the partner's page.
    left join ${t.speakerScores} ss on ss.ballot_id = b.id
      and ss.debater_id in (
        select id from ${t.debaters} where coalesce(canonical_id, id) = ${canonicalId}
      )
      and not ss.excluded
    where b.entry_id in ${entries.map((e) => e.entryId)}
      and b.section_id is not null
    group by b.entry_id, ro.id, ro.name, ro.kind, ro.elim_level, ro.is_consolation
    order by b.entry_id, min(ro.id)
  `)).rows as unknown as {
    entryId: string; label: string; kind: string; elimLevel: string | null;
    isConsolation: boolean; side: number | null; ballots: number; ballotsWon: number;
    bye: boolean; opponentEntry: string | null;
    opponentBallots: number | null; opponentWon: number | null;
    speaks: number | null; rawSpeaks: number | null;
  }[];

  const opponentIds = [...new Set(rounds.map((r) => r.opponentEntry).filter((v): v is string => Boolean(v)))];
  const opponents = new Map<
    string,
    { names: (string | null)[]; school: string | null; schoolId: string | null }
  >();
  if (opponentIds.length > 0) {
    const rows = (await db.execute(sql`
      select en.id as "entryId", coalesce(sc.short_name, sc.name) as school,
             en.school_id as "schoolId",
             ${debaterName('dc')} as name
      from ${t.entries} en
      left join ${t.schools} sc on sc.id = en.school_id
      left join ${t.entryDebaters} ed on ed.entry_id = en.id
      left join ${t.debaters} d on d.id = ed.debater_id
      -- Named from the canonical record, as above: an opponent recovered from
      -- a label would otherwise appear under a bare surname.
      left join ${t.debaters} dc on dc.id = coalesce(d.canonical_id, d.id)
      where en.id in ${opponentIds}
      order by en.id, dc.last_name nulls last, dc.id
    `)).rows as unknown as {
      entryId: string; school: string | null; schoolId: string | null; name: string | null;
    }[];
    for (const r of rows) {
      const found =
        opponents.get(r.entryId) ?? { names: [], school: r.school, schoolId: r.schoolId };
      // A merged debater can hold two rows on one entry; the same name twice
      // would read as a four-person team.
      if (!found.names.includes(r.name) || r.name === null) found.names.push(r.name);
      opponents.set(r.entryId, found);
    }
  }

  const partnerships = (await db.execute(sql`
    -- The board's own ordering, reproduced so a partnership can be told where
    -- it sits on it. Ranked over the whole season rather than filtered first,
    -- because a rank means nothing without the field it was taken against;
    -- the gate then decides who carries one, matching /<season>/ratings.
    with board as (
      select r.subject_id, r.rating, r.deviation, r.shrunk_rating, r.rounds_counted,
             case
               when r.rounds_counted >= ${MIN_RATED_ROUNDS}
                 then rank() over (
                   order by case when r.rounds_counted >= ${MIN_RATED_ROUNDS}
                                 then r.shrunk_rating end desc nulls last
                 )
             end as rating_rank
      from ${t.ratings} r
      where r.season_id = ${season}
        and r.subject_kind = 'partnership'
        and r.tournament_id is null
    )
    select b.subject_id as "subjectId", b.rating, b.deviation,
           b.shrunk_rating as shrunk, b.rounds_counted as rounds,
           b.rating_rank as "ratingRank",
           ts.points,
           p.id as "partnerId", p.name as "partnerName"
    from board b
    left join ${t.teamSeasonTotals} ts
      on ts.season_id = ${season}
     and least(ts.debater1_id, ts.debater2_id) || '|'
      || greatest(ts.debater1_id, ts.debater2_id) = b.subject_id
    left join lateral (
      select pc.id, ${debaterName('pc')} as name from ${t.debaters} pc
      where pc.id in (split_part(b.subject_id, '|', 1), split_part(b.subject_id, '|', 2))
        and pc.id <> ${canonicalId}
      limit 1
    ) p on true
    where ${canonicalId} in (split_part(b.subject_id, '|', 1), split_part(b.subject_id, '|', 2))
    order by b.shrunk_rating desc nulls last
  `)).rows as unknown as {
    subjectId: string; rating: number; deviation: number; shrunk: number;
    rounds: number; ratingRank: number | null; points: number | null;
    partnerId: string | null; partnerName: string | null;
  }[];

  // Only the results rollup counts get a weight, and they must be presented in
  // the same order they were weighted in.
  const scored = entries.filter((e) => e.points !== null && e.excludedReason === null);
  const weights = new Map<string, { weight: number; contribution: number }>();
  weightedBreakdown(scored.map((e) => e.points as number)).forEach((w) => {
    weights.set(scored[w.index]!.entryId, { weight: w.weight, contribution: w.contribution });
  });

  const schoolOfEntry = new Map(entries.map((e) => [e.entryId, e.schoolId]));
  const reachedOfEntry = new Map(entries.map((e) => [e.entryId, e.elimLevel]));

  const roundsByEntry = new Map<string, ProfileRound[]>();
  for (const r of rounds) {
    const list = roundsByEntry.get(r.entryId) ?? [];
    const opponent = r.opponentEntry ? opponents.get(r.opponentEntry) ?? null : null;
    list.push({
      label: r.label,
      kind: r.kind,
      elimLevel: r.elimLevel,
      isConsolation: r.isConsolation,
      side: r.side === null ? null : Number(r.side),
      ballots: Number(r.ballots),
      ballotsWon: Number(r.ballotsWon),
      bye: r.bye,
      opponent,
      walkover: walkoverDirection({
        bye: r.bye,
        kind: r.kind,
        roundLevel: r.elimLevel,
        mySchool: schoolOfEntry.get(r.entryId) ?? null,
        theirSchool: opponent?.schoolId ?? null,
        myBallots: Number(r.ballots),
        myWon: Number(r.ballotsWon),
        theirBallots: r.opponentBallots === null ? 0 : Number(r.opponentBallots),
        theirWon: r.opponentWon === null ? 0 : Number(r.opponentWon),
        reached: reachedOfEntry.get(r.entryId) ?? null,
      }),
      speaks: r.speaks === null ? null : Number(r.speaks),
      rawSpeaks: r.rawSpeaks === null ? null : Number(r.rawSpeaks),
    });
    roundsByEntry.set(r.entryId, list);
  }
  // Ordered here rather than in the query: the round id is the order rounds
  // were *created*, and several tournaments built their elim brackets before
  // their prelims. See compareRounds.
  for (const list of roundsByEntry.values()) list.sort(compareRounds);

  return {
    id: canonicalId,
    name: me.name,
    school: me.school,
    region: me.region,
    points: me.points === null ? null : Number(me.points),
    rank: me.rank,
    autoQualified: me.autoQualified,
    speaker: me.ballots
      ? {
          rank: me.speakerRank,
          ballots: Number(me.ballots),
          meanDisplay: Number(me.meanDisplay),
          marginDisplay: me.marginDisplay === null ? null : Number(me.marginDisplay),
          meanRaw: me.meanRaw === null ? null : Number(me.meanRaw),
        }
      : null,
    tournaments: entries.map((e) => ({
      tournamentId: e.tournamentId,
      name: e.name,
      startsOn: e.startsOn,
      entryId: e.entryId,
      points: e.points === null ? null : Number(e.points),
      excludedReason: e.excludedReason,
      weight: weights.get(e.entryId)?.weight ?? 0,
      contribution: weights.get(e.entryId)?.contribution ?? 0,
      prelimWins: Number(e.prelimWins),
      prelimLosses: Number(e.prelimLosses),
      elimLevel: e.elimLevel,
      wonFinal: e.wonFinal,
      school: e.school,
      schoolId: e.schoolId,
      partner: e.partnerId ? { id: e.partnerId, name: e.partnerName } : null,
      rounds: roundsByEntry.get(e.entryId) ?? [],
    })),
    partnerships: partnerships.map((p) => ({
      subjectId: p.subjectId,
      partner: p.partnerId ? { id: p.partnerId, name: p.partnerName } : null,
      rating: Number(p.rating),
      deviation: Number(p.deviation),
      shrunk: Number(p.shrunk),
      rounds: Number(p.rounds),
      ranked: Number(p.rounds) >= MIN_RATED_ROUNDS,
      ratingRank: p.ratingRank === null ? null : Number(p.ratingRank),
      points: p.points === null ? null : Number(p.points),
    })),
  };
}
