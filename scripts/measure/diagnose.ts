/**
 * Full diagnostic: every problem class, ordered by how much damage it does.
 *
 * Prevalence is reported two ways because they disagree. A problem can touch
 * many rows while barely moving a standing, or touch few rows and distort the
 * top of the table. Both are shown: rows affected, and points at stake among
 * the teams the league ranks in its top 100.
 */
import { readFileSync } from 'node:fs';
import { createDb } from '../../packages/db/src/client.ts';
import { indexHeaders, parseWorkbook } from '../../packages/ingest/src/sheet.ts';
import { computeSeason, sourceFromEnv } from '../lib/season.ts';
import { loadOurTeams, pairStandings, type OfficialTeam } from '../lib/standings.ts';
import { teamKey } from '../lib/season.ts';

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
const officialTeams: OfficialTeam[] = [];
for (let i = tc.headerIndex + 1; i < tRows.length; i++) {
  const r = tRows[i]!;
  const school = r[tc.col('School')] ?? '', p1 = r[tc.col('Debater 1')] ?? '', p2 = r[tc.col('Debater 2')] ?? '';
  const rank = num(r[tc.col('Rank')]), points = num(r[tc.col('Points')]);
  if (!school || !p1 || !p2 || rank === null || points === null) continue;
  officialTeams.push({ rank, points, school, partner1: p1, partner2: p2, label: `${school} ${p1} & ${p2}` });
}

const { db, close } = createDb();
const ourTeams = await loadOurTeams(db, SEASON);
await close();
const season = computeSeason(undefined, { source: sourceFromEnv() });

const paired = pairStandings(officialTeams.filter((t) => t.rank <= TOP), ourTeams);
const badTeams = paired.filter((p) => p.ours === null || Math.abs(p.delta ?? 0) >= 0.051);
const badKeys = new Set(badTeams.map((p) => teamKey(p.official.school, p.official.partner1, p.official.partner2)));
const stake = new Map<string, number>();
for (const p of badTeams) {
  stake.set(teamKey(p.official.school, p.official.partner1, p.official.partner2),
    p.ours === null ? p.official.points : Math.abs(p.delta ?? 0));
}

interface Klass { title: string; rows: number; teams: Set<string>; points: number; where: Map<string, number> }
const classes = new Map<string, Klass>();
const add = (id: string, title: string, where: string, tKey: string | null): void => {
  const k = classes.get(id) ?? { title, rows: 0, teams: new Set<string>(), points: 0, where: new Map<string, number>() };
  k.rows++;
  k.where.set(where, (k.where.get(where) ?? 0) + 1);
  if (tKey && badKeys.has(tKey)) { k.teams.add(tKey); }
  classes.set(id, k);
};

for (const c of season.cases) {
  if (c.matched) continue;
  add('score', 'Result matched but scored differently', `${c.tournament} (${c.category})`, c.team);
}
for (const u of season.unmatched) add('unmatched', 'Result never matched to a Tabroom entry', u.tournament, u.team);
for (const a of season.ambiguous) add('ambiguous', 'Match ambiguous, deliberately left unscored', a.tournament, a.team);
for (const s of new Set(season.skippedTournaments)) add('nopayload', 'Tournament has no usable Tabroom payload', s, null);

// Teams whose total is wrong with no per-entry explanation.
const explained = new Set<string>([
  ...season.unmatched.map((u) => u.team),
  ...season.cases.filter((c) => !c.matched).map((c) => c.team),
]);
const unexplained: typeof badTeams = [];
for (const p of badTeams) {
  const k = teamKey(p.official.school, p.official.partner1, p.official.partner2);
  if (explained.has(k)) continue;
  unexplained.push(p);
  add(p.ours === null ? 'absent' : 'identity',
    p.ours === null ? 'Ranked team absent from our standings' : 'Total differs though every matched result agrees',
    p.official.label, k);
}

// Points at stake per class.
for (const [, k] of classes) for (const t of k.teams) k.points += stake.get(t) ?? 0;

console.log('='.repeat(80));
console.log(`DIAGNOSTIC — ${SEASON}.  ${badTeams.length} of the league's top ${TOP} teams differ.`);
console.log('='.repeat(80));
for (const [, k] of [...classes.entries()].sort((a, b) => b[1].teams.size - a[1].teams.size || b[1].rows - a[1].rows)) {
  console.log(`\n## ${k.title}`);
  console.log(`   rows ${k.rows}   top-${TOP} teams affected ${k.teams.size}   points at stake ${k.points.toFixed(1)}`);
  for (const [where, n] of [...k.where.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`     ${String(n).padStart(4)}  ${where}`);
  }
}

console.log(`\n${'='.repeat(80)}\nTOURNAMENTS BY DAMAGE TO THE TOP ${TOP}\n${'='.repeat(80)}`);
const byT = new Map<string, { rows: number; teams: Set<string>; pts: number }>();
const note = (tournament: string, tKey: string, delta: number): void => {
  const e = byT.get(tournament) ?? { rows: 0, teams: new Set<string>(), pts: 0 };
  e.rows++;
  if (badKeys.has(tKey)) { e.teams.add(tKey); e.pts += delta; }
  byT.set(tournament, e);
};
for (const c of season.cases) if (!c.matched) note(c.tournament, c.team, Math.abs(c.ours - c.theirs));
for (const u of season.unmatched) note(u.tournament, u.team, 0);
console.log(`${'tournament'.padEnd(32)} ${'bad rows'.padStart(8)} ${'top teams'.padStart(9)} ${'pts'.padStart(6)}`);
for (const [name, e] of [...byT.entries()].sort((a, b) => b[1].teams.size - a[1].teams.size || b[1].rows - a[1].rows).slice(0, 14)) {
  console.log(`${name.slice(0, 32).padEnd(32)} ${String(e.rows).padStart(8)} ${String(e.teams.size).padStart(9)} ${e.pts.toFixed(1).padStart(6)}`);
}

if (unexplained.length) {
  console.log(`\n## Unexplained totals (${unexplained.length})`);
  for (const u of unexplained.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)).slice(0, 12)) {
    console.log(`     ${u.official.label.slice(0, 42).padEnd(42)} official ${u.official.points.toFixed(1).padStart(6)}  ours ${(u.ours?.points ?? 0).toFixed(1).padStart(6)}`);
  }
}
