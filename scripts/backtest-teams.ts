/**
 * Partnership-level backtest: season points per team (XXI.7) against the
 * official `team_calc` tab.
 *
 * A partnership total is the diminishing-returns weighting of its best five
 * tournaments, so a single wrong result anywhere in a team's season moves the
 * total. Agreement is therefore reported both overall and restricted to teams
 * whose every individual result we already reproduce -- the second number says
 * whether the *aggregation* is right, the first says how far the per-entry
 * work still has to go.
 */
import { weightedTotal } from '../packages/rules/src/index.ts';
import { indexHeaders } from '../packages/ingest/src/sheet.ts';
import { computeSeason, sourceFromEnv, norm, teamKey, type EntryCase } from './lib/season.ts';

const season = computeSeason(undefined, { source: sourceFromEnv() });

interface Official {
  rank: number | null;
  school: string;
  region: string;
  d1: string;
  d2: string;
  points: number;
  top5: number[];
}

const rows = season.workbook.get('team_calc')!;
const { headerIndex, col } = indexHeaders(rows);
const c = {
  rank: col('Rank'), school: col('School'), region: col('Region'),
  d1: col('Debater 1'), d2: col('Debater 2'), points: col('Points'),
  t: [col('1st'), col('2nd'), col('3rd'), col('4th'), col('5th')],
};
const numOr = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const official = new Map<string, Official>();
for (let i = headerIndex + 1; i < rows.length; i++) {
  const r = rows[i]!;
  const school = r[c.school] ?? '';
  const d1 = r[c.d1] ?? '';
  const d2 = r[c.d2] ?? '';
  if (!school || !d1 || !d2) continue;
  official.set(teamKey(school, d1, d2), {
    rank: numOr(r[c.rank]),
    school, region: r[c.region] ?? '', d1, d2,
    points: numOr(r[c.points]) ?? 0,
    top5: c.t.map((i2) => numOr(r[i2]) ?? 0).filter((v) => v > 0),
  });
}

// Aggregate our per-entry scores into season totals.
const byTeam = new Map<string, EntryCase[]>();
for (const cs of season.cases) {
  const list = byTeam.get(cs.team) ?? [];
  list.push(cs);
  byTeam.set(cs.team, list);
}

interface Row {
  key: string;
  o: Official;
  ourPoints: number;
  theirPoints: number;
  entries: EntryCase[];
  nOurs: number;
  nTheirs: number;
  allEntriesMatched: boolean;
  countsAgree: boolean;
  delta: number;
}

const compared: Row[] = [];
const missing: Official[] = [];
for (const [key, o] of official) {
  const entries = byTeam.get(key);
  if (!entries || entries.length === 0) { missing.push(o); continue; }
  const ourPoints = weightedTotal(entries.map((e) => e.ours));
  compared.push({
    key, o, ourPoints, theirPoints: o.points, entries,
    nOurs: entries.length, nTheirs: o.top5.length,
    allEntriesMatched: entries.every((e) => e.matched),
    countsAgree: entries.length >= o.top5.length,
    delta: ourPoints - o.points,
  });
}

const near = (r: Row, tol: number): boolean => Math.abs(r.delta) <= tol;
const pct = (k: number, n: number): string => (n ? `${((100 * k) / n).toFixed(0)}%` : '  -');
const slice = (label: string, rs: Row[], tol = 0.051): void => {
  const m = rs.filter((r) => near(r, tol)).length;
  console.log(`  ${label.padEnd(32)} ${String(m).padStart(4)}/${String(rs.length).padEnd(4)} ${pct(m, rs.length).padStart(5)}`);
};

console.log('='.repeat(72));
console.log('PARTNERSHIP BACKTEST — season points per team (XXI.7) vs team_calc');
console.log('='.repeat(72));
console.log(`official partnerships: ${official.size}   compared: ${compared.length}   no Tabroom data: ${missing.length}\n`);

console.log('-- overall agreement on weighted season total --');
slice('exact', compared);
slice('within 0.5', compared, 0.5);
slice('within 2.0', compared, 2.0);

const clean = compared.filter((r) => r.allEntriesMatched && r.countsAgree);
console.log('\n-- teams whose every result we reproduce (isolates aggregation) --');
slice('exact', clean);
slice('within 0.5', clean, 0.5);

console.log('\n-- by tournaments attended (official top-5 count) --');
for (const n of [1, 2, 3, 4, 5]) {
  slice(`${n} tournament${n > 1 ? 's' : ''}`, compared.filter((r) => r.nTheirs === n));
}

