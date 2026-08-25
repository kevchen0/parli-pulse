/**
 * Glicko-2, following Glickman's 2013 note, with two additions the league's
 * data needs.
 *
 * The system rates a competitor with three numbers: a rating, a deviation
 * saying how sure of it we are, and a volatility saying how erratic the
 * competitor has been. Beating a well-established opponent moves the rating
 * further than beating an unknown one, and an uncertain rating moves further
 * than a settled one. That is the whole reason to prefer it here: half the
 * partnerships in a season debate fewer than ten rounds, and a system that
 * cannot say "we do not know" would rank them anyway.
 *
 * The two additions:
 *
 *  - **A side advantage.** Opposition wins 52.4% of decided open rounds. A
 *    rating that ignores that credits the difference to skill, so the expected
 *    score is computed against the competitor's rating plus whatever their side
 *    is worth. It enters the expectation only; it never lands in the stored
 *    rating.
 *  - **Graded scores for split panels.** A round is one result, but a 3-0 and a
 *    2-1 are not the same evidence. `ballotScore` grades the outcome toward a
 *    draw as the panel splits. Whether that helps is an empirical question --
 *    `marginWeight` of zero turns it off -- and scripts/validate-rating.ts
 *    answers it.
 *
 * Nothing here knows about elim rounds, and nothing should. Elim opponents
 * average 53% more season points, so an opponent-adjusted rating already pays
 * more for beating them; a multiplier on top would count the same fact twice.
 */

/** Glicko-2 works in its own units; this converts to and from the 1500 scale. */
export const SCALE = 173.7178;

export const DEFAULT_RATING = 1500;
export const DEFAULT_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;

/**
 * How much the volatility itself is allowed to move. Glickman suggests 0.3 to
 * 1.2, smaller for erratic sports. Debate results are noisy -- a panel can
 * split three ways on one round -- so this sits at the low end, where a single
 * upset does not convince the system that a team has become unpredictable.
 */
export const DEFAULT_TAU = 0.4;

/** Convergence tolerance for the volatility solver, as Glickman specifies. */
const EPSILON = 0.000001;

export interface Rating {
  rating: number;
  deviation: number;
  volatility: number;
}

export const defaultRating = (): Rating => ({
  rating: DEFAULT_RATING,
  deviation: DEFAULT_DEVIATION,
  volatility: DEFAULT_VOLATILITY,
});

/** One round, from the point of view of the competitor being updated. */
export interface Opponent {
  rating: number;
  deviation: number;
  /** 1 win, 0 loss, or anything between for a split panel. */
  score: number;
  /**
   * Rating points this competitor's side is worth in this round, positive when
   * the side favours them. Applied to the expectation only.
   */
  advantage?: number;
}

/**
 * Shrinks an opponent's influence by how unsure we are of them. A result
 * against someone whose rating could be anywhere says less about the winner
 * than the same result against a known quantity.
 */
const g = (phi: number): number => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/** Probability the competitor at `mu` beats an opponent at `muJ`. */
const expectation = (mu: number, muJ: number, phiJ: number): number =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/**
 * The score a round contributes, graded by how the panel split.
 *
 * A unanimous decision scores a full win. As `marginWeight` rises toward one, a
 * split decision is pulled toward a draw in proportion to the split: at full
 * weight a 2-1 scores 0.667 rather than 1. Single-judge rounds are unanimous by
 * definition and are unaffected either way.
 */
export function ballotScore(won: number, total: number, marginWeight: number): number {
  if (total <= 0) return 0.5;
  const margin = (2 * won - total) / total;
  const decisive = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
  const graded = 0.5 + margin / 2;
  return decisive + marginWeight * (graded - decisive);
}

/**
 * Solves for the new volatility by the Illinois variant of regula falsi, which
 * is the step Glickman spends most of the paper on. It asks: how much would
 * this competitor's volatility have to change for the surprise in these results
 * to look ordinary?
 */
