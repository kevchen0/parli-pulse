import { readFileSync } from 'node:fs';
import { normalizeTournament } from '../packages/ingest/src/normalize.ts';

const tournId = process.argv[2]!;
const evName = process.argv[3];
const t = normalizeTournament(JSON.parse(readFileSync(`data/raw/tabroom/${tournId}.json`, 'utf8')));
const ev = t.events.find((e) => e.isParli && e.division === 'open' && (!evName || e.name === evName))!;
const prelims = ev.rounds.filter((r) => r.isPrelim);
console.log(`${t.name} / ${ev.name}: ${ev.entries.size} entries, ${prelims.length} prelims`);
console.log('rounds:', ev.rounds.map((r) => `${r.name}:${r.type}(${r.sections.length})`).join(' '));

const per = new Map<string, { scored: number; byes: number; appeared: number; rounds: string[] }>();
for (const e of ev.entries.keys()) per.set(e, { scored: 0, byes: 0, appeared: 0, rounds: [] });
for (const r of prelims) {
  const here = new Set<string>();
  for (const s of r.sections) {
    for (const b of s.ballots) {
      if (!b.entryId) continue;
      here.add(b.entryId);
      const p = per.get(b.entryId);
      if (!p) continue;
      if (b.won !== null) p.scored++;
      else if (s.isBye) p.byes++;
    }
  }
  for (const [id, p] of per) { if (here.has(id)) p.appeared++; else p.rounds.push(r.name); }
}
const rows = [...per.entries()]
  .map(([id, p]) => ({ id, ...p, missing: prelims.length - p.scored - p.byes, code: ev.entries.get(id)?.code ?? '?', dropped: ev.entries.get(id)?.dropped }))
  .filter((r) => r.missing > 0)
  .sort((a, b) => b.missing - a.missing);
console.log(`\nentries with any missing prelim (${rows.length}):`);
console.log(`${'code'.padEnd(34)} ${'scored'.padStart(6)} ${'byes'.padStart(4)} ${'absent'.padStart(6)} ${'missing'.padStart(7)} drop  absentRounds`);
for (const r of rows.slice(0, 25)) {
  console.log(`${r.code.slice(0,34).padEnd(34)} ${String(r.scored).padStart(6)} ${String(r.byes).padStart(4)} ${String(prelims.length - r.appeared).padStart(6)} ${String(r.missing).padStart(7)} ${r.dropped ? 'YES ' : '    '}  ${r.rounds.join(',')}`);
}
const hist = new Map<number, number>();
for (const r of rows) hist.set(r.missing, (hist.get(r.missing) ?? 0) + 1);
console.log('\nmissing histogram:', [...hist.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join('  '));
