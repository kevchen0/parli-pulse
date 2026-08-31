/**
 * Per-team audit of the top of the table: for every ranked team whose total
 * disagrees, list their season result by result, official beside ours, so each
 * gap is attributable to a specific tournament rather than to a class.
 */
import { readFileSync } from 'node:fs';
import { createDb } from '../../packages/db/src/client.ts';
import { indexHeaders, parseEntryTab, parseWorkbook } from '../../packages/ingest/src/sheet.ts';
import { schoolKey } from '../../packages/ingest/src/schools.ts';
import { computeSeason, sourceFromEnv, pairKey, teamKey } from '../lib/season.ts';
import { loadOurTeams, pairStandings, type OfficialTeam } from '../lib/standings.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const TOP = Number(process.env.TOP ?? 100);
const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const num = (s?: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const tRows = wb.get('team_calc')!;
const tc = indexHeaders(tRows);
const official: OfficialTeam[] = [];
for (let i = tc.headerIndex + 1; i < tRows.length; i++) {
  const r = tRows[i]!;
  const school = r[tc.col('School')] ?? '', p1 = r[tc.col('Debater 1')] ?? '', p2 = r[tc.col('Debater 2')] ?? '';
  const rank = num(r[tc.col('Rank')]), points = num(r[tc.col('Points')]);
  if (school && p1 && p2 && rank !== null && points !== null) {
    official.push({ rank, points, school, partner1: p1, partner2: p2, label: `${school} ${p1} & ${p2}` });
  }
}

const entries = parseEntryTab(wb.get('Entry')!);
const officialResults = new Map<string, { tournament: string; result: string; points: number }[]>();
for (const e of entries) {
  const k = teamKey(e.school1, e.partner1, e.partner2);
  (officialResults.get(k) ?? officialResults.set(k, []).get(k)!)
    .push({ tournament: e.tournament, result: e.result, points: e.calcPoints ?? 0 });
}

const season = computeSeason(undefined, { source: sourceFromEnv() });
const ourByTeam = new Map<string, Map<string, number>>();
for (const c of season.cases) {
  const m = ourByTeam.get(c.team) ?? new Map<string, number>();
  m.set(c.tournament, c.ours);
  ourByTeam.set(c.team, m);
}
const unmatchedByTeam = new Map<string, Set<string>>();
for (const u of season.unmatched) {
  (unmatchedByTeam.get(u.team) ?? unmatchedByTeam.set(u.team, new Set()).get(u.team)!).add(u.tournament);
}
const skipped = new Set(season.skippedTournaments);

const { db, close } = createDb();
const ours = await loadOurTeams(db, SEASON);
await close();

const paired = pairStandings(official.filter((t) => t.rank <= TOP), ours);
const bad = paired.filter((p) => p.ours === null || Math.abs(p.delta ?? 0) >= 0.051)
  .sort((a, b) => Math.abs(b.delta ?? b.official.points) - Math.abs(a.delta ?? a.official.points));

const reasons = new Map<string, number>();
console.log(`${bad.length} of the top ${TOP} disagree\n`);
for (const p of bad) {
  const k = teamKey(p.official.school, p.official.partner1, p.official.partner2);
  const results = officialResults.get(k) ?? [];
  const mine = ourByTeam.get(k) ?? new Map<string, number>();
  const missing = unmatchedByTeam.get(k) ?? new Set<string>();
  console.log(`${p.official.label.slice(0, 44).padEnd(44)} official ${p.official.points.toFixed(1).padStart(6)}  ours ${(p.ours?.points ?? 0).toFixed(1).padStart(6)}`);
  for (const r of results.sort((a, b) => b.points - a.points)) {
    const got = mine.get(r.tournament);
    let note = '';
    if (got === undefined) {
      note = missing.has(r.tournament) ? 'NOT MATCHED'
        : skipped.has(r.tournament) ? 'NO PAYLOAD' : 'ABSENT';
    } else if (got !== r.points) note = `SCORED ${got}`;
    if (note) reasons.set(note.split(' ')[0]! === 'SCORED' ? 'scored differently' : note.toLowerCase(),
      (reasons.get(note.split(' ')[0]! === 'SCORED' ? 'scored differently' : note.toLowerCase()) ?? 0) + 1);
    console.log(`     ${r.tournament.slice(0, 30).padEnd(30)} ${r.result.padStart(7)} ${String(r.points).padStart(4)}   ${note}`);
  }
  console.log('');
}
console.log('--- causes across all listed results ---');
for (const [k, v] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
