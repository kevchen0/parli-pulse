/**
 * Stage 2 backtest: per-entry Article XXI points, diffed against the official
 * sheet's `Entry` tab, sliced by tournament category and by result type.
 */
import { existsSync, readFileSync } from 'node:fs';
import { scoreChssaLeague, scoreEntry, scoreToc, type ElimLevel } from '../packages/rules/src/index.ts';
import {
  buildStudentIndex,
  computeEntryPerformances,
  computeFieldStats,
  normalizeTournament,
} from '../packages/ingest/src/normalize.ts';
import { parseEntryTab, parseTournamentsTab, parseWorkbook } from '../packages/ingest/src/sheet.ts';

const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const officialTourns = parseTournamentsTab(wb.get('Tournaments')!);
const officialEntries = parseEntryTab(wb.get('Entry')!);

/** Surnames appear as "Pennington", "C. Pennington", "O'Dowd"; normalize hard. */
const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/^[a-z]\.\s*/, '').replace(/[^a-z]/g, '');
const pairKey = (a: string, b: string): string => [norm(a), norm(b)].sort().join('|');

const parseRecord = (s: string): { wins: number; losses: number } | undefined => {
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  return m ? { wins: Number(m[1]), losses: Number(m[2]) } : undefined;
};

interface Case {
  tournament: string;
  category: string;
  school: string;
  pair: string;
  ours: number;
  theirs: number;
  broke: boolean;
  matched: boolean;
  reason: string;
  ourBase: number | null;
  theirBase: number | null;
  ourAdj: number;
  theirAdj: number | null;
  hybrid: boolean;
  teamSizeFlag: boolean;
}

const cases: Case[] = [];
const unmatchedSheet: { tournament: string; pair: string }[] = [];
const noPayload = new Set<string>();

for (const off of officialTourns) {
  const sheetRows = officialEntries.filter((e) => e.tournament === off.name);
  if (!sheetRows.length) continue;
  if (!off.tournId || !existsSync(`data/raw/tabroom/${off.tournId}.json`)) {
    noPayload.add(off.name);
    continue;
  }
  const raw = JSON.parse(readFileSync(`data/raw/tabroom/${off.tournId}.json`, 'utf8'));
  const t = normalizeTournament(raw);
  const students = buildStudentIndex(raw);
  const opens = t.events.filter((e) => e.isParli && e.division === 'open' && !computeFieldStats(e).phantom);
  if (!opens.length) { noPayload.add(off.name); continue; }

  // Field context: prefer the sheet's own published figures so that a points
  // mismatch cannot be blamed on a field-size mismatch we already track.
  const stats = opens.map(computeFieldStats);
  const openField = off.openField ?? stats.reduce((a, s) => a + s.fieldSize, 0);
  const afs = off.afs ?? openField;
  const elimField = off.openElimField ?? stats.reduce((a, s) => a + s.elimField, 0);
  const breakPct = off.breakPct ?? (openField ? (100 * elimField) / openField : 0);
  const prelimCount = off.prelimCount ?? Math.max(...stats.map((s) => s.prelimCount));
  const ctx = { afs, breakPct, prelimCount, breakingRecord: parseRecord(off.breakingRecord) };

  // Index our entries by surname pair.
  const ours = new Map<string, { school: string; wins: number; losses: number; elimLevel: ElimLevel | null; size: boolean; walkovers: number; prelimBallotsWon: number; elimWins: number }>();
  for (const ev of opens) {
    const perf = computeEntryPerformances(ev);
    // Ballot-level tallies for the TOC schedule, which counts ballots not rounds.
    const ballotsWon = new Map<string, number>();
    const elimWins = new Map<string, number>();
    for (const r of ev.rounds) {
      for (const sec of r.sections) {
        for (const b of sec.ballots) {
          if (!b.entryId || b.won !== true) continue;
          const target = r.isPrelim ? ballotsWon : elimWins;
          target.set(b.entryId, (target.get(b.entryId) ?? 0) + 1);
        }
      }
    }
    for (const [entryId, entry] of ev.entries) {
      const names = entry.studentIds.map((s) => students.get(s)?.last ?? '').filter(Boolean);
      if (names.length !== 2) continue;
      const p = perf.get(entryId)!;
      // Elim *wins* are round wins, not ballots: a 3-0 panel is one win.
      const elimRoundWins = ev.rounds.filter((r) => r.isElim).filter((r) =>
        r.sections.some((sec) => {
          const mineB = sec.ballots.filter((b) => b.entryId === entryId);
          return mineB.length > 0 && mineB.filter((b) => b.won === true).length * 2 > mineB.length;
        }),
      ).length;
      ours.set(pairKey(names[0]!, names[1]!), {
        school: entry.schoolName ?? '',
        wins: p.wins, losses: p.losses, elimLevel: p.elimLevel,
        size: entry.eligibleTeamSize, walkovers: p.sameSchoolWalkovers,
        prelimBallotsWon: ballotsWon.get(entryId) ?? 0,
        elimWins: elimRoundWins,
      });
    }
  }

  for (const row of sheetRows) {
    const key = pairKey(row.partner1, row.partner2);
    const mine = ours.get(key);
    if (!mine) { unmatchedSheet.push({ tournament: off.name, pair: key }); continue; }
    // The league scores CHSSA/OSAA tournaments on the ordinary XXI.3.A prelim
    // table, not the reduced XXI.4.B schedule -- verified against the sheet,
    // where a 3-1 there is worth 7, not 4. They are prelim-only in practice.
    // State-qualifier results ("qual"/"alt", XXI.4.C) are not derivable from
    // Tabroom and are read from the sheet's result column for now.
    const qual = off.category === 'CHSSA' || off.category === 'OSAA'
      ? { qual: 8, alt: 4 }[row.result.toLowerCase() as 'qual' | 'alt']
      : undefined;
    const isToc = /NPDL-TOC/i.test(off.name);
    const sb = qual !== undefined
      ? { points: qual, basePoints: qual, prelimCountAdjustment: 0, breakPenalty: 0,
          walkoverAdjustment: 0, floorApplied: 'none' as const, excluded: null, broke: false }
      : isToc
        ? scoreToc(
            {
              prelimBallotsWon: mine.prelimBallotsWon,
              broke: mine.elimLevel !== null,
              elimWins: mine.elimWins,
              champion: mine.elimLevel === 'first',
            },
            breakPct,
          )
        : scoreEntry(
            { wins: mine.wins, losses: mine.losses, elimLevel: mine.elimLevel, eligibleTeamSize: mine.size,
              walkoverAdjustment: row.walkoverAdjustment ?? 0 },
            ctx,
          );
    cases.push({
      tournament: off.name,
      category: off.category || '(none)',
      school: row.school1,
      pair: key,
      ours: sb.points,
      theirs: row.calcPoints ?? 0,
      broke: mine.elimLevel !== null,
      matched: sb.points === (row.calcPoints ?? 0),
      reason: sb.excluded ?? (sb.basePoints === null && mine.elimLevel ? 'unreachableBracket' : ''),
      ourBase: sb.basePoints,
      theirBase: row.basePoints,
      ourAdj: sb.prelimCountAdjustment + sb.breakPenalty,
      theirAdj: row.breakPrelimAdjustment,
      hybrid: row.hybrid,
      teamSizeFlag: row.incorrectTeamSize,
    });
  }
}

