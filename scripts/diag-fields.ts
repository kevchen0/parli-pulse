import { readFileSync, existsSync } from 'node:fs';
import { computeFieldStats, normalizeTournament } from '../packages/ingest/src/normalize.ts';
import { parseTournamentsTab, parseWorkbook } from '../packages/ingest/src/sheet.ts';
const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const official = parseTournamentsTab(wb.get('Tournaments')!);
const deltas: { name: string; cat: string; raw: number; ff: number; ours: number; theirs: number; d: number; unscored: boolean }[] = [];
for (const off of official) {
  if (!off.tournId || !existsSync(`data/raw/tabroom/${off.tournId}.json`) || off.openField === null) continue;
  const t = normalizeTournament(JSON.parse(readFileSync(`data/raw/tabroom/${off.tournId}.json`, 'utf8')));
  const opens = t.events.filter((e) => e.isParli && e.division === 'open');
  if (!opens.length) continue;
  const st = opens.map(computeFieldStats);
  const ours = st.reduce((a, s) => a + s.fieldSize, 0);
  const raw = st.reduce((a, s) => a + s.rawEntries, 0);
  const ff = st.reduce((a, s) => a + s.forfeitedOut, 0);
  deltas.push({ name: off.name, cat: off.category, raw, ff, ours, theirs: off.openField, d: ours - off.openField, unscored: st.some((s) => s.unscored) });
}
const bad = deltas.filter((x) => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log(`open-field mismatches: ${bad.length}/${deltas.length}\n`);
console.log(`${'tournament'.padEnd(28)} ${'cat'.padEnd(9)} ${'raw'.padStart(4)} ${'ff'.padStart(3)} ${'ours'.padStart(5)} ${'sheet'.padStart(5)} ${'Δ'.padStart(4)}  note`);
for (const x of bad) console.log(`${x.name.slice(0,28).padEnd(28)} ${x.cat.slice(0,9).padEnd(9)} ${String(x.raw).padStart(4)} ${String(x.ff).padStart(3)} ${String(x.ours).padStart(5)} ${String(x.theirs).padStart(5)} ${String(x.d).padStart(4)}  ${x.unscored?'UNSCORED':''}`);
const hist = new Map<number, number>();
for (const x of bad) hist.set(x.d, (hist.get(x.d) ?? 0) + 1);
console.log('\ndelta histogram:', [...hist.entries()].sort((a,b)=>a[0]-b[0]).map(([d,n])=>`${d>0?'+':''}${d}:${n}`).join('  '));
console.log('by category:', [...new Set(bad.map(b=>b.cat))].map(c=>`${c||'(none)'}:${bad.filter(b=>b.cat===c).length}/${deltas.filter(d=>d.cat===c).length}`).join('  '));
