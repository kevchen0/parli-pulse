/**
 * What happens if Tabroom decides which teams exist, instead of the sheet?
 *
 * Today `computeSeason` walks the league's `Entry` tab and scores the rows it
 * can tie to a Tabroom entry. That makes a team the league has not listed
 * invisible, and it means a tournament cannot be scored at all until the league
 * writes it up -- which is the one thing a live season most needs.
 *
 * `entries: 'tabroom'` scores every open-division entry instead, filtered to
 * what Article XXI actually requires:
 *
 *   1. the tournament clears XXI.1.D -- five schools, ten teams, three prelims;
 *   2. the entry belongs to a member school (XXI.9.A tables members only);
 *   3. its school resolves at all.
 *
 * Entries worth nothing are kept rather than dropped, so the data can say "this
 * team competed and earned nothing" instead of saying nothing. Only what scores
 * reaches the site.
 *
 * This reports what that gains and loses against the league's own standings.
 * The question is not whether the totals move -- most of what Tabroom adds
 * scores zero under XXI.3.A -- but whether anything the league counts is lost.
 *
 * Run: npm run compare:entries
 */
import { existsSync } from 'node:fs';
import { computeSeason, type EntryCase } from './lib/season.ts';
import { resolveSheetPath } from '../packages/ingest/src/sheet.ts';
import { weightedTotal } from '../packages/rules/src/index.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const EPSILON = 0.051;

function main(): void {
  const path = resolveSheetPath(SEASON, existsSync);
  const sheet = computeSeason(path, { source: 'tabroom' }).cases;
  const tab = computeSeason(path, { source: { fields: 'tabroom', breakingRecord: 'tabroom', walkover: 'tabroom', entries: 'tabroom' } }).cases;

  const scoring = (c: EntryCase): boolean => c.ours > 0;
  console.log(`\nWho decides which teams exist — the sheet, or Tabroom?`);
  console.log(`season ${SEASON}\n`);

  const rows = [
    ['entries scored', sheet.length, tab.length],
    ['  of those, worth points', sheet.filter(scoring).length, tab.filter(scoring).length],
    ['  worth nothing (kept, not shown)', sheet.filter((c) => !scoring(c)).length, tab.filter((c) => !scoring(c)).length],
    ['  not in the league\'s list', sheet.filter((c) => c.unlisted).length, tab.filter((c) => c.unlisted).length],
  ] as const;
  const w = Math.max(...rows.map((r) => String(r[0]).length));
  console.log(`  ${''.padEnd(w)}   sheet-driven   tabroom-driven`);
  for (const [label, a, b] of rows) {
    console.log(`  ${label.padEnd(w)}   ${String(a).padStart(12)}   ${String(b).padStart(14)}`);
  }

  // The test that matters: does anything the league counts stop being counted?
  const sheetById = new Map(sheet.map((c) => [c.entryId, c]));
  const tabById = new Map(tab.map((c) => [c.entryId, c]));
  const lost = [...sheetById.values()].filter((c) => c.ours > 0 && !tabById.has(c.entryId));
  const changed = [...sheetById.values()].filter((c) => {
    const t = tabById.get(c.entryId);
    return t && Math.abs(t.ours - c.ours) > EPSILON;
  });
  const gained = [...tabById.values()].filter((c) => c.ours > 0 && !sheetById.has(c.entryId));

  console.log(`\n  scoring entries lost       ${lost.length}`);
  console.log(`  scoring entries gained     ${gained.length}`);
  console.log(`  entries scored differently ${changed.length}`);

  const show = (label: string, list: EntryCase[]): void => {
    if (!list.length) return;
    console.log(`\n  ${label}`);
    const byT = new Map<string, EntryCase[]>();
    for (const c of list) (byT.get(c.tournament) ?? byT.set(c.tournament, []).get(c.tournament)!).push(c);
    for (const [t, cs] of [...byT].sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
      console.log(`  ${String(cs.length).padStart(5)}  ${t.padEnd(34)} e.g. ${cs[0]!.partner1}/${cs[0]!.partner2} ${cs[0]!.ours} pts`);
    }
  };
  show('lost, by tournament:', lost);
  show('gained, by tournament:', gained);
  show('scored differently, by tournament:', changed);

  // The question that matters: does every partnership the league scores come
  // out of the Tabroom-driven run with the same season total?
  //
  // Entry-level counts cannot answer it. Team keys are built from names, and
  // the two runs read names from different places -- the sheet writes
  // "Ma. Qiu" to separate two Qius where Tabroom just says "Qiu", and
  // "Menlo-Atherton" where Tabroom says "Menlo-Atherton High School". So
  // partnerships are matched through the one identity both runs share: the
  // Tabroom entry id. An entry the sheet run scored belongs to a known
  // partnership, and every entry the Tabroom run scores is then attributed to
  // that same partnership, or counted as new.
  const teamOfEntry = new Map<string, string>();
  for (const c of sheet) teamOfEntry.set(c.entryId, c.team);

  const sheetTotals = new Map<string, number[]>();
  for (const c of sheet) {
    if (c.ours <= 0) continue;
    (sheetTotals.get(c.team) ?? sheetTotals.set(c.team, []).get(c.team)!).push(c.ours);
  }
  const tabTotals = new Map<string, number[]>();
  let attachedToKnown = 0;
  let brandNew = 0;
  for (const c of tab) {
    if (c.ours <= 0) continue;
    const key = teamOfEntry.get(c.entryId);
    if (key === undefined) {
      brandNew++;
      continue;
    }
    if (!sheetTotals.has(key)) attachedToKnown++;
    (tabTotals.get(key) ?? tabTotals.set(key, []).get(key)!).push(c.ours);
  }

  let same = 0;
  let missing = 0;
  let moved = 0;
  const movedRows: { team: string; before: number; after: number }[] = [];
  for (const [team, pts] of sheetTotals) {
    const before = weightedTotal(pts);
    const after = tabTotals.has(team) ? weightedTotal(tabTotals.get(team)!) : null;
    if (after === null) { missing++; continue; }
    if (Math.abs(after - before) < EPSILON) same++;
    else { moved++; movedRows.push({ team, before, after }); }
  }
  const n = sheetTotals.size;
  console.log(`\n  partnerships the league scores: ${n}`);
  console.log(`    identical season total   ${same}  (${((100 * same) / n).toFixed(2)}%)`);
  console.log(`    total moved              ${moved}`);
  console.log(`    absent entirely          ${missing}`);
  console.log(`\n  partnerships the Tabroom run adds that the sheet run has none of: ${brandNew} entries`);

  if (movedRows.length) {
    console.log('\n  partnerships whose total moved:');
    for (const r of movedRows.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 15)) {
      console.log(`    ${r.team.padEnd(46)} ${r.before.toFixed(1).padStart(6)} -> ${r.after.toFixed(1)}`);
    }
  }
}

main();
