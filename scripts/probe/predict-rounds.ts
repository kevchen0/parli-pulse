/**
 * Predicts every round at named tournaments, using only what was known before
 * each one started.
 *
 * The season backtest in scripts/validate-rating.ts answers "is the rating worth
 * publishing" over thousands of rounds. This answers a different question: how
 * does it do at *this* tournament, round by round, against opponents a reader
 * recognises. A tournament is a rating period, so the whole of it is predicted
 * from the ratings held on the morning of day one and none of its own results
 * leak into its own predictions.
 *
 * Predictions use the raw rating, never the shrunk one. `winProbability` already
 * widens toward a coin flip when either side is unsettled; shrinking the estimate
 * as well counts the same uncertainty twice and measurably predicts worse.
 *
 *   TOURNAMENTS="NPDL-TOC,MLK Logan" npm run predict
 */
import { and, eq, isNull } from 'drizzle-orm';
import { createDb } from '../../packages/db/src/client.ts';
import * as t from '../../packages/db/src/schema.ts';
import { weightedTotal } from '../../packages/rules/src/index.ts';
import { loadDebatersByEntry, partnershipKey } from '../lib/identity.ts';
import {
  VALIDATED_OPTIONS,
  SeasonRun,
  estimateSideAdvantage,
  winProbability,
  type RatedRound,
} from '../../packages/rating/src/index.ts';
import { loadRatingData } from '../lib/rating-data.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const TARGETS = (process.env.TOURNAMENTS ?? 'Notre Dame,La Costa Canyon,MLK Logan,NPDL-TOC')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

interface Shot {
  /** Probability given to the side that actually won. */
  p: number;
  favourite: number;
  kind: 'prelim' | 'elim';
  /** Rounds behind the less-experienced of the two, before this tournament. */
  evidence: number;
  /**
   * Did the partnership with more Article XXI points to date win? 0.5 when they
   * were level, which at these tournaments is usually two teams on nothing.
   */
  pointsCall: number;
}