function newVolatility(phi: number, sigma: number, v: number, delta: number, tau: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - d)) / (2 * d * d) - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/**
 * Advances a rating through a period in which the competitor did not compete.
 *
 * Nothing is learned, so the rating holds and only the deviation grows: a team
 * that has not debated since October is not the team we last saw. `periods`
 * carries fractional values, so a gap can be measured in weeks rather than
 * rounded to whole tournaments.
 */
export function decay(r: Rating, periods = 1, maxDeviation = DEFAULT_DEVIATION): Rating {
  const phi = r.deviation / SCALE;
  const phiStar = Math.sqrt(phi * phi + r.volatility * r.volatility * Math.max(0, periods));
  return { ...r, deviation: Math.min(maxDeviation, phiStar * SCALE) };
}

/**
 * One rating period. Every result is weighed against the ratings the opponents
 * held *before* the period, which is what makes a tournament the natural
 * period: the teams that met in round one had not yet been changed by it.
 */
export function update(
  r: Rating,
  opponents: readonly Opponent[],
  options: { tau?: number; maxDeviation?: number } = {},
): Rating {
  const tau = options.tau ?? DEFAULT_TAU;
  const maxDeviation = options.maxDeviation ?? DEFAULT_DEVIATION;
  if (opponents.length === 0) return decay(r, 1, maxDeviation);

  const mu = (r.rating - DEFAULT_RATING) / SCALE;
  const phi = r.deviation / SCALE;

  let vInv = 0;
  let deltaSum = 0;
  for (const o of opponents) {
    const muJ = (o.rating - DEFAULT_RATING) / SCALE;
    const phiJ = o.deviation / SCALE;
    // The side advantage shifts who was expected to win, not who is rated
    // better: a team that wins on the favoured side has done less than the same
    // win on the other side, and this is where that gets priced.
    const muEff = mu + (o.advantage ?? 0) / SCALE;
    const e = expectation(muEff, muJ, phiJ);
    const gj = g(phiJ);
    vInv += gj * gj * e * (1 - e);
    deltaSum += gj * (o.score - e);
  }
  // Every opponent was a certainty and the results held no information. Rare,
  // and only reachable through numerical underflow, but it would divide by zero.
  if (vInv === 0) return decay(r, 1, maxDeviation);

  const v = 1 / vInv;
  const delta = v * deltaSum;

  const sigma = newVolatility(phi, r.volatility, v, delta, tau);
  const phiStar = Math.sqrt(phi * phi + sigma * sigma);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + vInv);
  const muNew = mu + phiNew * phiNew * deltaSum;

  return {
    rating: muNew * SCALE + DEFAULT_RATING,
    deviation: Math.min(maxDeviation, phiNew * SCALE),
    volatility: sigma,
  };
}

/**
 * The rating a competitor has earned rather than the one they might have.
 *
 * A board ordered on the rating itself puts whoever has been luckiest on top:
 * on 2025-26 a twelve-round partnership at plus or minus 144 outranked a
 * ninety-two-round one at plus or minus 70, which is a statement about how
 * little is known, not about who is better. Subtracting the deviation asks
 * instead how good a team has actually shown itself to be, so a rating rises as
 * much by being confirmed as by being high.
 *
 * This is a ranking choice, not a prediction one. Predictions use the rating
 * itself, through `winProbability`, because for a prediction the uncertainty
 * belongs in the width of the answer rather than in the estimate.
 */
export function conservative(r: Pick<Rating, 'rating' | 'deviation'>, deviations = 1): number {
  return r.rating - deviations * r.deviation;
}

/**
 * Probability `a` beats `b`, with `advantage` in rating points to `a`.
 *
 * Both deviations widen the result toward a coin flip, which is the point: an
 * unrated team is not predicted to lose, it is predicted to be unpredictable.
 */
export function winProbability(
  a: Pick<Rating, 'rating' | 'deviation'>,
  b: Pick<Rating, 'rating' | 'deviation'>,
  advantage = 0,
): number {
  const phi = Math.sqrt(a.deviation ** 2 + b.deviation ** 2) / SCALE;
  const diff = (a.rating + advantage - b.rating) / SCALE;
  return 1 / (1 + Math.exp(-g(phi) * diff));
}
