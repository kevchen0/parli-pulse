/**
 * Normalizes every speaker score against the judge who gave it, then rolls the
 * results up per debater.
 *
 * Raw speaker points measure the judge as much as the debater: panels differ
 * by two points or more, so a debater's total depends heavily on who they
 * drew. See packages/speaks for the method and why it uses robust statistics.
 *
 * Open divisions only, matching Article XXI.1.A. Novice, JV and middle school
 * are a different competition scored on a different curve, and mixing them
 * both distorts a judge's baseline and fills the leaderboard with debaters who
 * never entered the division being ranked. A tournament running a single
 * undifferentiated "Parli" division counts as open, which is what the division
 * classifier already does.
 */
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import {
  classifyRaw,
  judgeNormalizer,
  robustStats,
  scaleFor,
  toCanonical,
  MIN_BALLOTS as DEFAULT_MIN_BALLOTS,
} from '../packages/speaks/src/index.ts';

const SEASON = process.env.SEASON ?? '2025-26';
/** Overridable for sweeps; the default is the shared constant. */
const MIN_BALLOTS = Number(process.env.MIN_BALLOTS ?? DEFAULT_MIN_BALLOTS);

interface Row {
  id: string;
  raw: number;
  judgeId: string | null;
  debaterId: string | null;
  tournament: string;
  division: string;
}

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    // Clear what a previous run left on THIS season, so scores outside the open
    // divisions do not keep stale normalized values.
    //
    // Season-scoped, and it must be: unscoped, running this for one season set
    // `z` to null on every ballot of every other season. The totals tables are
    // season-scoped and survived, so nothing on the site looked wrong -- the
    // damage was one level down, in the per-ballot figures those totals are
    // rebuilt from.
    await db.execute(sql`
      update ${t.speakerScores} s
      set z = null, display = null, excluded = false, exclusion_reason = null
      from ${t.ballots} b
      join ${t.rounds} r on r.id = b.round_id
      join ${t.events} e on e.id = r.event_id
      join ${t.tournaments} tn on tn.id = e.tournament_id
      where s.ballot_id = b.id and tn.season_id = ${SEASON}
    `);

    const rows = (await db.execute(sql`
      select s.id, s.raw, s.judge_id as "judgeId", s.debater_id as "debaterId",
             coalesce(t.official_name, t.name) as tournament, v.division
      from ${t.speakerScores} s
      join ${t.ballots} b on b.id = s.ballot_id
      join ${t.rounds} r on r.id = b.round_id
      join ${t.events} v on v.id = r.event_id
      join ${t.tournaments} t on t.id = v.tournament_id
      where t.season_id = ${SEASON} and v.division = 'open'
    `)).rows as unknown as Row[];
    console.log(`speaker scores in open divisions: ${rows.length}`);

    // Normalize onto the canonical scale and drop what is not a score.
    interface Usable extends Row { canonical: number }
    const usable: Usable[] = [];
    const excluded: { id: string; reason: string }[] = [];
    for (const r of rows) {
      const scale = scaleFor(r.tournament);
      const verdict = classifyRaw(Number(r.raw), scale);
      if (!verdict.usable) { excluded.push({ id: r.id, reason: verdict.reason }); continue; }
      usable.push({ ...r, canonical: toCanonical(Number(r.raw), scale) });
    }
    console.log(`  usable ${usable.length}, excluded ${excluded.length}`);

    // Grouped by division for safety, though the query restricts to open: the
    // pool a judge is measured against must be the competition being ranked.
    const pools = new Map<string, number[]>();
    const judges = new Map<string, number[]>();
    for (const r of usable) {
      (pools.get(r.division) ?? pools.set(r.division, []).get(r.division)!).push(r.canonical);
      if (r.judgeId) {
        const k = `${r.judgeId}|${r.division}`;
        (judges.get(k) ?? judges.set(k, []).get(k)!).push(r.canonical);
      }
    }
    const poolStats = new Map([...pools].map(([k, v]) => [k, robustStats(v)]));
    const judgeStats = new Map([...judges].map(([k, v]) => [k, robustStats(v)]));
    for (const [division, p] of poolStats) {
      console.log(`  pool ${division.padEnd(7)} n=${String(p.n).padStart(6)} centre=${p.centre.toFixed(2)} spread=${p.spread.toFixed(2)}`);
    }

    const scored = usable.map((r) => {
      const pool = poolStats.get(r.division)!;
      const judge = r.judgeId ? judgeStats.get(`${r.judgeId}|${r.division}`) : undefined;
      const n = judgeNormalizer(judge ?? { centre: NaN, spread: NaN, n: 0 }, pool);
      return { ...r, z: n.z(r.canonical), display: n.display(r.canonical) };
    });

    // Write scores back in one statement per chunk rather than per row.
    console.log('writing normalized scores...');
    for (let i = 0; i < scored.length; i += 1000) {
      const chunk = scored.slice(i, i + 1000);
      await db.execute(sql`
        update ${t.speakerScores} as s
        set z = v.z, display = v.display, excluded = false, exclusion_reason = null
        from (select * from jsonb_to_recordset(${JSON.stringify(
          chunk.map((c) => ({ id: c.id, z: Number(c.z.toFixed(4)), display: Number(c.display.toFixed(3)) })),
        )}::jsonb) as x(id text, z real, display real)) as v
        where s.id = v.id
      `);
    }
    for (let i = 0; i < excluded.length; i += 1000) {
      const chunk = excluded.slice(i, i + 1000);
      await db.execute(sql`
        update ${t.speakerScores} as s
        set excluded = true, exclusion_reason = v.reason, z = null, display = null
        from (select * from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
              as x(id text, reason text)) as v
        where s.id = v.id
      `);
    }

    // Roll up per debater, following the canonical identity so a debater's
    // school and independent registrations count as one person.
    const canon = new Map(
      (await db.select({ id: t.debaters.id, canonicalId: t.debaters.canonicalId }).from(t.debaters))
        .map((d) => [d.id, d.canonicalId ?? d.id]),
    );
    // One z per ballot, each against the judge who gave that ballot. A
    // debater's season figure is the mean of those, so it averages across
    // every judge they faced rather than comparing them to any single one.
    const perDebater = new Map<string, number[]>();
    const perDebaterRaw = new Map<string, number[]>();
    for (const r of scored) {
      if (!r.debaterId) continue;
      const id = canon.get(r.debaterId) ?? r.debaterId;
      (perDebater.get(id) ?? perDebater.set(id, []).get(id)!).push(r.z);
      (perDebaterRaw.get(id) ?? perDebaterRaw.set(id, []).get(id)!).push(r.canonical);
    }

    const pool = poolStats.get('open') ?? [...poolStats.values()][0]!;
    const totals = [...perDebater.entries()]
      .map(([debaterId, zs]) => {
        const n = zs.length;
        const meanZ = zs.reduce((a, b) => a + b, 0) / n;
        // Sample standard deviation of this debater's own ballots, and from it
        // the standard error of their mean. Two debaters can share a season
        // average while one earned it consistently and the other from a wide
        // scatter over few rounds; the interval is what separates them.
        const variance = n > 1
          ? zs.reduce((a, b) => a + (b - meanZ) ** 2, 0) / (n - 1)
          : 0;
        const sdZ = Math.sqrt(variance);
        const stderr = n > 1 ? sdZ / Math.sqrt(n) : sdZ;
        const raws = perDebaterRaw.get(debaterId) ?? [];
        return {
          debaterId, ballots: n, meanZ, sdZ,
          meanRaw: raws.length ? raws.reduce((a, b) => a + b, 0) / raws.length : 0,
          meanDisplay: pool.centre + meanZ * pool.spread,
          // Half-width of the 95% confidence interval on the mean:
          // 1.96 * (sd / sqrt(n)), converted from z units into display points
          // by the pool's spread, so it reads straight off the adjusted score.
          marginDisplay: 1.96 * stderr * pool.spread,
        };
      })
      .sort((a, b) => b.meanZ - a.meanZ);

    let rank = 0;
    const ranked = totals.map((row) => {
      if (row.ballots < MIN_BALLOTS) return { ...row, rank: null as number | null };
      rank++;
      return { ...row, rank };
    });

    await db.delete(t.debaterSpeakerTotals).where(eq(t.debaterSpeakerTotals.seasonId, SEASON));
    const values = ranked.map((r) => ({
      id: `spk_${SEASON}_${r.debaterId}`, seasonId: SEASON, debaterId: r.debaterId,
      ballots: r.ballots, meanZ: Number(r.meanZ.toFixed(4)),
      meanDisplay: Number(r.meanDisplay.toFixed(3)),
      sdZ: Number(r.sdZ.toFixed(4)),
      marginDisplay: Number(r.marginDisplay.toFixed(3)),
      meanRaw: Number(r.meanRaw.toFixed(3)),
      rank: r.rank,
    }));
    for (let i = 0; i < values.length; i += 500) {
      await db.insert(t.debaterSpeakerTotals).values(values.slice(i, i + 500) as never).onConflictDoNothing();
    }
    console.log(`\ndebaters: ${values.length} (${ranked.filter((r) => r.rank).length} with ${MIN_BALLOTS}+ ballots)`);
  } finally {
    await close();
  }
}

await main();
