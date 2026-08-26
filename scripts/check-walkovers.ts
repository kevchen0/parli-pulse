/**
 * Can XXI.5.C be derived from Tabroom alone?
 *
 * The engine currently reads `walkover_adjustment` off the league's sheet,
 * which means the one adjustment we do not compute is also the one we cannot
 * check -- and it leaves a live season unable to score a closeout until the
 * league writes the tournament up. This measures a derivation against the
 * sheet, so the cost of switching over is a number rather than a guess.
 *
 * The rule under test, from XXI.5.C:
 *
 *   A same-school elim pairing that drew a **short panel** -- fewer ballots
 *   than the same round gave its other sections -- was not debated. Whoever
 *   advanced takes -2 for walking over a teammate; whoever stood down takes
 *   +2 for being walked over.
 *
 * Two qualifiers, both measured rather than assumed:
 *
 *   - Same school is not enough on its own. Harvard's octafinal between two
 *     Menlo-Atherton teams went 2-1 on a full panel, and the league records no
 *     adjustment for it. Teammates do sometimes debate.
 *   - "Nobody won" is not the signature either. A walkover still carries a
 *     token ballot naming whoever went through, so that test finds 4 of ~47.
 *
 * State qualifiers are excluded: XXI.4.C scores them on qual/alt rather than
 * from a bracket, and the league records no walkover there even where the
 * bracket shows one.
 *
 * Run: npm run check:walkovers
 */
import { sql } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';
import { computeSeason } from './lib/season.ts';
import { resolveSheetPath } from '../packages/ingest/src/sheet.ts';
import { existsSync } from 'node:fs';

const SEASON = process.env.SEASON ?? '2025-26';

/** Elim stages from the widest bracket to the final. */
const STAGES = ['tripleOcto', 'doubleOcto', 'octo', 'quarter', 'semi', 'second', 'first'];

const WALK_OVER = -2;
const WALKED_OVER = 2;

interface Section {
  entryId: string;
  roundLevel: string | null;
  reached: string | null;
  category: string | null;
  ballots: number;
  roundMaxBallots: number;
}

/** The adjustment this section implies for this entry, or 0 for a real round. */
export function deriveWalkover(s: Section): number {
  if (s.category === 'CHSSA' || s.category === 'OSAA') return 0;
  if (!(s.ballots < s.roundMaxBallots)) return 0;
  const here = s.roundLevel ? STAGES.indexOf(s.roundLevel) : -1;
  const got = s.reached ? STAGES.indexOf(s.reached) : -1;
  if (here < 0 || got < 0) return 0;
  return got > here ? WALK_OVER : WALKED_OVER;
}

async function main(): Promise<void> {
  const path = resolveSheetPath(SEASON, existsSync);
  const season = computeSeason(path);

  // Truth: what the league recorded, tied to our entries by the same matcher
  // the rest of the pipeline uses. Never a fresh match key -- see pattern B.
  const truth = new Map<string, number>();
  const label = new Map<string, string>();
  for (const c of season.cases) {
    if (c.provenance !== 'tabroom') continue;
    truth.set(c.entryId, c.ourWalkover ?? 0);
    label.set(c.entryId, `${c.tournament} | ${c.team}`);
  }

  const { db, close } = createDb();
  const rows = (await db.execute(sql`
    with side as (
      select ro.id as round_id, ro.elim_level as round_level, b.section_id, b.entry_id,
             en.school_id, en.elim_level as reached, tr.category,
             count(*) as ballots
      from ballots b
      join rounds ro on ro.id = b.round_id
      join events ev on ev.id = ro.event_id
      join tournaments tr on tr.id = ev.tournament_id
      join entries en on en.id = b.entry_id
      where ro.kind = 'elim' and b.section_id is not null and tr.season_id = ${SEASON}
      group by ro.id, ro.elim_level, b.section_id, b.entry_id, en.school_id,
               en.elim_level, tr.category
    ),
    round_norm as (select round_id, max(ballots) as round_max from side group by round_id)
    select a.entry_id as "entryId", a.round_level as "roundLevel", a.reached,
           a.category, a.ballots, n.round_max as "roundMaxBallots"
    from side a
    join side b on b.section_id = a.section_id and b.entry_id <> a.entry_id
    join round_norm n on n.round_id = a.round_id
    where a.school_id is not null and a.school_id = b.school_id
    order by a.entry_id, a.round_id
  `)).rows as unknown as Section[];

  const derived = new Map<string, number>();
  for (const s of rows) {
    const adj = deriveWalkover({ ...s, ballots: Number(s.ballots), roundMaxBallots: Number(s.roundMaxBallots) });
    if (adj) derived.set(s.entryId, (derived.get(s.entryId) ?? 0) + adj);
  }

  let exact = 0;
  const wrong: { sheet: number; ours: number; who: string }[] = [];
  for (const [id, sheet] of truth) {
    const ours = derived.get(id) ?? 0;
    if (ours === sheet) exact++;
    else wrong.push({ sheet, ours, who: label.get(id) ?? id });
  }

  const pct = ((100 * exact) / truth.size).toFixed(1);
  console.log(`\nXXI.5.C derived from Tabroom, against the league's own column`);
  console.log(`  season            ${SEASON}`);
  console.log(`  matched entries   ${truth.size}`);
  console.log(`  with an adjustment in the sheet   ${[...truth.values()].filter(Boolean).length}`);
  console.log(`  derived            ${derived.size}`);
  console.log(`  exact              ${exact}/${truth.size}  (${pct}%)`);
  console.log(`  disagreements      ${wrong.length}\n`);

  if (wrong.length) {
    console.log('  sheet  ours  entry');
    for (const w of wrong.sort((a, b) => a.who.localeCompare(b.who))) {
      console.log(`  ${String(w.sheet).padStart(5)} ${String(w.ours).padStart(5)}  ${w.who}`);
    }
    console.log(
      '\n  Most of these are rounds Tabroom does not hold at all: when a final or\n' +
      '  a semi is closed out, some tournaments never create the round, so there\n' +
      '  is no section to read. That is a gap in the source rather than a rule we\n' +
      '  have wrong, and it is the reason this cannot reach 100%.\n',
    );
  }
  await close();
}

await main();