const pct = (k: number, n: number): string => (n ? `${((100 * k) / n).toFixed(0)}%` : '  -');
const line = (label: string, rows: Case[]): string => {
  const m = rows.filter((r) => r.matched).length;
  return `${label.padEnd(30)} ${String(m).padStart(5)}/${String(rows.length).padEnd(5)} ${pct(m, rows.length).padStart(5)}`;
};

console.log('='.repeat(60));
console.log('STAGE 2 BACKTEST — per-entry Article XXI points');
console.log('='.repeat(60));
console.log(line('ALL', cases));

// The TOC scores under its own schedule (XXI.4.A), so it is broken out of
// "Regular" rather than diluted into it.
const isToc = (c: Case): boolean => /NPDL-TOC/i.test(c.tournament);
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
console.log(line('flagged wrong team size', cases.filter((c) => c.teamSizeFlag)));
console.log(line('adjustment disagreement', cases.filter((c) => c.theirAdj !== null && c.ourAdj !== c.theirAdj)));

console.log('\n-- component agreement (breaking teams) --');
const br = cases.filter((c) => c.broke);
console.log(line('base points', br.filter((c) => c.ourBase === c.theirBase).map((c) => ({ ...c, matched: true }))
  .concat(br.filter((c) => c.ourBase !== c.theirBase).map((c) => ({ ...c, matched: false })))));
console.log(line('prelim+break adj', br.filter((c) => c.theirAdj !== null).map((c) => ({ ...c, matched: c.ourAdj === c.theirAdj }))));

const bad = cases.filter((c) => !c.matched);
console.log(`\n-- top mismatching tournaments (${bad.length} rows) --`);
const byT = new Map<string, { bad: number; total: number }>();
for (const c of cases) {
  const e = byT.get(c.tournament) ?? { bad: 0, total: 0 };
  e.total++; if (!c.matched) e.bad++;
  byT.set(c.tournament, e);
}
for (const [name, s] of [...byT.entries()].filter(([, s]) => s.bad).sort((a, b) => b[1].bad - a[1].bad).slice(0, 15)) {
  console.log(`  ${name.slice(0, 30).padEnd(30)} ${String(s.bad).padStart(4)}/${String(s.total).padEnd(4)} bad`);
}
// Sample the largest delta buckets so each can be traced to a rule.
const buckets = new Map<number, Case[]>();
for (const c of bad) { const d = c.ours - c.theirs; (buckets.get(d) ?? buckets.set(d, []).get(d)!).push(c); }
console.log('\n-- sample rows from the largest delta buckets --');
for (const [d, rows] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4)) {
  console.log(`  delta ${d > 0 ? '+' : ''}${d} (${rows.length} rows):`);
  for (const r of rows.slice(0, 4)) {
    console.log(`     ${r.tournament.slice(0,22).padEnd(22)} ${r.category.padEnd(8)} broke=${r.broke ? 'Y' : 'n'} ours=${String(r.ours).padStart(3)} sheet=${String(r.theirs).padStart(3)} base=${String(r.ourBase).padStart(4)}/${String(r.theirBase).padStart(4)}`);
  }
}

