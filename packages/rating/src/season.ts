/**
 * Runs a season's rounds through Glicko-2 and keeps the history.
 *
 * The unit rated is the **partnership**, not the debater. That is the honest
 * default: a round is won by two people together, and attributing it to each of
 * them separately assumes team strength is the sum of its halves, which is a
 * claim rather than an observation. The cost is sparsity -- nearly half of all
 * partnerships debate fewer than ten rounds -- and this is where that cost is
 * paid down. A partnership appearing for the first time does not start at the
 * default rating; it starts wherever its two debaters' other partnerships have
 * got to, widened for the fact that a new pairing is genuinely a new thing.
 *
 * A rating period is one tournament. Every round inside it is weighed against
 * the ratings its opponents held before the tournament began, which is right:
 * the teams that met in round one had not yet been changed by meeting.
 *
 * Nothing here is written to a database, so the same code runs the live season
 * and the held-out validation in scripts/validate-rating.ts. Two copies of a
 * season computation drifted apart once already -- see plan/10-mistakes.md,
 * pattern G -- and a rating whose validation measures something other than what
 * ships would be worth nothing.
 */
import {
  DEFAULT_DEVIATION,
  DEFAULT_RATING,
  DEFAULT_TAU,
  DEFAULT_VOLATILITY,
  type Opponent,
  type Rating,
  ballotScore,
  decay,
  defaultRating,
  update,
} from './glicko2.ts';

/** One decided round between two rated subjects. */
export interface RatedRound {
  /** Section id, so a round can be traced back to Tabroom. */
  id: string;
  a: string;
  b: string;
  /** Ballots `a` took, out of the judges who returned one. */
  wonA: number;
  /** Judges who returned a ballot. Not the row count: Tabroom writes one per side. */
  ballots: number;
  /** Tabroom's side numbering: 1 proposition, 2 opposition. */
  sideA: number;
  kind: 'prelim' | 'elim';
}

/** A tournament's worth of rounds, and when it happened. */
export interface RatingPeriod {
  id: string;
  /** ISO date. Used only to measure how long a subject has been away. */
  date: string;
  rounds: RatedRound[];
}

export interface SeasonOptions {
  tau: number;
  /** How far a split panel is pulled toward a draw; 0 ignores the split. */
  marginWeight: number;
  /** Rating points the proposition is worth. Negative when opposition wins more. */
  sideAdvantage: number;
  /** Seed a new partnership from its debaters' other partnerships. */
  seedFromMembers: boolean;
  /**
   * Deviation added when seeding a new partnership, standing for whatever a
   * pairing is beyond the two people in it. Without it a new team would inherit
   * its members' certainty along with their rating.
   */
  pairingDeviation: number;
  maxDeviation: number;
  /** Deviation growth for a subject that has not competed, per week away. */
  weeksPerDecayPeriod: number;
}

/**
 * Plain Glicko-2: no side correction, no margin grading, every partnership
 * starting cold. The base the additions are measured against, not the
 * configuration that ships -- that is `VALIDATED_OPTIONS`.
 */
export const DEFAULT_OPTIONS: SeasonOptions = {
  tau: DEFAULT_TAU,
  marginWeight: 0,
  sideAdvantage: 0,
  seedFromMembers: true,
  pairingDeviation: 120,
  maxDeviation: DEFAULT_DEVIATION,
  weeksPerDecayPeriod: 1,
};

/**
 * The configuration chosen on held-out data, and the reason for each departure
 * from the plain system above.
 *
 * Selected on January 2025-26 (the dev split) and then measured once on
 * February onward, where it predicted 63.4% of 2,209 rounds against 61.2% for
 * the league's own Article XXI ranking, at a log loss of 0.638 against 0.665.
 * The accuracy gap is 2.2 points, 95% interval 0.0 to 4.3 on a paired
 * bootstrap; the log loss gap is the surer of the two and never reversed in
 * two thousand resamples. scripts/validate-rating.ts reproduces all of it.
 *
 *  - `marginWeight: 1` -- grading split panels was worth 0.0015 of log loss on
 *    dev. Small, and free.
 *  - `seedFromMembers` -- worth 0.008, five times the rest put together, and
 *    the single reason this configuration is not plain Glicko-2. Sparsity is
 *    the binding constraint on this data and starting a new partnership from
 *    what its debaters have already shown is the only thing that relieves it.
 *  - `pairingDeviation: 180` -- swept from 60 to 250. The curve is flat above
 *    120 and falls away below it, which says the same thing the seeding does:
 *    the danger is being too sure of a new pairing, not too unsure.
 *
 * `sideAdvantage` is left at zero here because it is not a constant: it is read
 * off the season being rated, around -17 rating points on 2025-26. It was worth
 * 0.0007 of log loss on dev -- real, and the smallest of the three.
 *
 * `tau` is not tuned. It was swept and moves nothing at four decimal places --
 * with rating periods one tournament long the volatility barely has time to
 * change -- so it stays where Glickman put it.
 */
