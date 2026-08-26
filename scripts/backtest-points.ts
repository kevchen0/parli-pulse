/**
 * Stage 2 backtest: per-entry Article XXI points, diffed against the official
 * sheet's `Entry` tab and sliced by tournament type, result type, and rule
 * component so a mismatch names the rule that diverged.
 */
import { weightedTotal } from '../packages/rules/src/index.ts';
import { computeSeason, sourceFromEnv, norm, pairKey, type EntryCase } from './lib/season.ts';

const { cases, unmatched, ambiguous, skippedTournaments, officialEntries } = computeSeason(undefined, { source: sourceFromEnv() });

const pct = (k: number, n: number): string => (n ? `${((100 * k) / n).toFixed(0)}%` : '  -');
const line = (label: string, rows: { matched: boolean }[]): string => {
  const m = rows.filter((r) => r.matched).length;
  return `${label.padEnd(32)} ${String(m).padStart(5)}/${String(rows.length).padEnd(5)} ${pct(m, rows.length).padStart(5)}`;
};

console.log('='.repeat(60));
console.log('STAGE 2 BACKTEST — per-entry Article XXI points');
console.log('='.repeat(60));
console.log(line('ALL', cases));

// The TOC scores under its own schedule (XXI.4.A), so it is broken out of
// "Regular" rather than diluted into it.
const isToc = (c: EntryCase): boolean => /NPDL-TOC/i.test(c.tournament);
console.log('\n-- by tournament type --');
console.log(line('NPDL-TOC (XXI.4.A)', cases.filter(isToc)));
console.log(line('NYPDL', cases.filter((c) => c.category === 'NYPDL')));
console.log(line('CHSSA (XXI.4.B/C)', cases.filter((c) => c.category === 'CHSSA')));
console.log(line('OSAA (XXI.4.C)', cases.filter((c) => c.category === 'OSAA')));
console.log(line('Regular invitationals', cases.filter((c) => c.category === 'Regular' && !isToc(c))));
for (const cat of [...new Set(cases.map((c) => c.category))].sort()) {
  if (['NYPDL', 'CHSSA', 'OSAA', 'Regular'].includes(cat)) continue;
  console.log(line(`other: ${cat}`, cases.filter((c) => c.category === cat)));
}

console.log('\n-- by result type --');
console.log(line('broke to elims', cases.filter((c) => c.broke)));
console.log(line('prelims only', cases.filter((c) => !c.broke)));

console.log('\n-- special populations --');
console.log(line('hybrid teams', cases.filter((c) => c.hybrid)));

console.log('\n-- by how the row was matched to Tabroom --');
for (const tier of ['exact-initials', 'exact-surnames', 'partial-maverick', 'fuzzy-surname'] as const) {
  console.log(line(tier, cases.filter((c) => c.matchTier === tier)));
}
console.log(line('flagged ambiguous', cases.filter((c) => c.matchAmbiguous)));

console.log('\n-- component agreement (breaking teams) --');
const br = cases.filter((c) => c.broke);
console.log(line('base points', br.map((c) => ({ matched: c.ourBase === c.theirBase }))));
console.log(line('prelim+break adjustment', br.filter((c) => c.theirAdj !== null).map((c) => ({ matched: c.ourAdj === c.theirAdj }))));

const bad = cases.filter((c) => !c.matched);
console.log(`\n-- top mismatching tournaments (${bad.length} rows) --`);
const byT = new Map<string, { bad: number; total: number }>();
for (const c of cases) {
  const e = byT.get(c.tournament) ?? { bad: 0, total: 0 };
  e.total++; if (!c.matched) e.bad++;
  byT.set(c.tournament, e);
}
for (const [name, s] of [...byT.entries()].filter(([, s]) => s.bad).sort((a, b) => b[1].bad - a[1].bad).slice(0, 12)) {
  console.log(`  ${name.slice(0, 30).padEnd(30)} ${String(s.bad).padStart(4)}/${String(s.total).padEnd(4)} bad`);
}

