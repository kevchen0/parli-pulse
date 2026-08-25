/**
 * Does the rating beat knowing the Article XXI points?
 *
 * That is the whole question. A Glicko-2 number is only worth putting on the
 * site if it predicts results better than the ranking the league already
 * publishes; if it does not, the honest finding is that season points already
 * carry the information, and it should be reported rather than tuned away.
 * plan/05-metrics.md commits to that in advance.
 *
 * The season is cut three ways, not two:
 *
 *  - **train** (through December) fits every model's parameters,
 *  - **dev** (January) chooses between rating variants,
 *  - **test** (February onward) is touched exactly once, at the end.
 *
 * Choosing the variant on the same rounds that report the result is how a
 * tuning exercise gets mistaken for a validation. The dev split exists so the
 * final number is honest about a choice having been made.
 *
 * Every model walks forward: it predicts a tournament, then learns from it,
 * which is what the site would actually do. Baselines get the same treatment
 * and the same fitted form, so the comparison is against the best version of
 * "higher points wins" rather than a straw one.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import { weightedTotal } from '../packages/rules/src/index.ts';
import {
  DEFAULT_OPTIONS,
  type RatedRound,
  type RatingPeriod,
  SeasonRun,
  type SeasonOptions,
  estimateSideAdvantage,
  winProbability,
} from '../packages/rating/src/index.ts';
import { loadDebatersByEntry, partnershipKey } from './lib/identity.ts';
import { loadRatingData } from './lib/rating-data.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const DEV_FROM = process.env.DEV_FROM ?? '2026-01-01';
const TEST_FROM = process.env.TEST_FROM ?? '2026-02-01';
/** Rounds a partnership needs before it would appear on a public board. */
const GATE_ROUNDS = Number(process.env.GATE_ROUNDS ?? 10);

// --- Scoring ---------------------------------------------------------------

interface Prediction {
  /** Probability the model gave to the team that actually won. */
  p: number;
  /** Rounds each side had behind it when the prediction was made. */
  minRounds: number;
  kind: 'prelim' | 'elim';
}

interface Score {
  n: number;
  accuracy: number;
  logLoss: number;
  brier: number;
}

function score(predictions: readonly Prediction[]): Score {
  if (predictions.length === 0) return { n: 0, accuracy: NaN, logLoss: NaN, brier: NaN };
  let correct = 0;
  let logLoss = 0;
  let brier = 0;
  for (const { p } of predictions) {
    // A model that refuses to choose gets half a mark, not a free one.
    correct += p > 0.5 ? 1 : p === 0.5 ? 0.5 : 0;
    const clamped = Math.min(1 - 1e-12, Math.max(1e-12, p));
    logLoss -= Math.log(clamped);
    brier += (1 - p) ** 2;
  }
  const n = predictions.length;
  return { n, accuracy: correct / n, logLoss: logLoss / n, brier: brier / n };
}

// --- Logistic fit ----------------------------------------------------------

/**
 * Two-feature logistic regression by Newton-Raphson.
 *
 * Every baseline needs a way to turn its statistic into a probability, and
 * giving each one a fitted curve rather than a hand-picked one is what makes
 * the comparison fair: the points baseline should lose, if it loses, because
 * points carry less information, not because nobody calibrated them.
 */
function fitLogistic(rows: readonly { x: readonly number[]; y: number }[]): number[] {
  const k = (rows[0]?.x.length ?? 0) + 1;
  let beta = new Array<number>(k).fill(0);
  if (rows.length < k * 10) return beta;

  for (let iter = 0; iter < 50; iter++) {
    const grad = new Array<number>(k).fill(0);
    const hess = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (const row of rows) {
      const x = [1, ...row.x];
      let z = 0;
      for (let i = 0; i < k; i++) z += beta[i]! * x[i]!;
      const p = 1 / (1 + Math.exp(-z));
      const w = Math.max(1e-9, p * (1 - p));
      for (let i = 0; i < k; i++) {
        grad[i]! += (row.y - p) * x[i]!;
        for (let j = 0; j < k; j++) hess[i]![j]! += w * x[i]! * x[j]!;
      }
    }
    // Ridge term, so a feature that never varies cannot make the matrix singular.
    for (let i = 0; i < k; i++) hess[i]![i]! += 1e-6;
    const step = solve(hess, grad);
    if (!step) break;
    let moved = 0;
    for (let i = 0; i < k; i++) {
      beta[i]! += step[i]!;
      moved = Math.max(moved, Math.abs(step[i]!));
    }
    if (moved < 1e-9) break;
  }
  return beta;
}

/** Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

const logistic = (beta: readonly number[], x: readonly number[]): number => {
  let z = beta[0] ?? 0;
  for (let i = 0; i < x.length; i++) z += (beta[i + 1] ?? 0) * x[i]!;
  return 1 / (1 + Math.exp(-z));
};

// --- Models ----------------------------------------------------------------

interface Model {
  name: string;
  /** Probability that `round.a` wins. */
  predict(round: RatedRound, date: string): number;
  observe(period: RatingPeriod): void;
  /** Features the model would fit on, exposed so fitting can walk forward too. */
  features?(round: RatedRound, date: string): number[];
  setBeta?(beta: number[]): void;
}

/**
 * Rounds each partnership has debated so far, kept by the harness rather than
 * by any model.
 *
 * The minimum-rounds slice asks how the models do once there is real evidence
 * about both teams, so every model has to be judged on the same rounds. Letting
 * each one report its own notion of evidence produced slices of 2, 516 and
 * 2209 rounds and three numbers that could not be compared.
 */
class RoundCounter {
  private readonly seen = new Map<string, number>();
  before(round: RatedRound): number {
    return Math.min(this.seen.get(round.a) ?? 0, this.seen.get(round.b) ?? 0);
  }
  observe(period: RatingPeriod): void {
    for (const round of period.rounds) {
      for (const s of [round.a, round.b]) this.seen.set(s, (this.seen.get(s) ?? 0) + 1);
    }
  }
}

const sideFeature = (round: RatedRound): number => (round.sideA === 1 ? 1 : -1);
const aWon = (round: RatedRound): number => (2 * round.wonA > round.ballots ? 1 : 0);

/** Nothing is known and nothing is claimed. The floor any model must clear. */
class CoinFlip implements Model {
  name = 'coin flip';
  predict(): number { return 0.5; }
  observe(): void {}
}

/** Side alone. Opposition wins 52.4% of decided open rounds. */
class SideOnly implements Model {
  name = 'side only';
  private beta: number[] = [0, 0];
  predict(round: RatedRound): number { return logistic(this.beta, [sideFeature(round)]); }
  features(round: RatedRound): number[] { return [sideFeature(round)]; }
  setBeta(beta: number[]): void { this.beta = beta; }
  observe(): void {}
}

/**
 * The gate: the league's own ranking, as a predictor.
 *
 * Season points to date, weighted by XXI.7.A exactly as the standings are, so
 * this is the number a reader could look up on the day of the round. It is not
 * a weak baseline -- strong teams break, and breaking is what earns points --
 * which is the reason it is the bar.
 */
class ArticleXxiPoints implements Model {
  name = 'Article XXI points';
  private beta: number[] = [0, 0, 0];
  private readonly earned = new Map<string, number[]>();

  private readonly pointsAt: Map<string, Map<string, number>>;

  constructor(pointsAt: Map<string, Map<string, number>>) {
    this.pointsAt = pointsAt;
  }

  private total(subject: string): number {
    return weightedTotal(this.earned.get(subject) ?? []);
  }

  features(round: RatedRound): number[] {
    return [(this.total(round.a) - this.total(round.b)) / 10, sideFeature(round)];
  }
  predict(round: RatedRound, date: string): number {
    return logistic(this.beta, this.features(round, date));
  }
  setBeta(beta: number[]): void { this.beta = beta; }
  observe(period: RatingPeriod): void {
    const earnedHere = this.pointsAt.get(period.id);
    if (!earnedHere) return;
    for (const [subject, points] of earnedHere) {
      (this.earned.get(subject) ?? this.earned.set(subject, []).get(subject)!).push(points);
    }
  }
}

/**
 * Win rate to date, shrunk toward even.
 *
 * A cruder summary of the same season than points -- it ignores who the wins
 * came against and what stage they came at -- and included because it separates
 * "the rating beats the league's ranking" from "the rating beats knowing
 * anything at all about the season".
 */
class WinRate implements Model {
  name = 'season win rate';
  private beta: number[] = [0, 0, 0];
  private readonly record = new Map<string, { w: number; n: number }>();
  /** Rounds of imaginary even record, so a 1-0 team is not rated unbeatable. */
  private static readonly PRIOR = 4;