export const VALIDATED_OPTIONS: SeasonOptions = {
  ...DEFAULT_OPTIONS,
  marginWeight: 1,
  seedFromMembers: true,
  pairingDeviation: 180,
};

/**
 * Rounds a partnership needs before it belongs on a public board.
 *
 * Every partnership gets a rating and a deviation; this decides only who is
 * ranked on one. Nearly half the field debates fewer than ten open rounds in a
 * season, and below that the deviation is doing most of the talking.
 *
 * Exported rather than written in two places: the script that computes ratings
 * and the page that shows them have to agree, or the site quietly ranks
 * partnerships the pipeline considered unrated.
 */
export const MIN_RATED_ROUNDS = 10;

/** A subject's rating plus the evidence behind it. */
export interface SubjectState {
  rating: Rating;
  rounds: number;
  periods: number;
  /** ISO date of the last period the subject competed in. */
  lastDate: string;
}

/** One subject's rating as it stood after one rating period. */
export interface Snapshot {
  subject: string;
  periodId: string;
  date: string;
  rating: number;
  deviation: number;
  volatility: number;
  rounds: number;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const weeksBetween = (from: string, to: string): number => {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (b - a) / MS_PER_WEEK);
};

/**
 * Tracks each subject's rating, and each debater's, through the season.
 *
 * The debater figures are a by-product: the precision-weighted average of the
 * partnerships a debater has competed in, used only to seed their next
 * partnership. They are not a debater rating and must not be published as one
 * -- a debater who has only ever partnered one person just gets that
 * partnership's number back.
 */
export class SeasonRun {
  readonly options: SeasonOptions;
  readonly subjects = new Map<string, SubjectState>();
  readonly history: Snapshot[] = [];
  /** Subject key -> the debaters in it. */
  private readonly members = new Map<string, readonly string[]>();
  private readonly debaters = new Map<string, Rating>();
  /** Subjects each debater has competed in, for the debater average. */
  private readonly debaterSubjects = new Map<string, Set<string>>();

