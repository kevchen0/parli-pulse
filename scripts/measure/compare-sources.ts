/**
 * What does the sheet buy us?
 *
 * The engine has always taken the league's published field sizes, break
 * percentage, prelim count, breaking record and walkover adjustment wherever
 * the sheet had them, computing its own only as a fallback. That is the right
 * choice for a backtest -- it isolates the points rules, so a mismatch can
 * never be a field-size mismatch in disguise -- and the wrong default for a
 * live pipeline, which needs to score a tournament before the league writes it
 * up. Both used one function, so the backtest's choice was also production's.
 *
 * This runs the season twice, once from each source, and reports agreement
 * with the sheet's own `calc_points` side by side. Discovery is unchanged in
 * both: the sheet's `Results` column still decides which tournaments exist and
 * its `Entry` tab still decides which teams the league scores. Those are not
 * numbers, and no amount of Tabroom recovers them.
 *
 * The figure that matters is not which is higher. It is how much of the 98%
 * was the engine agreeing with the league, and how much was the engine being
 * handed the league's inputs.
 *
 * Run: npm run compare:sources
 */
import { existsSync } from 'node:fs';
import { computeSeason, type EntryCase, type SeasonOptions } from '../lib/season.ts';
import { resolveSheetPath } from '../../packages/ingest/src/sheet.ts';

const SEASON = process.env.SEASON ?? '2025-26';
/** Points agreement is exact; the tolerance only absorbs float dust. */
const EPSILON = 0.051;

const pct = (n: number, d: number): string =>
  d === 0 ? '—' : `${((100 * n) / d).toFixed(1)}%`;

const agrees = (c: EntryCase): boolean => Math.abs(c.ours - c.theirs) < EPSILON;

function scoreable(cases: EntryCase[]): EntryCase[] {
  // Only entries we computed from round data. Hand-entered and sheet-scored
  // results are the same under both sources by construction, so including them
  // would dilute the comparison with rows that cannot move.
  // Unlisted entries have no official figure, so they cannot be measured
  // against one.
  return cases.filter((c) => c.provenance === 'tabroom' && !c.unlisted);
}

function byCategory(cases: EntryCase[]): Map<string, EntryCase[]> {
  const out = new Map<string, EntryCase[]>();
  for (const c of cases) {
    const list = out.get(c.category) ?? [];
    list.push(c);
    out.set(c.category, list);
  }
  return out;
}