  private rate(subject: string): number {
    const r = this.record.get(subject) ?? { w: 0, n: 0 };
    return (r.w + WinRate.PRIOR / 2) / (r.n + WinRate.PRIOR);
  }
  features(round: RatedRound): number[] {
    return [this.rate(round.a) - this.rate(round.b), sideFeature(round)];
  }
  predict(round: RatedRound): number { return logistic(this.beta, this.features(round)); }
  setBeta(beta: number[]): void { this.beta = beta; }
  observe(period: RatingPeriod): void {
    for (const round of period.rounds) {
      const won = aWon(round);
      for (const [subject, w] of [[round.a, won], [round.b, 1 - won]] as const) {
        const r = this.record.get(subject) ?? { w: 0, n: 0 };
        r.w += w;
        r.n += 1;
        this.record.set(subject, r);
      }
    }
  }
}

/** Glicko-2 on partnerships, under one particular set of options. */
class GlickoModel implements Model {
  readonly name: string;
  readonly run: SeasonRun;

  constructor(
    name: string,
    options: Partial<SeasonOptions>,
    members: ReadonlyMap<string, readonly string[]>,
  ) {
    this.name = name;
    this.run = new SeasonRun(options);
    for (const [subject, m] of members) this.run.declareMembers(subject, m);
  }
  predict(round: RatedRound, date: string): number {
    const a = this.run.ratingAt(round.a, date);
    const b = this.run.ratingAt(round.b, date);
    const adv = round.sideA === 1
      ? this.run.options.sideAdvantage
      : -this.run.options.sideAdvantage;
    return winProbability(a, b, adv);
  }
  observe(period: RatingPeriod): void { this.run.runPeriod(period); }
}

// --- Harness ---------------------------------------------------------------

/**
 * Fits any model that wants a logistic, by walking the fitting periods forward
 * and collecting each round's features as they stood before it was debated.
 * A model fitted on features computed after the fact would be reading the
 * answers.
 */
function fit(model: Model, periods: readonly RatingPeriod[]): void {
  if (!model.features || !model.setBeta) {
    for (const p of periods) model.observe(p);
    return;
  }
  const rows: { x: number[]; y: number }[] = [];
  for (const p of periods) {
    for (const round of p.rounds) rows.push({ x: model.features(round, p.date), y: aWon(round) });
    model.observe(p);
  }
  model.setBeta(fitLogistic(rows));
}

function evaluate(
  model: Model,
  periods: readonly RatingPeriod[],
  counter: RoundCounter,
): Prediction[] {
  const out: Prediction[] = [];
  for (const p of periods) {
    for (const round of p.rounds) {
      const pa = model.predict(round, p.date);
      const won = aWon(round);
      out.push({ p: won === 1 ? pa : 1 - pa, minRounds: counter.before(round), kind: round.kind });
    }
    model.observe(p);
    counter.observe(p);
  }
  return out;
}

/** A counter warmed on the same periods a model was fitted on. */
function counterOver(periods: readonly RatingPeriod[]): RoundCounter {
  const c = new RoundCounter();
  for (const p of periods) c.observe(p);
  return c;
}

/**
 * How much of a gap between two models is real.
 *
 * Both models predicted the same rounds, so the comparison is paired: the
 * bootstrap resamples rounds and re-scores both together, which keeps whatever
 * a hard weekend did to everyone from counting as evidence either way. Reported
 * because a two-point accuracy gap over two thousand rounds is worth a moment's
 * doubt before it goes in a plan document.
 */
function pairedInterval(
  a: readonly Prediction[],
  b: readonly Prediction[],
  metric: (p: readonly Prediction[]) => number,
  draws = 2000,
): { lo: number; hi: number; pWorse: number } {
  const n = a.length;
  if (n === 0 || b.length !== n) return { lo: NaN, hi: NaN, pWorse: NaN };
  const diffs: number[] = [];
  let worse = 0;
  // A fixed seed, so rerunning the validation does not quietly move the number.
  let seed = 0x2545f491;
  const rand = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  for (let d = 0; d < draws; d++) {
    const sa: Prediction[] = [];
    const sb: Prediction[] = [];
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rand() * n);
      sa.push(a[k]!);
      sb.push(b[k]!);
    }
    const diff = metric(sa) - metric(sb);
    diffs.push(diff);
    if (diff <= 0) worse += 1;
  }
  diffs.sort((x, y) => x - y);
  return {
    lo: diffs[Math.floor(draws * 0.025)]!,
    hi: diffs[Math.floor(draws * 0.975)]!,
    pWorse: worse / draws,
  };
}

