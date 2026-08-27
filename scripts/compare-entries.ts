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
import { computeSeason, teamKey, type EntryCase } from './lib/season.ts';
import { resolveSheetPath, parseWorkbook, parseEntryTab } from '../packages/ingest/src/sheet.ts';
import { readFileSync } from 'node:fs';
import { weightedTotal } from '../packages/rules/src/index.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const EPSILON = 0.051;

/** A partnership's weighted season total from its scored results. */
function totals(cases: EntryCase[]): Map<string, number> {
  const byTeam = new Map<string, number[]>();
  for (const c of cases) {
    if (c.ours === 0) continue; // zero results contribute nothing to a best-five
    const list = byTeam.get(c.team) ?? [];
    list.push(c.ours);
    byTeam.set(c.team, list);
  }
  return new Map([...byTeam].map(([k, pts]) => [k, weightedTotal(pts)]));
}

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

  // Agreement with the league's published partnership totals, which is the
  // figure a reader actually sees.
  const compare = (label: string, cases: EntryCase[]): void => {
    const mine = totals(cases);
    let exact = 0;
    let seen = 0;
    for (const [k, theirTotal] of officialTotals(path)) {
      seen++;
      if (Math.abs((mine.get(k) ?? 0) - theirTotal) < EPSILON) exact++;
    }
    console.log(`  ${label.padEnd(16)} ${exact}/${seen}  (${((100 * exact) / seen).toFixed(1)}%)`);
  };
  console.log(`\n  partnership season totals against the league's own:`);
  compare('sheet-driven', sheet);
  compare('tabroom-driven', tab);
}

/** The league's weighted season total per partnership, from its `Entry` rows. */
function officialTotals(path: string): Map<string, number> {
  const rows = parseEntryTab(parseWorkbook(readFileSync(path)).get('Entry')!);
  const byTeam = new Map<string, number[]>();
  for (const e of rows) {
    if (e.incorrectTeamSize) continue;
    const pts = e.calcPoints ?? 0;
    if (pts === 0) continue;
    const k = teamKey(e.school1, e.partner1, e.partner2);
    const list = byTeam.get(k) ?? [];
    list.push(pts);
    byTeam.set(k, list);
  }
  return new Map([...byTeam].map(([k, pts]) => [k, weightedTotal(pts)]));
}

main();