const deltas = new Map<number, number>();
for (const c of bad) { const d = c.ours - c.theirs; deltas.set(d, (deltas.get(d) ?? 0) + 1); }
console.log('\ndelta histogram:', [...deltas.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d > 0 ? '+' : ''}${d}:${n}`).join('  '));
console.log(`\nsheet rows with no Tabroom match: ${unmatchedSheet.length}`);
console.log(`tournaments skipped (no payload / no open event): ${noPayload.size}`);

// ---------------------------------------------------------------------------
// Stage 3: aggregates. Only tournaments where every matched row agrees can
// produce a trustworthy total, so these are reported over the subset of
// competitors whose every result we reproduced.
// ---------------------------------------------------------------------------
import { weightedTotal } from '../packages/rules/src/index.ts';

const perDebaterOurs = new Map<string, number[]>();
const perDebaterTheirs = new Map<string, number[]>();
const perTeamOurs = new Map<string, number[]>();
const perTeamTheirs = new Map<string, number[]>();
const perSchoolOurs = new Map<string, number>();
const perSchoolTheirs = new Map<string, number>();
const debaterComplete = new Map<string, boolean>();

for (const row of officialEntries) {
  if (row.incorrectTeamSize) continue;
  const c = cases.find((x) => x.tournament === row.tournament && x.pair === pairKey(row.partner1, row.partner2));
  const theirs = row.calcPoints ?? 0;
  const ours = c?.ours ?? null;
  const teamKey = `${row.school1}|${pairKey(row.partner1, row.partner2)}`;
  const dKeys = [`${row.school1}|${norm(row.partner1)}`, `${row.school2 || row.school1}|${norm(row.partner2)}`];

  for (const k of dKeys) {
    (perDebaterTheirs.get(k) ?? perDebaterTheirs.set(k, []).get(k)!).push(theirs);
    if (ours !== null) (perDebaterOurs.get(k) ?? perDebaterOurs.set(k, []).get(k)!).push(ours);
    debaterComplete.set(k, (debaterComplete.get(k) ?? true) && ours !== null);
  }
  (perTeamTheirs.get(teamKey) ?? perTeamTheirs.set(teamKey, []).get(teamKey)!).push(theirs);
  if (ours !== null) (perTeamOurs.get(teamKey) ?? perTeamOurs.set(teamKey, []).get(teamKey)!).push(ours);

  // XXI.9.C -- hybrids contribute half to each school.
  const share = row.school2 ? 0.5 : 1;
  const schools = row.school2 ? [row.school1, row.school2] : [row.school1];
  for (const sc of schools) {
    perSchoolTheirs.set(sc, (perSchoolTheirs.get(sc) ?? 0) + theirs * share);
    if (ours !== null) perSchoolOurs.set(sc, (perSchoolOurs.get(sc) ?? 0) + ours * share);
  }
}

const agg = (
  label: string,
  ours: Map<string, number[]>,
  theirs: Map<string, number[]>,
  completeOnly: Map<string, boolean> | null,
): void => {
  let match = 0, total = 0;
  for (const [k, tv] of theirs) {
    if (completeOnly && !completeOnly.get(k)) continue;
    const ov = ours.get(k);
    if (!ov || ov.length !== tv.length) continue;
    total++;
    if (Math.abs(weightedTotal(ov) - weightedTotal(tv)) < 0.051) match++;
  }
  console.log(`${label.padEnd(30)} ${String(match).padStart(5)}/${String(total).padEnd(5)} ${pct(match, total).padStart(5)}`);
};

console.log('\n' + '='.repeat(60));
console.log('STAGE 3 — aggregate totals (competitors we fully reproduced)');
console.log('='.repeat(60));
agg('individual weighted (XXI.8)', perDebaterOurs, perDebaterTheirs, debaterComplete);
agg('team weighted (XXI.7)', perTeamOurs, perTeamTheirs, null);
let sm = 0, st = 0;
for (const [k, v] of perSchoolTheirs) {
  const o = perSchoolOurs.get(k);
  if (o === undefined) continue;
  st++; if (Math.abs(o - v) < 0.51) sm++;
}
console.log(`${'school unweighted (XXI.9)'.padEnd(30)} ${String(sm).padStart(5)}/${String(st).padEnd(5)} ${pct(sm, st).padStart(5)}`);