const pct = (x: number): string => (Number.isNaN(x) ? '   -  ' : `${(x * 100).toFixed(1)}%`);
const num = (x: number): string => (Number.isNaN(x) ? '  -   ' : x.toFixed(4));

function report(title: string, rows: { name: string; predictions: Prediction[] }[]): void {
  console.log(`\n${title}`);
  console.log('  model                      n      acc     log loss   brier');
  console.log('  ' + '-'.repeat(60));
  for (const r of rows) {
    const s = score(r.predictions);
    console.log(
      `  ${r.name.padEnd(24)} ${String(s.n).padStart(5)}   ${pct(s.accuracy)}    ${num(s.logLoss)}   ${num(s.brier)}`,
    );
  }
}

// --- Article XXI points per partnership per tournament ---------------------

/**
 * What each partnership earned at each tournament, so the points baseline can
 * be rebuilt as of any date.
 *
 * Goes through the same identity map as everything else. A baseline keyed on
 * surnames would collapse two Menlo partnerships eighty points apart and then
 * lose to the rating for a reason that has nothing to do with rating.
 */
async function loadPointsByPeriod(
  db: ReturnType<typeof createDb>['db'],
  season: string,
): Promise<Map<string, Map<string, number>>> {
  const rows = await db
    .select({
      entryId: t.entryResults.entryId,
      points: t.entryResults.points,
      tournamentId: t.events.tournamentId,
    })
    .from(t.entryResults)
    .innerJoin(t.entries, eq(t.entries.id, t.entryResults.entryId))
    .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
    .innerJoin(t.tournaments, eq(t.tournaments.id, t.events.tournamentId))
    .where(and(eq(t.tournaments.seasonId, season), isNull(t.entryResults.excludedReason)));

  const debatersByEntry = await loadDebatersByEntry(db);
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = partnershipKey(debatersByEntry.get(r.entryId) ?? []);
    if (!key) continue;
    const byTournament = out.get(r.tournamentId) ?? new Map<string, number>();
    // A partnership entering twice at one tournament counts its better result;
    // XXI.7.A weights one figure per tournament.
    byTournament.set(key, Math.max(byTournament.get(key) ?? 0, r.points));
    out.set(r.tournamentId, byTournament);
  }
  return out;
}

