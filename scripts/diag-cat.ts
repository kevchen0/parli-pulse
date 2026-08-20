import { computeSeason } from './lib/season.ts';
const cat = process.argv[2] ?? 'CHSSA';
const { cases } = computeSeason();
const rows = cases.filter((c) => c.category === cat);
const bad = rows.filter((c) => !c.matched);
console.log(`${cat}: ${rows.length - bad.length}/${rows.length} match; ${bad.length} bad\n`);
const byT = new Map<string, { bad: number; total: number }>();
for (const c of rows) {
  const e = byT.get(c.tournament) ?? { bad: 0, total: 0 };
  e.total++; if (!c.matched) e.bad++; byT.set(c.tournament, e);
}
console.log(`${'tournament'.padEnd(24)} ${'bad/total'.padStart(10)}`);
for (const [n, s] of [...byT].sort((a, b) => b[1].bad - a[1].bad)) {
  if (s.bad) console.log(`${n.padEnd(24)} ${`${s.bad}/${s.total}`.padStart(10)}`);
}
const d = new Map<number, number>();
for (const c of bad) d.set(c.ours - c.theirs, (d.get(c.ours - c.theirs) ?? 0) + 1);
console.log('\ndeltas:', [...d].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k > 0 ? '+' : ''}${k}:${v}`).join('  '));
console.log('\nsample:');
console.log(`${'tournament'.padEnd(20)} ${'ours'.padStart(5)} ${'sheet'.padStart(6)} ${'ourBase'.padStart(8)} ${'theirBase'.padStart(10)} broke`);
for (const c of bad.slice(0, 18)) {
  console.log(`${c.tournament.slice(0,20).padEnd(20)} ${String(c.ours).padStart(5)} ${String(c.theirs).padStart(6)} ${String(c.ourBase).padStart(8)} ${String(c.theirBase).padStart(10)} ${c.broke ? 'Y' : 'n'}`);
}
