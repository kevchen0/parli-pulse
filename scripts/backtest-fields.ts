/**
 * Stage 1 backtest: field sizes.
 *
 * Article XXI points are mostly determined before any points table is
 * consulted -- by the open field, the novice/JV field, the AFS they sum to,
 * and the number of teams that actually broke. This diffs our computation of
 * those against the official sheet's `Tournaments` tab, so that a later points
 * mismatch can be attributed to a scoring rule rather than to a bad field size.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { computeFieldStats, normalizeTournament } from '../packages/ingest/src/normalize.ts';
import { parseTournamentsTab, parseWorkbook } from '../packages/ingest/src/sheet.ts';
import type { TabroomTournament } from '../packages/ingest/src/tabroom-types.ts';

const RAW_DIR = 'data/raw/tabroom';
const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const official = parseTournamentsTab(wb.get('Tournaments')!);
const byTournId = new Map(official.filter((t) => t.tournId).map((t) => [t.tournId!, t]));

const cached = new Set(readdirSync(RAW_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));

interface Row {
  tournId: string;
  name: string;
  ours: { open: number; njv: number; afs: number; elim: number; prelims: number };
  theirs: { open: number | null; njv: number | null; afs: number | null; elim: number | null; prelims: number | null };
  divisions: string;
  note: string;
}

const rows: Row[] = [];
const skipped: string[] = [];

for (const [tournId, off] of byTournId) {
  if (!cached.has(tournId)) {
    skipped.push(`${tournId} ${off.name} (no cached payload)`);
    continue;
  }
  const raw = JSON.parse(readFileSync(`${RAW_DIR}/${tournId}.json`, 'utf8')) as TabroomTournament;
  const t = normalizeTournament(raw);
  // Tournaments create divisions they never run. Stanford lists a `Parli -
  // Open` alongside the `Parli - TOC` that actually happened; counting the
  // empty one as a second open division breaks the AFS.
  const parli = t.events.filter((e) => e.isParli && !computeFieldStats(e).phantom);
  const opens = parli.filter((e) => e.division === 'open');
  // Middle school counts with novice/JV: Stanford's own division is named
  // "Parli - Middle School + Novice Combined".
  const support = parli.filter((e) => e.division === 'jv' || e.division === 'novice' || e.division === 'middle');

  if (opens.length === 0) {
    skipped.push(`${tournId} ${off.name} (no open parli event; found ${parli.map((p) => p.name).join(', ') || 'none'})`);
    continue;
  }

  // XXI.6.C: with more than one open division each counts separately and
  // novice/JV is not added. With one, novice/JV joins the AFS.
  // XXI.6.C says multiple open divisions count separately with novice/JV
  // excluded, but the league did not apply that at Stanford -- it recorded a
  // combined open field and a 49-team N/JV field. Following observed behaviour
  // until confirmed; see plan/07-open-questions.md.
  const multiOpen = opens.length > 1;
  const openStats = opens.map((e) => computeFieldStats(e));
  const openField = openStats.reduce((a, s) => a + s.fieldSize, 0);
  const njvField = support.reduce((a, e) => a + computeFieldStats(e).fieldSize, 0);
  const elimField = openStats.reduce((a, s) => a + s.elimField, 0);
  const prelims = Math.max(...openStats.map((s) => s.prelimCount));

  rows.push({
    tournId,
    name: off.name,
    ours: { open: openField, njv: njvField, afs: openField + njvField, elim: elimField, prelims },
    theirs: {
      open: off.openField, njv: off.njvField ?? 0, afs: off.afs,
      elim: off.openElimField, prelims: off.prelimCount,
    },
    divisions: `${opens.map((e) => e.name).join('|')}${support.length ? ` +${support.length}nv` : ''}`,
    note: multiOpen ? 'multi-open' : '',
  });
}

const eq = (a: number, b: number | null): boolean => b !== null && a === b;
const mark = (a: number, b: number | null): string => (eq(a, b) ? ' ' : '*');

rows.sort((a, b) => a.name.localeCompare(b.name));

console.log(
  `${'id'.padEnd(6)} ${'tournament'.padEnd(30)} ` +
  `${'open'.padStart(9)} ${'n/jv'.padStart(9)} ${'afs'.padStart(9)} ${'elim'.padStart(9)} ${'prelim'.padStart(7)}`,
);
console.log('-'.repeat(96));

// Only score a metric where the sheet actually published a value; blank cells
// are not disagreements.
const tally = { open: 0, njv: 0, afs: 0, elim: 0, prelims: 0 };
const denom = { open: 0, njv: 0, afs: 0, elim: 0, prelims: 0 };
for (const r of rows) {
  for (const k of ['open', 'njv', 'afs', 'elim', 'prelims'] as const) {
    if (r.theirs[k] !== null) denom[k]++;
  }
  if (eq(r.ours.open, r.theirs.open)) tally.open++;
  if (eq(r.ours.njv, r.theirs.njv)) tally.njv++;
  if (eq(r.ours.afs, r.theirs.afs)) tally.afs++;
  if (eq(r.ours.elim, r.theirs.elim)) tally.elim++;
  if (eq(r.ours.prelims, r.theirs.prelims)) tally.prelims++;
  const cell = (o: number, t: number | null): string => `${o}/${t ?? '-'}${mark(o, t)}`.padStart(9);
  console.log(
    `${r.tournId.padEnd(6)} ${r.name.slice(0, 30).padEnd(30)} ` +
    `${cell(r.ours.open, r.theirs.open)} ${cell(r.ours.njv, r.theirs.njv)} ` +
    `${cell(r.ours.afs, r.theirs.afs)} ${cell(r.ours.elim, r.theirs.elim)} ` +
    `${String(r.ours.prelims).padStart(3)}/${String(r.theirs.prelims ?? '-').padEnd(3)}${mark(r.ours.prelims, r.theirs.prelims)}` +
    (r.note ? `  ${r.note}` : ''),
  );
}

const pctOf = (k: number, d: number): string =>
  `${String(k).padStart(3)}/${String(d).padEnd(3)} (${((100 * k) / d).toFixed(0)}%)`;
console.log('-'.repeat(96));
console.log(`compared ${rows.length} tournaments, scored against published cells only`);
console.log(`  open field  ${pctOf(tally.open, denom.open)}`);
console.log(`  n/jv field  ${pctOf(tally.njv, denom.njv)}`);
console.log(`  AFS         ${pctOf(tally.afs, denom.afs)}`);
console.log(`  elim field  ${pctOf(tally.elim, denom.elim)}`);
console.log(`  prelim #    ${pctOf(tally.prelims, denom.prelims)}`);
if (skipped.length) {
  console.log(`\nskipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  - ${s}`);
}