console.log('\n-- by competitive tier (official rank) --');
const tiers: [string, (r: Row) => boolean][] = [
  ['top 25', (r) => (r.o.rank ?? 1e9) <= 25],
  ['26-100', (r) => (r.o.rank ?? 1e9) > 25 && (r.o.rank ?? 1e9) <= 100],
  ['101-300', (r) => (r.o.rank ?? 1e9) > 100 && (r.o.rank ?? 1e9) <= 300],
  ['301+', (r) => (r.o.rank ?? 1e9) > 300],
];
for (const [label, f] of tiers) slice(label, compared.filter(f));

console.log('\n-- by region --');
const regions = [...new Set(compared.map((r) => r.o.region))].filter(Boolean).sort();
for (const rg of regions) {
  const rs = compared.filter((r) => r.o.region === rg);
  if (rs.length >= 5) slice(rg, rs);
}

console.log('\n-- by composition --');
slice('hybrid partnerships', compared.filter((r) => r.entries.some((e) => e.hybrid)));
slice('single-school', compared.filter((r) => !r.entries.some((e) => e.hybrid)));
slice('ever broke to elims', compared.filter((r) => r.entries.some((e) => e.broke)));
slice('prelims only, all season', compared.filter((r) => !r.entries.some((e) => e.broke)));

console.log('\n-- by tournament mix (teams attending at least one) --');
slice('any NPDL-TOC', compared.filter((r) => r.entries.some((e) => /NPDL-TOC/i.test(e.tournament))));
for (const cat of ['NYPDL', 'CHSSA', 'OSAA', 'Regular']) {
  slice(`any ${cat}`, compared.filter((r) => r.entries.some((e) => e.category === cat)));
}

console.log('\n-- rank agreement (recomputed ordering vs official) --');
const ranked = [...compared].sort((a, b) => b.ourPoints - a.ourPoints);
let rankExact = 0, rank5 = 0, rank20 = 0;
ranked.forEach((r, i) => {
  const ourRank = i + 1;
  const theirs = [...compared].filter((x) => x.theirPoints > r.theirPoints).length + 1;
  const d = Math.abs(ourRank - theirs);
  if (d === 0) rankExact++;
  if (d <= 5) rank5++;
  if (d <= 20) rank20++;
});
console.log(`  ${'exact rank'.padEnd(32)} ${String(rankExact).padStart(4)}/${String(compared.length).padEnd(4)} ${pct(rankExact, compared.length).padStart(5)}`);
console.log(`  ${'within 5 places'.padEnd(32)} ${String(rank5).padStart(4)}/${String(compared.length).padEnd(4)} ${pct(rank5, compared.length).padStart(5)}`);
console.log(`  ${'within 20 places'.padEnd(32)} ${String(rank20).padStart(4)}/${String(compared.length).padEnd(4)} ${pct(rank20, compared.length).padStart(5)}`);

console.log('\n' + '='.repeat(72));
console.log('TOP 30 PARTNERSHIPS BY OFFICIAL POINTS');
console.log('='.repeat(72));
console.log(`${'#'.padStart(3)} ${'school'.padEnd(17)} ${'partnership'.padEnd(22)} ${'ours'.padStart(6)} ${'sheet'.padStart(6)} ${'Δ'.padStart(6)}  n   entries`);
const top = [...compared].sort((a, b) => b.theirPoints - a.theirPoints).slice(0, 30);
for (const r of top) {
  const flag = near(r, 0.051) ? ' ' : '*';
  console.log(
    `${String(r.o.rank ?? '?').padStart(3)} ${r.o.school.slice(0, 17).padEnd(17)} ` +
    `${`${r.o.d1} & ${r.o.d2}`.slice(0, 22).padEnd(22)} ` +
    `${r.ourPoints.toFixed(1).padStart(6)} ${r.theirPoints.toFixed(1).padStart(6)} ` +
    `${(r.delta >= 0 ? '+' : '') + r.delta.toFixed(1)}`.padStart(7) +
    `${flag} ${String(r.nOurs).padStart(2)}/${String(r.nTheirs).padEnd(2)} ` +
    `${r.entries.filter((e) => !e.matched).length} bad`,
  );
}

console.log('\n-- why teams miss --');
const badRows = compared.filter((r) => !near(r, 0.051));
const fewer = badRows.filter((r) => r.nOurs < r.nTheirs).length;
const entryBugs = badRows.filter((r) => r.nOurs >= r.nTheirs && !r.allEntriesMatched).length;
const aggBugs = badRows.filter((r) => r.nOurs >= r.nTheirs && r.allEntriesMatched).length;
console.log(`  missing tournaments for the team   ${String(fewer).padStart(4)}/${badRows.length}`);
console.log(`  a per-entry score disagrees        ${String(entryBugs).padStart(4)}/${badRows.length}`);
console.log(`  all entries agree, total does not  ${String(aggBugs).padStart(4)}/${badRows.length}`);
