/**
 * Computes Glicko-2 ratings for every partnership and stores the history.
 *
 * This is our own measure, not the league's. Article XXI points describe what a
 * partnership accumulated over a season; a rating describes how strong they
 * look. The two disagree on purpose -- 5-0 at a small local outscores 4-2 at
 * Stanford under the rules, and should not out-rate it here -- so nothing on
 * the site may present this as a league ranking. See plan/08-risks-policy.md.
 *
 * The configuration is not a matter of taste. It was chosen on held-out rounds
 * and beats the league's own ranking at predicting results by 2.8 points of
 * accuracy; `npm run validate:rating` reruns the whole comparison. The gate was
 * that it beat "higher Article XXI points wins", and it does.
 *
 * Run after `rollup`, which is what decides who is one person and who is two.
 * A rating computed before identity merging rates a partnership's registrations
 * separately and gets three thin ratings where there should be one.
 *
 * Rows written per subject:
 *  - one per tournament, carrying the rating as it stood after that tournament,
 *    so a season can be charted;
 *  - one with a null tournament, the current figure, deviation widened for
 *    however long the partnership has been away.
 */
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import {
  DEFAULT_DEVIATION,
  MIN_RATED_ROUNDS,
  SeasonRun,
  VALIDATED_OPTIONS,
  conservative,
  estimateSideAdvantage,
} from '../packages/rating/src/index.ts';
import { loadPartnershipNames } from './lib/identity.ts';
import { loadRatingData } from './lib/rating-data.ts';

const SEASON = process.env.SEASON ?? '2025-26';
/**
 * The public board's minimum, which is a gate rather than a filter: the rating
 * and its deviation are computed and stored for every partnership, so one below
 * the line still has a number, it simply is not ranked on the strength of six
 * rounds. The site reads the same constant.
 */
const GATE_ROUNDS = Number(process.env.GATE_ROUNDS ?? MIN_RATED_ROUNDS);

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    const data = await loadRatingData(db, SEASON);
    if (data.periods.length === 0) {
      console.log(`no rated rounds for ${SEASON}; nothing to do`);
      return;
    }

    console.log(`${data.rounds.length} rated rounds, ${data.periods.length} tournaments, ${data.members.size} partnerships`);
    const { byes, undecided, tied, unknownTeam, selfMatch, oddSection } = data.skipped;
    console.log(
      `  not rated: ${byes} byes, ${undecided} with no result entered, ${tied} tied panels, ` +
        `${unknownTeam} with a team we only half know, ${selfMatch} self-matches, ${oddSection} malformed`,
    );

    // Read off the season being rated rather than carried as a constant: the
    // sides are not equally easy and how unequal they are is a fact about this
    // season's motions and judges, not about parliamentary debate.
    const sideAdvantage = estimateSideAdvantage(data.rounds);
    console.log(`  proposition advantage: ${sideAdvantage.toFixed(1)} rating points`);

    const run = new SeasonRun({ ...VALIDATED_OPTIONS, sideAdvantage });
    for (const [subject, members] of data.members) run.declareMembers(subject, members);
    for (const period of data.periods) run.runPeriod(period);

    // "Now" is the last day of competition, not today's date. Running the
    // script twice a week apart must not quietly widen every deviation.
    const asOf = data.periods.at(-1)!.date;
    // Ordered on the rating less its deviation, not the rating: see
    // `conservative`. A partnership climbs by being confirmed as well as by
    // winning, which is the only ordering that survives half the field having
    // fewer than ten rounds.
    const standings = run
      .standingsAt(asOf)
      .sort((a, b) => conservative(b.rating) - conservative(a.rating));

    // Season-scoped, so clearing and rewriting is safe here -- unlike `schools`
    // and `debaters`, which are not, and must be upserted.
    await db.delete(t.ratings).where(eq(t.ratings.seasonId, SEASON));

    const rows = [
      ...run.history.map((h) => ({
        id: `rt_${SEASON}_${h.subject}_${h.periodId}`,
        seasonId: SEASON,
        subjectKind: 'partnership',
        subjectId: h.subject,
        tournamentId: h.periodId,
        rating: Number(h.rating.toFixed(2)),
        deviation: Number(h.deviation.toFixed(2)),
        volatility: Number(h.volatility.toFixed(6)),
        roundsCounted: h.rounds,
      })),
      ...standings.map((s) => ({
        id: `rt_${SEASON}_${s.subject}_current`,
        seasonId: SEASON,
        subjectKind: 'partnership',
        subjectId: s.subject,
        tournamentId: null,
        rating: Number(s.rating.rating.toFixed(2)),
        deviation: Number(s.rating.deviation.toFixed(2)),
        volatility: Number(s.rating.volatility.toFixed(6)),
        roundsCounted: s.rounds,
      })),
    ];

    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(t.ratings).values(rows.slice(i, i + 500) as never);
    }
    console.log(`\nwrote ${rows.length} rows (${standings.length} current, ${run.history.length} historical)`);

    const ranked = standings.filter((s) => s.rounds >= GATE_ROUNDS);
    console.log(
      `${ranked.length} of ${standings.length} partnerships clear ${GATE_ROUNDS} rounds ` +
        `(${((100 * ranked.length) / standings.length).toFixed(0)}%)`,
    );

    const names = await loadPartnershipNames(db, ranked.slice(0, 20).map((s) => s.subject));
    console.log(`\ntop 20 as of ${asOf}, ranked on rating less deviation:\n`);
    console.log('      shown  rating   +/-  rounds  partnership');
    ranked.slice(0, 20).forEach((s, i) => {
      const n = names.get(s.subject);
      const who = n ? n.names.join(' & ') : s.subject;
      const school = n?.school ? ` (${n.school})` : '';
      console.log(
        `${String(i + 1).padStart(3)}.  ${String(Math.round(conservative(s.rating))).padStart(4)}` +
          `    ${String(Math.round(s.rating.rating)).padStart(4)}  ` +
          `+/-${String(Math.round(s.rating.deviation)).padStart(3)}   ` +
          `${String(s.rounds).padStart(3)}   ${who}${school}`,
      );
    });

    // A deviation still at the default means the season taught us nothing about
    // that partnership, which is worth knowing before anything gets published.
    const unrated = standings.filter((s) => s.rating.deviation >= DEFAULT_DEVIATION - 1).length;
    if (unrated > 0) console.log(`\n${unrated} partnerships remain at the default deviation`);
  } finally {
    await close();
  }
}

await main();