const buckets = new Map<number, EntryCase[]>();
for (const c of bad) {
  const d = c.ours - c.theirs;
  const list = buckets.get(d) ?? [];
  list.push(c);
  buckets.set(d, list);
}
console.log('\n-- sample rows from the largest delta buckets --');
for (const [d, rs] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4)) {
  console.log(`  delta ${d > 0 ? '+' : ''}${d} (${rs.length} rows):`);
  for (const r of rs.slice(0, 3)) {
    console.log(`     ${r.tournament.slice(0, 22).padEnd(22)} ${r.category.padEnd(8)} broke=${r.broke ? 'Y' : 'n'} ours=${String(r.ours).padStart(3)} sheet=${String(r.theirs).padStart(3)} base=${String(r.ourBase).padStart(4)}/${String(r.theirBase).padStart(4)}`);
  }
}
console.log('\ndelta histogram:', [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([d, r]) => `${d > 0 ? '+' : ''}${d}:${r.length}`).join('  '));
console.log(`\nsheet rows with no Tabroom match: ${unmatched.length}`);
console.log(`rows matched but flagged ambiguous:   ${ambiguous.length}`);
console.log(`tournaments skipped (no payload / no open event): ${skippedTournaments.length}`);

// ---------------------------------------------------------------------------
// Stage 3: aggregates over competitors whose every result we reproduced.
// ---------------------------------------------------------------------------
const perDebaterOurs = new Map<string, number[]>();
const perDebaterTheirs = new Map<string, number[]>();
const perSchoolOurs = new Map<string, number>();
const perSchoolTheirs = new Map<string, number>();
const debaterComplete = new Map<string, boolean>();
const caseIndex = new Map<string, EntryCase>();
for (const c of cases) caseIndex.set(`${c.tournament}|${c.pair}`, c);

for (const row of officialEntries) {
  if (row.incorrectTeamSize) continue;
  const c = caseIndex.get(`${row.tournament}|${pairKey(row.partner1, row.partner2)}`);
  const theirs = row.calcPoints ?? 0;
  const ours = c?.ours ?? null;
  for (const k of [`${row.school1}|${norm(row.partner1)}`, `${row.school2 || row.school1}|${norm(row.partner2)}`]) {
    (perDebaterTheirs.get(k) ?? perDebaterTheirs.set(k, []).get(k)!).push(theirs);
    if (ours !== null) (perDebaterOurs.get(k) ?? perDebaterOurs.set(k, []).get(k)!).push(ours);
    debaterComplete.set(k, (debaterComplete.get(k) ?? true) && ours !== null);
  }
  // XXI.9.C -- hybrids contribute half to each school.
  const share = row.school2 ? 0.5 : 1;
  for (const sc of row.school2 ? [row.school1, row.school2] : [row.school1]) {
    perSchoolTheirs.set(sc, (perSchoolTheirs.get(sc) ?? 0) + theirs * share);
    if (ours !== null) perSchoolOurs.set(sc, (perSchoolOurs.get(sc) ?? 0) + ours * share);
  }
}

console.log('\n' + '='.repeat(60));
console.log('STAGE 3 — aggregate totals (competitors we fully reproduced)');
console.log('='.repeat(60));
let m = 0, n = 0;
for (const [k, tv] of perDebaterTheirs) {
  if (!debaterComplete.get(k)) continue;
  const ov = perDebaterOurs.get(k);
  if (!ov || ov.length !== tv.length) continue;
  n++;
  if (Math.abs(weightedTotal(ov) - weightedTotal(tv)) < 0.051) m++;
}
console.log(`${'individual weighted (XXI.8)'.padEnd(32)} ${String(m).padStart(5)}/${String(n).padEnd(5)} ${pct(m, n).padStart(5)}`);
let sm = 0, st = 0;
for (const [k, v] of perSchoolTheirs) {
  const o = perSchoolOurs.get(k);
  if (o === undefined) continue;
  st++; if (Math.abs(o - v) < 0.51) sm++;
}
console.log(`${'school unweighted (XXI.9)'.padEnd(32)} ${String(sm).padStart(5)}/${String(st).padEnd(5)} ${pct(sm, st).padStart(5)}`);
