/**
 * Checks the engine's point tables against the Board Code the league publishes.
 *
 * XXI.11 provides for the Board Code to replace itself each July. When it does,
 * a table can move and nothing in this repository would notice: `rulesForSeason`
 * falls back to the default season for an unknown one, so a changed table would
 * quietly score a whole season under last year's rules. That failure is silent,
 * arrives at the busiest moment, and invalidates every figure downstream.
 *
 * This reads the published document and compares the tables it can parse. It is
 * a guard, not a parser of the whole Code: it reports what it could not find
 * rather than assuming a missing section means agreement.
 *
 * Run before a season opens, and from the nightly workflow.
 *
 *   SEASON=2026-27 npm run check:rules
 */
import { rulesForSeason, CHSSA_LEAGUE_POINTS } from '../../packages/rules/src/index.ts';

const SEASON = process.env.SEASON ?? '2026-27';
const DOC_ID = process.env.RULES_DOC_ID ?? '1xv6klxK9PQPPyAaeJ9Gh9-CGL-nvikRjRAsDTiRYZtw';

/** Reads "3-0 = 8 points" lines from the section beginning at `heading`. */
function parseTable(text: string, heading: string, stopAt: RegExp): Record<string, number> | null {
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const rest = text.slice(start + heading.length);
  const end = rest.search(stopAt);
  const body = end >= 0 ? rest.slice(0, end) : rest;
  const table: Record<string, number> = {};
  for (const m of body.matchAll(/^\s*(\d+-\d+)\s*=\s*(\d+)\s*points?\s*$/gim)) {
    table[m[1]!] = Number(m[2]);
  }
  return Object.keys(table).length > 0 ? table : null;
}

function diff(
  label: string,
  ours: Record<string, number>,
  theirs: Record<string, number> | null,
): boolean {
  if (theirs === null) {
    console.log(`  ${label}: NOT FOUND in the published document -- check by hand`);
    return false;
  }
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])].sort();
  const rows = keys.filter((k) => ours[k] !== theirs[k]);
  if (rows.length === 0) {
    console.log(`  ${label}: matches (${keys.length} records)`);
    return true;
  }
  console.log(`  ${label}: ${rows.length} DIFFERENCE${rows.length === 1 ? '' : 'S'}`);
  for (const k of rows) {
    console.log(`    ${k.padEnd(6)} ours ${String(ours[k] ?? '-').padStart(3)}   published ${String(theirs[k] ?? '-').padStart(3)}`);
  }
  return false;
}

async function main(): Promise<void> {
  const url = `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`;
  const res = await fetch(url, { redirect: 'follow', headers: { accept: 'text/plain' } });
  if (!res.ok) throw new Error(`rules document returned HTTP ${res.status}`);
  const text = await res.text();
  if (text.length < 10_000) throw new Error(`rules document was only ${text.length} bytes`);

  console.log(`${SEASON}: engine against the published Board Code (${text.length.toLocaleString()} bytes)\n`);

  const rules = rulesForSeason(SEASON);
  let ok = true;

  ok = diff(
    'XXI.3.A non-breaking records',
    rules.prelimPoints,
    parseTable(text, 'shall receive points based on their prelim record as follows:', /XXI\.\d|^B\. Points Floor/m),
  ) && ok;

  ok = diff(
    'XXI.4.B CHSSA member league',
    CHSSA_LEAGUE_POINTS,
    parseTable(text, 'Only the following records shall count for points:', /^C\. |XXI\.\d/m),
  ) && ok;

  // The elim points table is published only as an image, so it cannot be read
  // from the text export. Saying so is the point: an unchecked table should not
  // pass silently alongside checked ones.
  console.log('  Elim Points Table: published as an image; not machine-checkable');

  const mentionsSeason = text.includes(SEASON);
  console.log(
    `\n  document ${mentionsSeason ? 'mentions' : 'does not mention'} ${SEASON}` +
      `${mentionsSeason ? '' : ' -- it may not have been revised for this season yet'}`,
  );

  if (!ok) {
    console.log('\nA table has moved. Add the season to SEASON_RULES in packages/rules before loading it.');
    process.exitCode = 1;
  } else {
    console.log('\nTables agree.');
  }
}

await main();