function summarise(shots: readonly Shot[]) {
  if (shots.length === 0) return null;
  let hit = 0;
  let logLoss = 0;
  let brier = 0;
  for (const s of shots) {
    hit += s.p > 0.5 ? 1 : s.p === 0.5 ? 0.5 : 0;
    logLoss -= Math.log(Math.min(1 - 1e-12, Math.max(1e-12, s.p)));
    brier += (1 - s.p) ** 2;
  }
  const n = shots.length;
  return {
    n,
    acc: hit / n,
    logLoss: logLoss / n,
    brier: brier / n,
    // What accuracy the stated probabilities themselves imply, if perfectly
    // calibrated. Above the observed figure means the model was overconfident.
    implied: shots.reduce((t, s) => t + s.favourite, 0) / n,
  };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const row = (label: string, s: ReturnType<typeof summarise>) =>
  s === null
    ? `  ${label.padEnd(26)}      -`
    : `  ${label.padEnd(26)} ${String(s.n).padStart(4)}   ${pct(s.acc).padStart(6)}   ` +
      `${pct(s.implied).padStart(6)}   ${s.logLoss.toFixed(4)}   ${s.brier.toFixed(4)}`;

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    const data = await loadRatingData(db, SEASON);
    const nameOf = (id: string) => data.tournamentNames.get(id) ?? id;
    const matches = (id: string) => {
      const n = nameOf(id).toLowerCase();
      return TARGETS.some((t) => n.includes(t));
    };
    const targets = data.periods.filter((p) => matches(p.id));
    if (targets.length === 0) {
      console.log(`no tournaments matched: ${TARGETS.join(', ')}`);
      return;
    }

    // Article XXI points as of each tournament, under the XXI.7.A weighting, so
    // the comparison is with the standing a reader could have looked up that
    // morning rather than the final one.
    const scored = await db
      .select({
        entryId: t.entryResults.entryId,
        points: t.entryResults.points,
        tournamentId: t.events.tournamentId,
      })
      .from(t.entryResults)
      .innerJoin(t.entries, eq(t.entries.id, t.entryResults.entryId))
      .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
      .innerJoin(t.tournaments, eq(t.tournaments.id, t.events.tournamentId))
      .where(and(eq(t.tournaments.seasonId, SEASON), isNull(t.entryResults.excludedReason)));
    const debatersByEntry = await loadDebatersByEntry(db);
    const earnedAt = new Map<string, Map<string, number>>();
    for (const r of scored) {
      const key = partnershipKey(debatersByEntry.get(r.entryId) ?? []);
      if (!key) continue;
      const at = earnedAt.get(r.tournamentId) ?? new Map<string, number>();
      at.set(key, Math.max(at.get(key) ?? 0, r.points));
      earnedAt.set(r.tournamentId, at);
    }
    const earned = new Map<string, number[]>();
    const pointsFor = (k: string) => weightedTotal(earned.get(k) ?? []);

    const run = new SeasonRun(VALIDATED_OPTIONS);
    for (const [subject, members] of data.members) run.declareMembers(subject, members);

    // Rounds behind each partnership, kept by the harness so "evidence" means
    // the same thing for every tournament.
    const seen = new Map<string, number>();
    const before = (r: RatedRound) => Math.min(seen.get(r.a) ?? 0, seen.get(r.b) ?? 0);

    const history: RatedRound[] = [];
    const byTournament = new Map<string, Shot[]>();

    for (const period of data.periods) {
      if (matches(period.id)) {
        // The side advantage as it could have been estimated that morning.
        const side = history.length > 500 ? estimateSideAdvantage(history) : 0;
        const shots: Shot[] = [];
        for (const r of period.rounds) {
          const a = run.ratingAt(r.a, period.date);
          const b = run.ratingAt(r.b, period.date);
          const adv = r.sideA === 1 ? side : -side;
          const pa = winProbability(a, b, adv);
          const aWon = 2 * r.wonA > r.ballots;
          const gap = pointsFor(r.a) - pointsFor(r.b);
          shots.push({
            p: aWon ? pa : 1 - pa,
            favourite: Math.max(pa, 1 - pa),
            kind: r.kind,
            evidence: before(r),
            pointsCall: gap === 0 ? 0.5 : (gap > 0) === aWon ? 1 : 0,
          });
        }
        byTournament.set(period.id, shots);
      }
      run.runPeriod(period);
      for (const [k, pts] of earnedAt.get(period.id) ?? []) {
        (earned.get(k) ?? earned.set(k, []).get(k)!).push(pts);
      }
      for (const r of period.rounds) {
        history.push(r);
        for (const k of [r.a, r.b]) seen.set(k, (seen.get(k) ?? 0) + 1);
      }
    }

    console.log(`\nEvery round predicted from ratings held before the tournament began.\n`);
    console.log('  tournament                    n      acc   implied   log loss    brier');
    console.log('  ' + '-'.repeat(72));
    const all: Shot[] = [];
    for (const p of targets) {
      const shots = byTournament.get(p.id) ?? [];
      all.push(...shots);
      console.log(row(`${nameOf(p.id)}  ${p.date.slice(0, 7)}`, summarise(shots)));
    }
    console.log('  ' + '-'.repeat(72));
    console.log(row('all four', summarise(all)));

    console.log('\n  by round type and by how much was known:');
    console.log('  ' + '-'.repeat(72));
    console.log(row('prelims', summarise(all.filter((s) => s.kind === 'prelim'))));
    console.log(row('elims', summarise(all.filter((s) => s.kind === 'elim'))));
    console.log(row('both teams 10+ rounds', summarise(all.filter((s) => s.evidence >= 10))));
    console.log(row('one team under 10', summarise(all.filter((s) => s.evidence < 10))));
    console.log(row('one team never seen', summarise(all.filter((s) => s.evidence === 0))));

    // What the league's own ranking would have called, on the same rounds.
    console.log('\n  against "higher Article XXI points to date wins", same rounds:');
    console.log('  ' + '-'.repeat(72));
    const callRate = (shots: readonly Shot[]) =>
      shots.length === 0 ? '-' : pct(shots.reduce((t, s) => t + s.pointsCall, 0) / shots.length);
    for (const p of targets) {
      const shots = byTournament.get(p.id) ?? [];
      const g = summarise(shots)!;
      console.log(
        `  ${nameOf(p.id).padEnd(26)} ${String(shots.length).padStart(4)}   ` +
          `rating ${pct(g.acc).padStart(6)}   points ${callRate(shots).padStart(6)}   ` +
          `level ${pct(shots.filter((s) => s.pointsCall === 0.5).length / shots.length).padStart(6)}`,
      );
    }
    console.log(
      `  ${'all four'.padEnd(26)} ${String(all.length).padStart(4)}   ` +
        `rating ${pct(summarise(all)!.acc).padStart(6)}   points ${callRate(all).padStart(6)}   ` +
        `level ${pct(all.filter((s) => s.pointsCall === 0.5).length / all.length).padStart(6)}`,
    );

    console.log('\n  calibration over all four:');
    console.log('  stated        rounds    said   actual');
    console.log('  ' + '-'.repeat(40));
    for (const [lo, hi] of [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]] as const) {
      const b = all.filter((s) => s.favourite >= lo && s.favourite < hi);
      if (b.length === 0) continue;
      const said = b.reduce((t, s) => t + s.favourite, 0) / b.length;
      const actual = b.filter((s) => s.p > 0.5).length / b.length;
      console.log(
        `  ${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}%`.padEnd(15) +
          `${String(b.length).padStart(5)}  ${pct(said).padStart(6)}  ${pct(actual).padStart(6)}`,
      );
    }
  } finally {
    await close();
  }
}

await main();
