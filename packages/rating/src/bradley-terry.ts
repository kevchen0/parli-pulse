/**
 * Bradley-Terry: one strength number per competitor, fitted to the whole season
 * at once.
 *
 * Glicko-2 walks the season forward, and each result is judged only against what
 * was known when it happened. That is the right shape for a live rating and the
 * wrong shape for two problems this league has.
 *
 * **Sparsity.** The penalty is shrinkage: a partnership with six rounds cannot
 * move far from average, without needing a separate gate to say so. That is the
 * same correction `shrinkToField` applies to a Glicko rating, arrived at by a
 * different route, and the two reaching nearly the same top ten is worth more
 * than either alone.
 *
 * It is **not** a fix for pool isolation, though it was built in the belief that
 * it would be. In principle a cluster with few links to the rest of the field is
 * held up only by the penalty; in this data the effect does not appear. Among
 * partnerships with forty rounds or more, the discount relative to Glicko runs
 * -19, -16, -7 and +1 points across rising in-region share -- flat, and if
 * anything sloping the wrong way. See plan/05-metrics.md.
 *
 * The cost is that this is not a rating anyone can narrate -- there is no "they
 * gained 30 points at Berkeley", only a coefficient -- and it has to be refitted
 * from scratch rather than updated. For a season that ends, that is affordable.
 *
 * `subjects` may be partnerships or individual debaters. When a round's side is
 * described by more than one subject, their strengths add, which is what makes
 * the debater-level fit possible: it pools a debater's evidence across every
 * partner they had, and the sparsity that binds this data is exactly the thing
 * pooling relieves.
 */

export interface BradleyTerryRound {
  /** Subject indices making up each side. */
  a: readonly number[];
  b: readonly number[];
  /** 1 if side `a` won, 0 if `b` did, fractional for a graded panel split. */
  score: number;
  /** +1 when `a` was proposition, -1 when opposition. */
  side: number;
}

export interface BradleyTerryFit {
  /** Strength per subject, in log-odds. Zero is the field average. */
  strength: Float64Array;
  /** Log-odds the proposition carries, fitted alongside the strengths. */
  side: number;
  iterations: number;
}

export interface BradleyTerryOptions {
  /**
   * Strength of the pull toward average.
   *
   * This is the whole design. Too little and an isolated pool floats free; too
   * much and everyone converges on the mean. Chosen on held-out rounds, never
   * on the rounds that report the result.
   */
  lambda: number;
  iterations: number;
  /** Step size. Lowered automatically if a step would increase the loss. */
  learningRate: number;
}

export const DEFAULT_BT_OPTIONS: BradleyTerryOptions = {
  lambda: 1.5,
  iterations: 400,
  learningRate: 0.5,
};

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/** Log-odds that side `a` wins, under a given fit. */
export function btLogOdds(
  fit: Pick<BradleyTerryFit, 'strength' | 'side'>,
  a: readonly number[],
  b: readonly number[],
  side: number,
): number {
  let z = fit.side * side;
  for (const i of a) z += fit.strength[i]!;
  for (const i of b) z -= fit.strength[i]!;
  return z;
}

/**
 * Fits by gradient descent with a backtracking step.
 *
 * The objective is convex, so where it converges does not depend on where it
 * starts; plain descent is enough and avoids inverting a matrix the size of the
 * field. The step is halved whenever it would increase the penalised loss, which
 * keeps it stable without needing the learning rate tuned per season.
 */
export function fitBradleyTerry(
  rounds: readonly BradleyTerryRound[],
  subjectCount: number,
  options: Partial<BradleyTerryOptions> = {},
): BradleyTerryFit {
  const { lambda, iterations, learningRate } = { ...DEFAULT_BT_OPTIONS, ...options };
  const strength = new Float64Array(subjectCount);
  let side = 0;
  let rate = learningRate;

  const loss = (s: Float64Array, sd: number): number => {
    let total = 0;
    for (const r of rounds) {
      const z = btLogOdds({ strength: s, side: sd }, r.a, r.b, r.side);
      // The numerically stable form of -[y*log p + (1-y)*log(1-p)].
      total += Math.max(z, 0) - z * r.score + Math.log1p(Math.exp(-Math.abs(z)));
    }
    for (let i = 0; i < s.length; i++) total += lambda * s[i]! * s[i]! * 0.5;
    return total;
  };

  let current = loss(strength, side);
  let iteration = 0;
  const grad = new Float64Array(subjectCount);

  for (; iteration < iterations; iteration++) {
    grad.fill(0);
    let gSide = 0;
    for (const r of rounds) {
      const p = sigmoid(btLogOdds({ strength, side }, r.a, r.b, r.side));
      const g = p - r.score;
      for (const i of r.a) grad[i]! += g;
      for (const i of r.b) grad[i]! -= g;
      gSide += g * r.side;
    }
    for (let i = 0; i < subjectCount; i++) grad[i]! += lambda * strength[i]!;

    // Backtrack until the step actually helps, so a rate that is too large
    // costs time rather than correctness.
    let stepped = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const trial = new Float64Array(strength);
      for (let i = 0; i < subjectCount; i++) trial[i]! -= rate * grad[i]!;
      const trialSide = side - rate * gSide;
      const next = loss(trial, trialSide);
      if (next <= current) {
        strength.set(trial);
        side = trialSide;
        // Converged: the objective is convex, so a step this small means done.
        if (current - next < 1e-9) { current = next; stepped = true; iteration = iterations; break; }
        current = next;
        stepped = true;
        break;
      }
      rate /= 2;
    }
    if (!stepped) break;
  }

  return { strength, side, iterations: iteration };
}

/**
 * Log-odds converted onto the familiar 1500-point scale, so a Bradley-Terry
 * strength can be read beside a Glicko rating. Purely cosmetic.
 */
export const btToRating = (strength: number): number => 1500 + (strength * 400) / Math.LN10;
