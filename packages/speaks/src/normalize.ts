/**
 * Judge-normalized speaker points.
 *
 * A raw speaker score says as much about the judge as the debater: some
 * panels average 28.5 and some 26.0, and a debater's total depends heavily on
 * who they drew. Normalizing within judge removes that.
 *
 * Two things make this harder than a plain z-score.
 *
 * Punitive scores. A sub-scale score is usually an equity sanction under
 * Article XIV. It is a real ballot and belongs in the data, but one 24 in a
 * judge's set would stretch their standard deviation and quietly compress
 * every other debater they ranked. Robust statistics -- a median and an
 * interquartile spread -- keep a single outlier from moving the baseline.
 *
 * Small samples. Most judges work a handful of rounds, where a median is
 * noisy. Each judge's centre and spread are therefore shrunk toward the
 * pool's, in proportion to how little evidence they provide.
 */

export interface Robust {
  centre: number;
  spread: number;
  n: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Quantile by linear interpolation, on an already-sorted copy. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (pos - lo) * (sorted[hi]! - sorted[lo]!);
}

/**
 * Spread as the interquartile range rescaled to be comparable with a standard
 * deviation (for a normal distribution, IQR is about 1.349 sigma). Unlike a
 * standard deviation it barely moves when one score is far from the rest.
 */
export function robustStats(values: readonly number[]): Robust {
  const sorted = [...values].sort((a, b) => a - b);
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  return { centre: median(sorted), spread: iqr / 1.349, n: values.length };
}

/**
 * How much evidence a judge needs before their own baseline is trusted over
 * the pool's. At the default, a judge with 12 ballots sits halfway between.
 */
export const SHRINKAGE_BALLOTS = 12;

/** A floor on spread, so a judge who gave identical scores cannot divide by zero. */
/**
 * Ballots a debater needs before their season figure is ranked.
 *
 * Ten rather than twenty deliberately. A tournament is five prelim ballots at
 * the median -- panels barely move it, at 1.11 ballots per round -- so ten is
 * two tournaments and twenty is four. Gated at twenty a board is empty until
 * months into a season, which is the part of the year people most want to look
 * at it. The interval printed beside every figure says how much to trust it.
 *
 * Measured, not assumed: the comment this replaced said twenty was roughly two
 * tournaments, which was out by a factor of two and had never been checked.
 *
 * A debater below the line keeps every score; the gate decides only who is
 * ranked.
 */
export const MIN_BALLOTS = 10;

export const MIN_SPREAD = 0.35;

export interface Normalizer {
  /** Standard deviations from this judge's own centre. */
  z: (raw: number) => number;
  /** The same value expressed back on the familiar 25-30 scale. */
  display: (raw: number) => number;
  centre: number;
  spread: number;
}

/**
 * Builds a normalizer for one judge against the pool they judged in.
 *
 * Both centre and spread are shrunk, not just the centre: a judge with three
 * ballots can show almost no spread by chance, which would otherwise turn a
 * trivial difference into several standard deviations.
 */
export function judgeNormalizer(judge: Robust, pool: Robust): Normalizer {
  const w = judge.n / (judge.n + SHRINKAGE_BALLOTS);
  const centre = Number.isFinite(judge.centre) ? w * judge.centre + (1 - w) * pool.centre : pool.centre;
  const judgeSpread = Number.isFinite(judge.spread) ? judge.spread : pool.spread;
  const spread = Math.max(MIN_SPREAD, w * judgeSpread + (1 - w) * pool.spread);

  const z = (raw: number): number => (raw - centre) / spread;
  return {
    z,
    // Anchored on the pool so that an average performance reads as an average
    // score, whichever judge happened to be in the room.
    display: (raw: number) => pool.centre + z(raw) * pool.spread,
    centre,
    spread,
  };
}
