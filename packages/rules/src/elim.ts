import {
  BREAK_PERCENTAGE_PENALTIES,
  ELIM_LEVELS,
  ELIM_LEVEL_FIELD_SIZE,
  ELIM_POINTS_TABLE,
  MAX_PRELIM_COUNT_ADJUSTMENT,
  MIN_AFS_FOR_LEVEL,
  PRELIM_COUNT_ADJUSTMENTS,
  PRELIM_POINTS,
  type ElimLevel,
  type ElimPointsBand,
} from './constants.ts';

/** Returns the Elim Points Table band covering `afs`, or null if below the minimum. */
export function findAfsBand(afs: number): ElimPointsBand | null {
  if (!Number.isFinite(afs)) return null;
  return ELIM_POINTS_TABLE.find((b) => afs >= b.minAfs && afs <= b.maxAfs) ?? null;
}

/**
 * Article XXI.2.B -- base elim points for reaching `level` at a tournament with
 * the given adjusted field size.
 *
 * Returns null when the combination is structurally unreachable (a bracket
 * larger than the field) or when the field is below the table's 10-team floor.
 * Callers must distinguish this from a legitimate zero.
 */
export function elimPoints(afs: number, level: ElimLevel): number | null {
  const band = findAfsBand(afs);
  if (!band) return null;
  return band.points[level];
}

/**
 * Derives the elim level from the number of sections (rooms) in a Tabroom
 * round.
 *
 * Tabroom's `Final Places` labels are unreliable -- some tournaments report
 * "Elim 2"/"Elim 3" rather than "Double Octafinals" -- but section counts are
 * exact, because a round with N rooms is by definition a 2N-team bracket.
 *
 * Finals and second place share a single one-section round; the winner takes
 * `first` and the loser `second`, so this returns 'first' for one section and
 * callers assign 'second' from the ballot outcome.
 */
export function elimLevelFromSectionCount(sections: number): ElimLevel | null {
  switch (sections) {
    case 32: return 'tripleOcto';
    case 16: return 'doubleOcto';
    case 8: return 'octo';
    case 4: return 'quarter';
    case 2: return 'semi';
    case 1: return 'first';
    default: return null;
  }
}

/** True if `level` is structurally reachable at the given adjusted field size. */
export function isLevelReachable(afs: number, level: ElimLevel): boolean {
  return afs >= MIN_AFS_FOR_LEVEL[level];
}

/** Article XXI.3.A -- points for a non-breaking team with the given prelim record. */
export function prelimPoints(wins: number, losses: number): number {
  return PRELIM_POINTS[`${wins}-${losses}`] ?? 0;
}

/**
 * Article XXI.2.D -- penalty applied to breaking teams when the tournament
 * breaks less than 27% of its open field. Returns 0 at or above the standard.
 */
export function breakPercentagePenalty(breakPct: number): number {
  const band = BREAK_PERCENTAGE_PENALTIES.find(
    (b) => breakPct >= b.minPct && breakPct < b.maxPct,
  );
  return band?.penalty ?? 0;
}

/**
 * Article XXI.2.E -- adjustment applied to breaking teams when the prelim count
 * differs from the standard 5. Seven or more prelims all earn the same bonus.
 */
export function prelimCountAdjustment(prelimCount: number): number {
  if (prelimCount >= 7) return MAX_PRELIM_COUNT_ADJUSTMENT;
  return PRELIM_COUNT_ADJUSTMENTS[prelimCount] ?? 0;
}

export { ELIM_LEVELS, ELIM_LEVEL_FIELD_SIZE };
