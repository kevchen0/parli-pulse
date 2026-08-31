/**
 * Which definition of "forfeited two or more prelims" (XXI.2.A) reproduces the
 * official open field? Scores several candidates against the sheet.
 */
import { existsSync, readFileSync } from 'node:fs';
import { normalizeTournament } from '../../packages/ingest/src/normalize.ts';
import { parseTournamentsTab, parseWorkbook } from '../../packages/ingest/src/sheet.ts';

const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const official = parseTournamentsTab(wb.get('Tournaments')!);

type Variant = {
  name: string;
  /** excluded count for one event */
  count: (ev: ReturnType<typeof normalizeTournament>['events'][number]) => number;
  dropFilter?: boolean;
};

const mk = (name: string, opts: { basis: 'missing' | 'appeared' | 'byeaware'; threshold: number; dropped?: boolean }): Variant => ({
  name,
  count: (ev) => {
    const prelims = ev.rounds.filter((r) => r.isPrelim);
    const scored = new Map<string, number>();
    const appeared = new Map<string, number>();
    const byes = new Map<string, number>();
    for (const r of prelims) {
      for (const s of r.sections) {
        for (const b of s.ballots) {
          if (!b.entryId) continue;
          appeared.set(b.entryId, (appeared.get(b.entryId) ?? 0) + 1);
          if (b.won !== null) scored.set(b.entryId, (scored.get(b.entryId) ?? 0) + 1);
          else if (s.isBye) byes.set(b.entryId, (byes.get(b.entryId) ?? 0) + 1);
        }
      }
    }
    const anyScored = [...scored.values()].some((v) => v > 0);
    let n = 0;
    for (const [entryId, e] of ev.entries) {
      if (opts.dropped && e.dropped) { n++; continue; }
      if (!anyScored) continue;
      const missed =
        opts.basis === 'missing'
          ? prelims.length - (scored.get(entryId) ?? 0)
          : opts.basis === 'byeaware'
            ? prelims.length - (scored.get(entryId) ?? 0) - (byes.get(entryId) ?? 0)
            : (appeared.get(entryId) ?? 0) - (scored.get(entryId) ?? 0);
      if (missed >= opts.threshold) n++;
    }
    return n;
  },
});

const variants: Variant[] = [
  mk('A missing>=2 (current)', { basis: 'missing', threshold: 2 }),
  mk('B missing>=2 +dropped', { basis: 'missing', threshold: 2, dropped: true }),
  mk('C missing>=3', { basis: 'missing', threshold: 3 }),
  mk('D appeared-unscored>=2', { basis: 'appeared', threshold: 2 }),
  mk('E appeared-unscored>=2 +dropped', { basis: 'appeared', threshold: 2, dropped: true }),
  mk('F appeared-unscored>=1 +dropped', { basis: 'appeared', threshold: 1, dropped: true }),
  mk('G byeaware>=2', { basis: 'byeaware', threshold: 2 }),
  mk('H byeaware>=2 +dropped', { basis: 'byeaware', threshold: 2, dropped: true }),
  mk('I byeaware>=3 +dropped', { basis: 'byeaware', threshold: 3, dropped: true }),
  mk('J missing>=3 +dropped', { basis: 'missing', threshold: 3, dropped: true }),
  { name: 'K dropped only', count: (ev) => [...ev.entries.values()].filter((e) => e.dropped).length },
  {
    name: 'L dropped OR byeaware>=2',
    count: (ev) => {
      const prelims = ev.rounds.filter((r) => r.isPrelim);
      const scored = new Map<string, number>();
      const byes = new Map<string, number>();
      for (const r of prelims)
        for (const s of r.sections)
          for (const b of s.ballots) {
            if (!b.entryId) continue;
            if (b.won !== null) scored.set(b.entryId, (scored.get(b.entryId) ?? 0) + 1);
            else if (s.isBye) byes.set(b.entryId, (byes.get(b.entryId) ?? 0) + 1);
          }
      const anyScored = [...scored.values()].some((v) => v > 0);
      let n = 0;
      for (const [entryId, e] of ev.entries) {
        if (e.dropped) { n++; continue; }
        if (!anyScored) continue;
        if (prelims.length - (scored.get(entryId) ?? 0) - (byes.get(entryId) ?? 0) >= 2) n++;
      }
      return n;
    },
  },
];

const cases: { raw: number; theirs: number; ev: ReturnType<typeof normalizeTournament>['events'] }[] = [];
for (const off of official) {
  if (!off.tournId || off.openField === null) continue;
  const p = `data/raw/tabroom/${off.tournId}.json`;
  if (!existsSync(p)) continue;
  const t = normalizeTournament(JSON.parse(readFileSync(p, 'utf8')));
  const opens = t.events.filter((e) => e.isParli && e.division === 'open');
  if (!opens.length) continue;
  cases.push({ raw: opens.reduce((a, e) => a + e.entries.size, 0), theirs: off.openField, ev: opens });
}

console.log(`${cases.length} tournaments with a comparable open field\n`);
console.log(`${'variant'.padEnd(34)} ${'exact'.padStart(8)} ${'within1'.padStart(8)} ${'meanErr'.padStart(8)}`);
for (const v of variants) {
  let exact = 0, within1 = 0, sum = 0;
  for (const c of cases) {
    const ours = c.raw - c.ev.reduce((a, e) => a + v.count(e), 0);
    const d = ours - c.theirs;
    if (d === 0) exact++;
    if (Math.abs(d) <= 1) within1++;
    sum += Math.abs(d);
  }
  const pc = (n: number) => `${((100 * n) / cases.length).toFixed(0)}%`;
  console.log(
    `${v.name.padEnd(34)} ${`${exact} ${pc(exact)}`.padStart(8)} ${`${within1} ${pc(within1)}`.padStart(8)} ${(sum / cases.length).toFixed(2).padStart(8)}`,
  );
}
