/**
 * Does XXI.5.C derived from Tabroom match what the league recorded?
 *
 * The engine used to read `walkover_adjustment` off the sheet, which made the
 * one adjustment we did not compute also the one we could not check -- and left
 * a live season unable to score a closeout until the league wrote the
 * tournament up. It is derived now, in `computeEntryPerformances`; this scores
 * that derivation against the column it replaced.
 *
 * The rule, and the two things it deliberately is not:
 *
 *   A same-school elim pairing that drew a **short panel** -- fewer ballots
 *   than the same round gave its other sections -- was not debated. Whoever
 *   advanced takes -2 for walking over a teammate, whoever stood down takes +2.
 *   Where two same-school teams win the semifinals and no final is ever
 *   published, they closed out and share the title: -3 each.
 *
 *   - Not "same school". Harvard's octafinal between two Menlo-Atherton teams
 *     went 2-1 on a full panel and the league records no adjustment for it.
 *   - Not "no result entered". A walkover still carries a token ballot naming
 *     whoever went through, so that test finds 4 of roughly 47.
 *
 * State qualifiers are excluded: XXI.4.C scores them on qual/alt, not a
 * bracket, and the league records no walkover there even where one is visible.
 *
 * Run: npm run check:walkovers
 */
import { existsSync } from 'node:fs';
import { computeSeason } from './lib/season.ts';
import { resolveSheetPath } from '../packages/ingest/src/sheet.ts';

const SEASON = process.env.SEASON ?? '2025-26';

function main(): void {
  const path = resolveSheetPath(SEASON, existsSync);

  // Both runs through the one implementation, rather than a second copy of the
  // rule written in SQL. That copy existed for a day and was already stale:
  // it could not see the finals-closeout case at all. Pattern G.
  const theirs = computeSeason(path, { source: { walkover: 'sheet' } });
  const ours = computeSeason(path, { source: { walkover: 'tabroom' } });

  const sheet = new Map<string, number>();
  const label = new Map<string, string>();
  for (const c of theirs.cases) {
    if (c.provenance !== 'tabroom') continue;
    sheet.set(c.entryId, c.ourWalkover);
    label.set(c.entryId, `${c.tournament} | ${c.team}`);
  }
  const derived = new Map<string, number>();
  for (const c of ours.cases) {
    if (c.provenance === 'tabroom') derived.set(c.entryId, c.ourWalkover);
  }

  let exact = 0;
  const wrong: { sheet: number; ours: number; who: string }[] = [];
  for (const [id, theirValue] of sheet) {
    const ourValue = derived.get(id) ?? 0;
    if (ourValue === theirValue) exact++;
    else wrong.push({ sheet: theirValue, ours: ourValue, who: label.get(id) ?? id });
  }

  const withAdj = [...sheet.values()].filter(Boolean).length;
  console.log(`\nXXI.5.C derived from Tabroom, against the league's own column`);
  console.log(`  season                          ${SEASON}`);
  console.log(`  matched entries                 ${sheet.size}`);
  console.log(`  carrying an adjustment: sheet   ${withAdj}`);
  console.log(`                          ours    ${[...derived.values()].filter(Boolean).length}`);
  console.log(`  exact                           ${exact}/${sheet.size}  (${((100 * exact) / sheet.size).toFixed(1)}%)`);
  console.log(`  disagreements                   ${wrong.length}\n`);

  if (wrong.length) {
    console.log('  sheet  ours  entry');
    for (const w of wrong.sort((a, b) => a.who.localeCompare(b.who))) {
      console.log(`  ${String(w.sheet).padStart(5)} ${String(w.ours).padStart(5)}  ${w.who}`);
    }
    console.log(
      '\n  What is left is mostly rounds Tabroom does not hold. Nueva played two\n' +
      '  same-school semifinals and published no semifinal round at all, so there\n' +
      '  is nothing to read. Clackamas is the opposite: the league recorded -3 for\n' +
      '  an unplayed final between two *different* schools, which XXI.5.C does not\n' +
      '  provide for and this deliberately does not reproduce.\n',
    );
  }
}

main();
