/**
 * Reconciles every partnership against the league's published standings and
 * stores the result, tournament by tournament.
 *
 * A season total is the weighted best five, so a total can be wrong because of
 * a single result. This records the whole season for each partnership and
 * marks which results actually count, so a reader can tell "one tournament is
 * off by six" from "we are wrong about this team everywhere".
 */
import { existsSync, readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { DIMINISHING_RETURNS_WEIGHTS } from '../packages/rules/src/index.ts';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import {
  LEGACY_SHEET_PATH,
  indexHeaders,
  parseEntryTab,
  parseWorkbook,
  sheetPathFor,
} from '../packages/ingest/src/sheet.ts';
import { schoolKey } from '../packages/ingest/src/schools.ts';
import { computeSeason, teamKey } from './lib/season.ts';
import { loadOurTeams, pairStandings, type OfficialTeam } from './lib/standings.ts';

const SEASON = process.env.SEASON ?? '2025-26';
// The season's own workbook. Reading 2025-26's while tagging rows 2026-27
// produced 830 diagnostics for a season with no results in it.
const SHEET =
  existsSync(sheetPathFor(SEASON)) || SEASON !== '2025-26'
    ? sheetPathFor(SEASON)
    : LEGACY_SHEET_PATH;
const wb = parseWorkbook(new Uint8Array(readFileSync(SHEET)));
const num = (s?: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const tRows = wb.get('team_calc')!;
const tc = indexHeaders(tRows);
const official: (OfficialTeam & { region: string })[] = [];
for (let i = tc.headerIndex + 1; i < tRows.length; i++) {
  const r = tRows[i]!;
  const school = r[tc.col('School')] ?? '', p1 = r[tc.col('Debater 1')] ?? '', p2 = r[tc.col('Debater 2')] ?? '';
  const rank = num(r[tc.col('Rank')]), points = num(r[tc.col('Points')]);
  if (!school || !p1 || !p2 || rank === null || points === null) continue;
  official.push({
    rank, points, school, partner1: p1, partner2: p2,
    label: `${school} ${p1} & ${p2}`, region: r[tc.col('Region')] ?? '',
  });
}

// Official season, per partnership.
const officialResults = new Map<string, { tournament: string; points: number }[]>();
for (const e of parseEntryTab(wb.get('Entry')!)) {
  if (e.incorrectTeamSize) continue;
  const k = teamKey(e.school1, e.partner1, e.partner2);
  (officialResults.get(k) ?? officialResults.set(k, []).get(k)!)
    .push({ tournament: e.tournament, points: e.calcPoints ?? 0 });
}

// Ours, per partnership. Read from the database rather than recomputed, so
// the breakdown always sums to the total the site displays -- otherwise the two
// can disagree and the page contradicts itself.
const season = computeSeason();
const provenanceByEntry = new Map(season.cases.map((c) => [c.entryId, c.provenance]));

/** Indices of the results that actually count toward the weighted total. */
function countedSet(points: number[]): Set<number> {
  const order = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, DIMINISHING_RETURNS_WEIGHTS.length);
  return new Set(order.map((o) => o.i));
}

const { db, close } = createDb();
try {
  const ourTeams = await loadOurTeams(db, SEASON);

  // Every scored result, grouped by the partnership the rollup assigns it to.
  const perTeam = await db.execute(sql`
    select ts.id as "teamId", t.official_name as tournament, er.points, e.id as "entryId"
    from ${t.teamSeasonTotals} ts
    join ${t.entryDebaters} ed1 on ed1.debater_id = ts.debater1_id
    join ${t.entryDebaters} ed2 on ed2.debater_id = ts.debater2_id and ed2.entry_id = ed1.entry_id
    join ${t.entries} e on e.id = ed1.entry_id
    join ${t.entryResults} er on er.entry_id = e.id
    join ${t.events} v on v.id = e.event_id
    join ${t.tournaments} t on t.id = v.tournament_id
    where ts.season_id = ${SEASON} and er.excluded_reason is null
  `);
  const ourByTeamId = new Map<string, Map<string, { points: number; provenance: string }>>();
  for (const row of perTeam.rows as unknown as
    { teamId: string; tournament: string; points: number; entryId: string }[]) {
    const m = ourByTeamId.get(row.teamId) ?? new Map();
    m.set(row.tournament, {
      points: Number(row.points),
      provenance: provenanceByEntry.get(row.entryId) ?? 'tabroom',
    });
    ourByTeamId.set(row.teamId, m);
  }
  const paired = pairStandings(official, ourTeams);

  const rows: Record<string, unknown>[] = [];
  for (const p of paired) {
    const o = p.official as OfficialTeam & { region: string };
    const key = teamKey(o.school, o.partner1, o.partner2);
    const theirs = officialResults.get(key) ?? [];
    const mine = (p.ours ? ourByTeamId.get(p.ours.teamId) : undefined)
      ?? new Map<string, { points: number; provenance: string }>();

    const theirCounted = countedSet(theirs.map((r) => r.points));
    const tournaments = [...new Set([...theirs.map((r) => r.tournament), ...mine.keys()])];
    const results = tournaments.map((tournament) => {
      const idx = theirs.findIndex((r) => r.tournament === tournament);
      const official = idx >= 0 ? theirs[idx]!.points : null;
      const ourResult = mine.get(tournament);
      return {
        tournament,
        official,
        ours: ourResult?.points ?? null,
        delta: official !== null && ourResult ? ourResult.points - official : null,
        counted: idx >= 0 && theirCounted.has(idx),
        provenance: ourResult?.provenance ?? 'missing',
      };
    }).sort((a, b) => (b.official ?? 0) - (a.official ?? 0));

    const mismatched = results.filter((r) => r.ours === null || r.delta !== 0).length;
    rows.push({
      id: `diag_${SEASON}_${key}`.replace(/\s+/g, '_'),
      seasonId: SEASON,
      schoolName: o.school,
      region: o.region || null,
      teamId: p.ours?.teamId ?? null,
      debater1: o.partner1,
      debater2: o.partner2,
      officialRank: o.rank,
      officialPoints: o.points,
      ourPoints: p.ours?.points ?? null,
      delta: p.ours ? p.ours.points - o.points : null,
      mismatchedResults: mismatched,
      results,
    });
  }

  await db.delete(t.standingDiagnostics).where(eq(t.standingDiagnostics.seasonId, SEASON));
  for (let i = 0; i < rows.length; i += 300) {
    await db.insert(t.standingDiagnostics).values(rows.slice(i, i + 300) as never).onConflictDoNothing();
  }

  const exact = rows.filter((r) => r.delta !== null && Math.abs(r.delta as number) < 0.051).length;
  const missing = rows.filter((r) => r.ourPoints === null).length;
  console.log(`partnerships reconciled: ${rows.length}`);
  console.log(`  exact                 ${exact} (${((100 * exact) / rows.length).toFixed(1)}%)`);
  console.log(`  differ                ${rows.length - exact - missing}`);
  console.log(`  no standing at all    ${missing}`);
  const byTournament = new Map<string, { n: number; pts: number }>();
  for (const r of rows) {
    for (const res of r.results as { tournament: string; delta: number | null; ours: number | null; official: number | null }[]) {
      if (res.ours !== null && res.delta === 0) continue;
      const e = byTournament.get(res.tournament) ?? { n: 0, pts: 0 };
      e.n++;
      e.pts += Math.abs(res.delta ?? res.official ?? 0);
      byTournament.set(res.tournament, e);
    }
  }
  console.log('\ntournaments contributing most differing results:');
  for (const [name, e] of [...byTournament.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10)) {
    console.log(`  ${name.slice(0, 34).padEnd(34)} ${String(e.n).padStart(4)} results  ${e.pts.toFixed(0).padStart(5)} pts`);
  }
} finally {
  await close();
}
