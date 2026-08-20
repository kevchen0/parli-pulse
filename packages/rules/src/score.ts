import {
  CHSSA_LEAGUE_POINTS,
  CHSSA_MAX_SCORING_ROUNDS,
  DIMINISHING_RETURNS_WEIGHTS,
  QUALIFIER_POINTS,
  TOC_POINTS,
  type ElimLevel,
} from './constants.ts';
import {
  breakPercentagePenalty,
  elimPoints,
  prelimCountAdjustment,
  prelimPoints,
} from './elim.ts';

export interface TournamentContext {
  /** Adjusted field size (XXI.2.A). */
  afs: number;
  /** Elim field as a percentage of the open field, for XXI.2.D. */
  breakPct: number;
  prelimCount: number;
  /**
   * Prelim record of the lowest-seeded breaking team with a winning record,
   * for the XXI.3.B points floor. The sheet publishes this as `Breaking Record`.
   */
  breakingRecord?: { wins: number; losses: number } | undefined;
}

export interface EntryPerformance {
  wins: number;
  losses: number;
  /** Highest elim level reached, or null if the team did not break. */
  elimLevel: ElimLevel | null;
  /** XXI.1.G -- entries that are not two-person score nothing. */
  eligibleTeamSize: boolean;
  /** XXI.5.C adjustments, already resolved to a signed value. */
  walkoverAdjustment?: number;
}

export interface ScoreBreakdown {
  points: number;
  basePoints: number | null;
  prelimCountAdjustment: number;
  breakPenalty: number;
  walkoverAdjustment: number;
  floorApplied: 'none' | 'pointsFloor' | 'zero';
  excluded: 'teamSize' | null;
  broke: boolean;
}

const hasWinningRecord = (wins: number, losses: number): boolean => wins > losses;

/**
 * Points for one team at one tournament, per Article XXI sections 2, 3 and 5.
 *
 * Every component is returned alongside the total so a backtest mismatch names
 * the rule that diverged rather than just a number.
 */
export function scoreEntry(
  perf: EntryPerformance,
  ctx: TournamentContext,
): ScoreBreakdown {
  const empty: ScoreBreakdown = {
    points: 0,
    basePoints: null,
    prelimCountAdjustment: 0,
    breakPenalty: 0,
    walkoverAdjustment: 0,
    floorApplied: 'none',
    excluded: null,
    broke: perf.elimLevel !== null,
  };

  // XXI.1.G -- only two-person teams are eligible for points.
  if (!perf.eligibleTeamSize) return { ...empty, excluded: 'teamSize' };

  const walkover = perf.walkoverAdjustment ?? 0;

  // Non-breaking teams score off their prelim record alone (XXI.3.A).
  if (perf.elimLevel === null) {
    const base = prelimPoints(perf.wins, perf.losses);
    return {
      ...empty,
      basePoints: base,
      walkoverAdjustment: walkover,
      points: Math.max(0, base + walkover),
      floorApplied: base + walkover < 0 ? 'zero' : 'none',
    };
  }

  const base = elimPoints(ctx.afs, perf.elimLevel);
  if (base === null) {
    // Unreachable bracket for this field size: a data problem, not a zero.
    return { ...empty, basePoints: null };
  }

  const prelimAdj = prelimCountAdjustment(ctx.prelimCount);
  const breakPenalty = breakPercentagePenalty(ctx.breakPct);
  let points = base + prelimAdj + breakPenalty + walkover;
  let floorApplied: ScoreBreakdown['floorApplied'] = 'none';

  // XXI.3.B -- a breaking team with a winning prelim record receives at least
  // what the lowest-seeded breaking team with a winning record would have
  // earned on prelims alone.
  if (hasWinningRecord(perf.wins, perf.losses) && ctx.breakingRecord) {
    const floor = prelimPoints(ctx.breakingRecord.wins, ctx.breakingRecord.losses);
    if (floor > points) {
      points = floor;
      floorApplied = 'pointsFloor';
    }
  }

  // XXI.2.F -- no team shall lose points from attending a tournament.
  if (points < 0) {
    points = 0;
    floorApplied = 'zero';
  }

  return {
    points,
    basePoints: base,
    prelimCountAdjustment: prelimAdj,
    breakPenalty,
    walkoverAdjustment: walkover,
    floorApplied,
    excluded: null,
    broke: true,
  };
}

/**
 * XXI.7.A -- diminishing marginal returns across a competitor's best five
 * tournaments. Used unchanged for team (XXI.7) and individual (XXI.8) totals;
 * they differ only in which results are pooled.
 */
export function weightedTotal(pointsPerTournament: readonly number[]): number {
  const best = [...pointsPerTournament].sort((a, b) => b - a).slice(0, DIMINISHING_RETURNS_WEIGHTS.length);
  const total = best.reduce((sum, p, i) => sum + p * DIMINISHING_RETURNS_WEIGHTS[i]!, 0);
  // Weights carry one decimal; avoid binary-float dust like 32.499999999999996.
  return Math.round(total * 1e6) / 1e6;
}


/**
 * XXI.4.B -- CHSSA member league regular-season tournaments.
 *
 * These are effectively prelim-only: every round counts as a prelim, only the
 * first four score, and they use their own much flatter point table. The elim
 * points table is not consulted at all.
 */
export function scoreChssaLeague(wins: number, losses: number): ScoreBreakdown {
  const capped = Math.min(wins + losses, CHSSA_MAX_SCORING_ROUNDS);
  // Trim losses first: the first four rounds are what count.
  const w = Math.min(wins, capped);
  const l = capped - w;
  const base = CHSSA_LEAGUE_POINTS[`${w}-${l}`] ?? 0;
  return {
    points: base,
    basePoints: base,
    prelimCountAdjustment: 0,
    breakPenalty: 0,
    walkoverAdjustment: 0,
    floorApplied: 'none',
    excluded: null,
    broke: false,
  };
}

/**
 * XXI.4.C -- CHSSA state qualifying and OSAA district tournaments. These points
 * do not count toward TOC qualification and are withheld from the rankings
 * until March 2.
 */
export function scoreQualifier(
  outcome: 'qualifier' | 'alternate' | 'none',
  totalEntries: number,
): number {
  if (outcome === 'none') return 0;
  const rule = QUALIFIER_POINTS[outcome];
  return totalEntries >= rule.minEntries ? rule.points : 0;
}

export interface TocPerformance {
  /** Prelim ballots won -- panels make this larger than the number of rounds. */
  prelimBallotsWon: number;
  broke: boolean;
  elimWins: number;
  champion: boolean;
}

/**
 * XXI.4.A -- the NPDL Tournament of Champions, which scores by ballots and
 * elim wins rather than from the elim points table. Break percentage penalties
 * still apply (XXI.2.D).
 */
export function scoreToc(perf: TocPerformance, breakPct: number): ScoreBreakdown {
  const base =
    perf.prelimBallotsWon * TOC_POINTS.prelimBallotWon +
    (perf.broke ? TOC_POINTS.breakBonus : 0) +
    perf.elimWins * TOC_POINTS.elimWin +
    (perf.champion ? TOC_POINTS.championshipBonus : 0);
  const penalty = perf.broke ? breakPercentagePenalty(breakPct) : 0;
  return {
    points: Math.max(0, base + penalty),
    basePoints: base,
    prelimCountAdjustment: 0,
    breakPenalty: penalty,
    walkoverAdjustment: 0,
    floorApplied: base + penalty < 0 ? 'zero' : 'none',
    excluded: null,
    broke: perf.broke,
  };
}