function main(): void {
  const path = resolveSheetPath(SEASON, existsSync);

  // One input moved at a time. Switching all three at once says the accuracy
  // changed and not which input did it, and they are not equally hard: field
  // sizes are arithmetic over the payload, the breaking record is a rule about
  // which team was last in, and the walkover is a bracket shape.
  const configs: { label: string; source: NonNullable<SeasonOptions['source']> }[] = [
    { label: 'everything from the sheet', source: 'sheet' },
    { label: 'our walkovers', source: { walkover: 'tabroom' } },
    { label: 'our breaking record', source: { breakingRecord: 'tabroom' } },
    { label: 'our field sizes', source: { fields: 'tabroom' } },
    { label: 'everything ours', source: 'tabroom' },
  ];

  const runs = configs.map((c) => ({
    ...c,
    cases: scoreable(computeSeason(path, { source: c.source }).cases),
  }));
  const baseline = runs[0]!;

  console.log(`\nArticle XXI agreement with the league's published points`);
  console.log(`season ${SEASON} · ${baseline.cases.length} entries scored from Tabroom round data`);
  console.log(`discovery is the sheet's in every row: it decides which tournaments and`);
  console.log(`which teams exist, and neither of those is a number.\n`);

  const w = Math.max(...runs.map((r) => r.label.length));
  console.log(`  ${'input source'.padEnd(w)}   exact      of ${baseline.cases.length}   vs baseline`);
  console.log(`  ${'-'.repeat(w)}   ------  ---------   -----------`);
  for (const r of runs) {
    const ok = r.cases.filter(agrees).length;
    const base = baseline.cases.filter(agrees).length;
    const d = ok - base;
    const delta = r === baseline ? '' : d === 0 ? 'no change' : `${d > 0 ? '+' : ''}${d}`;
    console.log(`  ${r.label.padEnd(w)}   ${pct(ok, r.cases.length).padStart(6)}   ${String(ok).padStart(5)}      ${delta}`);
  }

  // Per category, for the two ends.
  const T = runs[runs.length - 1]!;
  console.log('\n  by category');
  const cats = [...byCategory(baseline.cases).keys()].sort();
  const cw = Math.max(...cats.map((c) => c.length), 10);
  console.log(`  ${'category'.padEnd(cw)}   sheet inputs   ours only`);
  for (const cat of cats) {
    const s2 = byCategory(baseline.cases).get(cat) ?? [];
    const t2 = byCategory(T.cases).get(cat) ?? [];
    console.log(
      `  ${cat.padEnd(cw)}   ${pct(s2.filter(agrees).length, s2.length).padStart(12)}   ` +
      `${pct(t2.filter(agrees).length, t2.length).padStart(9)}`,
    );
  }

  // Where the full switch loses rows, grouped by tournament: a cluster is one
  // tournament's field size, not a points rule.
  const tById = new Map(T.cases.map((c) => [c.entryId, c]));
  const lost: EntryCase[] = [];
  let gained = 0;
  for (const s2 of baseline.cases) {
    const t2 = tById.get(s2.entryId);
    if (!t2) continue;
    if (agrees(s2) && !agrees(t2)) lost.push(t2);
    else if (!agrees(s2) && agrees(t2)) gained++;
  }
  console.log(`\n  rows the sheet's inputs win   ${lost.length}`);
  console.log(`  rows our own inputs win       ${gained}\n`);

  if (lost.length) {
    // Which single input breaks each row. A row that survives every one-input
    // switch and still fails under all three is an interaction, and worth
    // knowing about separately from the rows one input explains.
    const single = new Map<string, Map<string, EntryCase>>();
    for (const r of runs.slice(1, -1)) {
      single.set(r.label, new Map(r.cases.map((c) => [c.entryId, c])));
    }
    const blame = (c: EntryCase): string => {
      const causes: string[] = [];
      for (const [label, m] of single) {
        const one = m.get(c.entryId);
        if (one && !agrees(one)) causes.push(label.replace('our ', ''));
      }
      return causes.length === 0 ? 'interaction' : causes.join(' + ');
    };

    const byTourn = new Map<string, { n: number; causes: Map<string, number> }>();
    for (const r of lost) {
      const e = byTourn.get(r.tournament) ?? { n: 0, causes: new Map() };
      e.n++;
      const c = blame(r);
      e.causes.set(c, (e.causes.get(c) ?? 0) + 1);
      byTourn.set(r.tournament, e);
    }
    console.log('  worst tournaments under our own inputs, and which input did it:');
    for (const [name, e] of [...byTourn].sort((a, b) => b[1].n - a[1].n).slice(0, 12)) {
      const causes = [...e.causes].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(', ');
      console.log(`  ${String(e.n).padStart(5)}  ${name.padEnd(22)} ${causes}`);
    }

    const overall = new Map<string, number>();
    for (const r of lost) overall.set(blame(r), (overall.get(blame(r)) ?? 0) + 1);
    console.log('\n  by cause:');
    for (const [c, n] of [...overall].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${c}`);
    }
    console.log(
      '\n  Entries cluster by tournament because a field size is a tournament-wide\n' +
      '  input: get the AFS wrong and every entry there reads the wrong row of the\n' +
      '  elim points table. `npm run backtest:fields` scores the field computation\n' +
      '  itself, which is where this is won or lost.\n',
    );
  }
}

main();