// --- Main ------------------------------------------------------------------

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    const data = await loadRatingData(db, SEASON);
    const pointsByPeriod = await loadPointsByPeriod(db, SEASON);

    const train = data.periods.filter((p) => p.date < DEV_FROM);
    const dev = data.periods.filter((p) => p.date >= DEV_FROM && p.date < TEST_FROM);
    const test = data.periods.filter((p) => p.date >= TEST_FROM);
    const rounds = (ps: readonly RatingPeriod[]): number =>
      ps.reduce((n, p) => n + p.rounds.length, 0);

    console.log(`season ${SEASON}: ${data.rounds.length} rated rounds over ${data.periods.length} tournaments`);
    console.log(`  partnerships ${data.members.size}`);
    console.log(`  skipped: ${Object.entries(data.skipped).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`\nsplit  train <${DEV_FROM}: ${train.length} tournaments, ${rounds(train)} rounds`);
    console.log(`       dev   <${TEST_FROM}: ${dev.length} tournaments, ${rounds(dev)} rounds`);
    console.log(`       test  >=${TEST_FROM}: ${test.length} tournaments, ${rounds(test)} rounds`);

    // Fitted on training rounds only, so the test split never informs it.
    const trainRounds = train.flatMap((p) => p.rounds);
    const sideAdvantage = estimateSideAdvantage(trainRounds);
    console.log(`\nside advantage fitted on train: ${sideAdvantage.toFixed(1)} rating points to proposition`);

    // --- Choose a variant on dev, never on test ---
    //
    // Two stages, so the table stays readable: first what the rating is made of,
    // then how much room a new partnership is given. `tau` is not swept. It was
    // checked and it barely moves anything -- with rating periods this short the
    // volatility hardly has time to change -- so it stays at the package
    // default rather than padding the table with identical rows.
    const evalVariant = (name: string, options: Partial<SeasonOptions>): { name: string; options: Partial<SeasonOptions>; s: Score } => {
      const model = new GlickoModel(name, options, data.members);
      fit(model, train);
      return { name, options, s: score(evaluate(model, dev, counterOver(train))) };
    };

    const stage1: { name: string; options: Partial<SeasonOptions> }[] = [];
    for (const marginWeight of [0, 0.5, 1]) {
      for (const seedFromMembers of [true, false]) {
        for (const side of [sideAdvantage, 0]) {
          stage1.push({
            name: `margin ${marginWeight}, ${seedFromMembers ? 'seeded' : 'cold'}, ${side ? 'side' : 'no side'}`,
            options: { marginWeight, seedFromMembers, sideAdvantage: side },
          });
        }
      }
    }

    const showVariants = (title: string, rows: { name: string; s: Score }[]): void => {
      console.log(`\n${title}`);
      console.log('  variant                                 acc     log loss');
      console.log('  ' + '-'.repeat(58));
      for (const v of rows) {
        console.log(`  ${v.name.padEnd(36)} ${pct(v.s.accuracy)}    ${num(v.s.logLoss)}`);
      }
    };

    const ranked = stage1
      .map((v) => evalVariant(v.name, v.options))
      .sort((a, b) => a.s.logLoss - b.s.logLoss);
    showVariants('variant selection on dev (fitted on train):', ranked);
    const best = ranked[0]!;

    let chosen = best;
    if (best.options.seedFromMembers) {
      const sweep = [60, 90, 120, 180, 250]
        .map((pairingDeviation) =>
          evalVariant(`${best.name}, pairing RD ${pairingDeviation}`, {
            ...best.options,
            pairingDeviation,
          }),
        )
        .sort((a, b) => a.s.logLoss - b.s.logLoss);
      showVariants('new-partnership deviation, on dev:', sweep);
      chosen = sweep[0]!;
    }
    console.log(`\nchosen: ${chosen.name}`);

    // --- The held-out test, run once ---
    const fitting = [...train, ...dev];
    const models: Model[] = [
      new CoinFlip(),
      new SideOnly(),
      new WinRate(),
      new ArticleXxiPoints(pointsByPeriod),
      new GlickoModel('Glicko-2', chosen.options, data.members),
    ];
    const results = models.map((m) => {
      fit(m, fitting);
      return { name: m.name, predictions: evaluate(m, test, counterOver(fitting)) };
    });

    report(`held-out test, ${TEST_FROM} onward`, results);
    report(
      `... rounds where both teams had ${GATE_ROUNDS}+ prior rounds`,
      results.map((r) => ({
        name: r.name,
        predictions: r.predictions.filter((p) => p.minRounds >= GATE_ROUNDS),
      })),
    );
    report(
      '... rounds where either team had fewer',
      results.map((r) => ({
        name: r.name,
        predictions: r.predictions.filter((p) => p.minRounds < GATE_ROUNDS),
      })),
    );
    report(
      '... elimination rounds only',
      results.map((r) => ({
        name: r.name,
        predictions: r.predictions.filter((p) => p.kind === 'elim'),
      })),
    );

    const glickoP = results.at(-1)!.predictions;
    const pointsP = results.find((r) => r.name === 'Article XXI points')!.predictions;
    const glicko = score(glickoP);
    const points = score(pointsP);
    const accGap = pairedInterval(glickoP, pointsP, (p) => score(p).accuracy);
    const llGap = pairedInterval(pointsP, glickoP, (p) => score(p).logLoss);

    console.log(
      `\nverdict: Glicko-2 ${glicko.accuracy > points.accuracy ? 'beats' : 'does not beat'} Article XXI points` +
        ` on accuracy (${pct(glicko.accuracy)} vs ${pct(points.accuracy)})` +
        ` and ${glicko.logLoss < points.logLoss ? 'beats' : 'does not beat'} it on log loss` +
        ` (${num(glicko.logLoss)} vs ${num(points.logLoss)}).`,
    );
    console.log(
      `  accuracy gap ${pct(glicko.accuracy - points.accuracy)}` +
        ` (95% ${pct(accGap.lo)} to ${pct(accGap.hi)}, paired bootstrap;` +
        ` points ahead in ${pct(accGap.pWorse)} of draws)`,
    );
    console.log(
      `  log loss gap ${num(points.logLoss - glicko.logLoss)}` +
        ` (95% ${num(llGap.lo)} to ${num(llGap.hi)};` +
        ` points ahead in ${pct(llGap.pWorse)} of draws)`,
    );
  } finally {
    await close();
  }
}

await main();