  constructor(options: Partial<SeasonOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Registers who is in a partnership, before any of its rounds are seen. */
  declareMembers(subject: string, members: readonly string[]): void {
    this.members.set(subject, members);
  }

  /**
   * The subject's rating brought forward to `date`.
   *
   * Deviation is widened lazily rather than at every period boundary, because
   * three tournaments can share one weekend and a subject that skipped all
   * three has been away for one week, not three periods.
   */
  ratingAt(subject: string, date: string): Rating {
    const s = this.subjects.get(subject);
    if (!s) return this.seed(subject);
    const weeks = weeksBetween(s.lastDate, date);
    if (weeks <= 0) return s.rating;
    return decay(s.rating, weeks / this.options.weeksPerDecayPeriod, this.options.maxDeviation);
  }

  /** Rounds this subject has been rated on. */
  roundsFor(subject: string): number {
    return this.subjects.get(subject)?.rounds ?? 0;
  }

  /** Every subject that has ever competed, with its rating brought to `date`. */
  standingsAt(date: string): { subject: string; rating: Rating; rounds: number; periods: number }[] {
    return [...this.subjects].map(([subject, s]) => ({
      subject,
      rating: this.ratingAt(subject, date),
      rounds: s.rounds,
      periods: s.periods,
    }));
  }

  /**
   * The rating a partnership starts at.
   *
   * A strong debater with a new partner should not be reset to the default, so
   * the pair starts at the average of what their debaters have shown elsewhere,
   * an unrated partner counting as an average one.
   *
   * The deviation needs more care than the rating. Averaging two estimates
   * makes the average more precise than either, which is true of two readings
   * of one quantity and false here: a pair is not the mean of its debaters, it
   * only tends to be, and the gap between those is what `pairingDeviation`
   * stands for. So the seed is never surer than the better-known of the two
   * debaters behind it, and never surer than the default when neither is known
   * at all -- averaging two blanks must not produce a number.
   */
  private seed(subject: string): Rating {
    if (!this.options.seedFromMembers) return defaultRating();
    const members = this.members.get(subject) ?? [];
    const known = members.map((m) => this.debaters.get(m)).filter((p): p is Rating => Boolean(p));
    if (known.length === 0) return defaultRating();

    // An unrated member contributes the default at full uncertainty rather than
    // being dropped: not knowing half a partnership is information about the
    // partnership, and should widen it.
    const priors = members.map((m) => this.debaters.get(m) ?? defaultRating());
    const rating = priors.reduce((a, p) => a + p.rating, 0) / priors.length;
    const meanSpread =
      Math.sqrt(priors.reduce((a, p) => a + p.deviation ** 2, 0)) / priors.length;
    const floor = Math.min(...known.map((p) => p.deviation));
    const deviation = Math.min(
      this.options.maxDeviation,
      Math.hypot(Math.max(meanSpread, floor), this.options.pairingDeviation),
    );
    const volatility = known.reduce((a, p) => a + p.volatility, 0) / known.length;
    return { rating, deviation, volatility };
  }

  /**
   * Runs one tournament.
   *
   * Every subject's opponents are collected first and applied afterwards, so no
   * result inside the tournament is judged against a rating the tournament
   * itself produced.
   */
  runPeriod(period: RatingPeriod): void {
    const { marginWeight, sideAdvantage, tau, maxDeviation } = this.options;

    const before = new Map<string, Rating>();
    const at = (subject: string): Rating => {
      let r = before.get(subject);
      if (!r) {
        r = this.ratingAt(subject, period.date);
        before.set(subject, r);
      }
      return r;
    };

    const schedule = new Map<string, Opponent[]>();
    const roundCount = new Map<string, number>();
    const push = (subject: string, o: Opponent): void => {
      (schedule.get(subject) ?? schedule.set(subject, []).get(subject)!).push(o);
      roundCount.set(subject, (roundCount.get(subject) ?? 0) + 1);
    };

    for (const round of period.rounds) {
      const ra = at(round.a);
      const rb = at(round.b);
      const scoreA = ballotScore(round.wonA, round.ballots, marginWeight);
      // Tabroom numbers proposition 1 and opposition 2. The advantage is stated
      // for proposition, so the opposition carries its negative.
      const advA = round.sideA === 1 ? sideAdvantage : -sideAdvantage;
      push(round.a, { rating: rb.rating, deviation: rb.deviation, score: scoreA, advantage: advA });
      push(round.b, {
        rating: ra.rating,
        deviation: ra.deviation,
        score: 1 - scoreA,
        advantage: -advA,
      });
    }

    for (const [subject, opponents] of schedule) {
      const prior = this.subjects.get(subject);
      const next = update(at(subject), opponents, { tau, maxDeviation });
      const state: SubjectState = {
        rating: next,
        rounds: (prior?.rounds ?? 0) + (roundCount.get(subject) ?? 0),
        periods: (prior?.periods ?? 0) + 1,
        lastDate: period.date,
      };
      this.subjects.set(subject, state);
      this.history.push({
        subject,
        periodId: period.id,
        date: period.date,
        rating: next.rating,
        deviation: next.deviation,
        volatility: next.volatility,
        rounds: state.rounds,
      });
      for (const m of this.members.get(subject) ?? []) {
        (this.debaterSubjects.get(m) ?? this.debaterSubjects.set(m, new Set()).get(m)!).add(subject);
      }
    }

    this.refreshDebaters(period.date);
  }

  /**
   * Recomputes each debater's working estimate from the partnerships they have
   * competed in, weighted by how sure we are of each.
   *
   * Unlike the seeding above this *is* repeated measurement -- several readings
   * of one debater -- so precision weighting is the right combination and the
   * result is allowed to be more certain than any single partnership.
   */
  private refreshDebaters(date: string): void {
    for (const [debater, subjects] of this.debaterSubjects) {
      let weight = 0;
      let sum = 0;
      let volatility = 0;
      for (const s of subjects) {
        const r = this.ratingAt(s, date);
        const w = 1 / (r.deviation * r.deviation);
        weight += w;
        sum += w * r.rating;
        volatility += r.volatility;
      }
      if (weight === 0) continue;
      this.debaters.set(debater, {
        rating: sum / weight,
        deviation: Math.min(this.options.maxDeviation, Math.sqrt(1 / weight)),
        volatility: volatility / subjects.size,
      });
    }
  }

  /** A debater's working estimate, or null if they have never been rated. */
  debaterEstimate(debater: string): Rating | null {
    return this.debaters.get(debater) ?? null;
  }
}

/** Runs every period in order and hands back the finished run. */
export function runSeason(
  periods: readonly RatingPeriod[],
  members: ReadonlyMap<string, readonly string[]>,
  options: Partial<SeasonOptions> = {},
): SeasonRun {
  const run = new SeasonRun(options);
  for (const [subject, m] of members) run.declareMembers(subject, m);
  for (const p of periods) run.runPeriod(p);
  return run;
}

/**
 * The proposition's edge in rating points, read straight off how often it wins.
 *
 * Sides are assigned by tab rather than chosen, so the two sides face the same
 * distribution of opponents and the raw split needs no adjustment for who drew
 * whom. It comes out around -17 points on the 2025-26 season: opposition wins
 * 52.4% of decided open rounds, and a rating that ignored that would credit the
 * difference to the teams.
 */
export function estimateSideAdvantage(rounds: readonly RatedRound[]): number {
  let prop = 0;
  let total = 0;
  for (const r of rounds) {
    const margin = 2 * r.wonA - r.ballots;
    if (margin === 0) continue;
    const propWon = r.sideA === 1 ? margin > 0 : margin < 0;
    if (propWon) prop += 1;
    total += 1;
  }
  if (total === 0 || prop === 0 || prop === total) return 0;
  const p = prop / total;
  return 173.7178 * Math.log(p / (1 - p));
}

export { DEFAULT_RATING, DEFAULT_DEVIATION, DEFAULT_VOLATILITY };
