/**
 * NPDL Article XXI rule constants.
 *
 * Source of truth: NPDL League Rules, Board Code, Article XXI ("Rankings").
 *   https://docs.google.com/document/d/1xv6klxK9PQPPyAaeJ9Gh9-CGL-nvikRjRAsDTiRYZtw
 *
 * Every value here is transcribed from the rules text, EXCEPT the Elim Points
 * Table, which the document embeds as an image (`images/image1.png` in the
 * doc's zip export) rather than as text. It was transcribed by hand -- see
 * ELIM_POINTS_TABLE below and the band-boundary tests in constants.test.ts.
 */

/** Elimination round levels, ordered from earliest to latest. */
export const ELIM_LEVELS = [
  'tripleOcto',
  'doubleOcto',
  'octo',
  'quarter',
  'semi',
  'second',
  'first',
] as const;

export type ElimLevel = (typeof ELIM_LEVELS)[number];

/**
 * Number of teams competing at each elim level. Used both to derive the level
 * from a Tabroom round's section count and to check reachability (see
 * MIN_AFS_FOR_LEVEL).
 */
export const ELIM_LEVEL_FIELD_SIZE: Record<ElimLevel, number> = {
  tripleOcto: 64,
  doubleOcto: 32,
  octo: 16,
  quarter: 8,
  semi: 4,
  second: 2,
  first: 2,
};

/**
 * Minimum adjusted field size at which each elim level is structurally
 * reachable. In the printed table these cells sit left of a heavy stepped
 * border and are shown as 0; they are unreachable, not worth zero points, so
 * ELIM_POINTS_TABLE stores them as null.
 *
 * The border follows exactly one rule: a level needs one more team in the
 * field than the bracket holds. Octofinals (16 teams) first appear at AFS 17,
 * double-octos (32) at 33, triple-octos (64) at 65.
 */
export const MIN_AFS_FOR_LEVEL: Record<ElimLevel, number> = {
  tripleOcto: 65,
  doubleOcto: 33,
  octo: 17,
  quarter: 0,
  semi: 0,
  second: 0,
  first: 0,
};

export interface ElimPointsBand {
  /** Inclusive lower bound of the adjusted field size band. */
  minAfs: number;
  /** Inclusive upper bound; Infinity for the open-ended "219+" band. */
  maxAfs: number;
  /** Points by level. null = structurally unreachable at this field size. */
  points: Record<ElimLevel, number | null>;
}

const band = (
  minAfs: number,
  maxAfs: number,
  tripleOcto: number | null,
  doubleOcto: number | null,
  octo: number | null,
  quarter: number,
  semi: number,
  second: number,
  first: number,
): ElimPointsBand => ({
  minAfs,
  maxAfs,
  points: { tripleOcto, doubleOcto, octo, quarter, semi, second, first },
});

/**
 * Article XXI.2.B -- Elim Points Table.
 *
 * Rows are adjusted field size (AFS) bands; columns are the highest elim level
 * the team reached. Transcribed from the image embedded in the rules document.
 */
export const ELIM_POINTS_TABLE: readonly ElimPointsBand[] = [
  band(10, 11, null, null, null, 3, 7, 11, 17),
  band(12, 13, null, null, null, 4, 8, 12, 18),
  band(14, 16, null, null, null, 5, 9, 13, 19),
  band(17, 19, null, null, 2, 6, 10, 14, 20),
  band(20, 22, null, null, 3, 7, 11, 15, 21),
  band(23, 27, null, null, 4, 8, 12, 16, 22),
  band(28, 32, null, null, 5, 9, 13, 17, 23),
  band(33, 38, null, 2, 6, 10, 14, 18, 24),
  band(39, 45, null, 3, 7, 11, 15, 19, 25),
  band(46, 54, null, 4, 8, 12, 16, 20, 26),
  band(55, 64, null, 5, 9, 13, 17, 21, 27),
  band(65, 77, 2, 6, 10, 14, 18, 22, 28),
  band(78, 91, 3, 7, 11, 15, 19, 23, 29),
  band(92, 109, 4, 8, 12, 16, 20, 24, 30),
  band(110, 129, 5, 9, 13, 17, 21, 25, 31),
  band(130, 154, 6, 10, 14, 18, 22, 26, 32),
  band(155, 183, 7, 11, 15, 19, 23, 27, 33),
  band(184, 218, 8, 12, 16, 20, 24, 28, 34),
  band(219, Infinity, 9, 13, 17, 21, 25, 29, 35),
] as const;

/**
 * Article XXI.3.A -- points for teams that do not break, by prelim record.
 * Keyed "wins-losses". A record absent from this table earns 0 points.
 *
 * SEASON-SPECIFIC. NPDL revises the Board Code annually (XXI.11 provides for
 * its own replacement each July), so these values are pinned to a season and
 * resolved through `rulesForSeason()`. Verified exhaustively against the
 * 2025-26 rankings sheet: all 774 non-breaking rows match, with no exceptions.
 */
export const PRELIM_POINTS_2025_26: Record<string, number> = {
  '2-1': 4,
  '3-0': 8,
  '3-1': 7,
  '4-0': 11,
  '3-2': 4,
  '4-1': 10,
  '5-0': 14,
  '4-2': 6,
  '5-1': 12,
  '6-0': 16,
};

/** Current-season alias. Prefer `rulesForSeason()` in new code. */
export const PRELIM_POINTS = PRELIM_POINTS_2025_26;

/** A season label, e.g. "2025-26". */
export type Season = string;

export interface SeasonRules {
  season: Season;
  prelimPoints: Record<string, number>;
  elimPointsTable: readonly ElimPointsBand[];
  diminishingReturnsWeights: readonly number[];
}

const SEASON_RULES: Record<Season, SeasonRules> = {
  '2025-26': {
    season: '2025-26',
    prelimPoints: PRELIM_POINTS_2025_26,
    elimPointsTable: [],       // filled below; the table is declared later
    diminishingReturnsWeights: [1.0, 0.9, 0.6, 0.3, 0.1],
  },
};

export const DEFAULT_SEASON: Season = '2025-26';

/**
 * Rules in force for a season. Unknown seasons fall back to the default rather
 * than throwing, but callers should treat that as a data gap: points computed
 * under the wrong season's table are wrong, not approximate.
 */
export function rulesForSeason(season: Season = DEFAULT_SEASON): SeasonRules {
  const r = SEASON_RULES[season] ?? SEASON_RULES[DEFAULT_SEASON]!;
  return { ...r, elimPointsTable: ELIM_POINTS_TABLE };
}

/**
 * Article XXI.2.D -- penalties applied to breaking teams when a tournament
 * breaks less than the standard 27% of its open field. Bands are
 * [lower, upper) on the break percentage.
 */
export const BREAK_PERCENTAGE_PENALTIES: readonly {
  minPct: number;
  maxPct: number;
  penalty: number;
}[] = [
  { minPct: 0.0, maxPct: 4.8, penalty: -6 },
  { minPct: 4.8, maxPct: 6.7, penalty: -5 },
  { minPct: 6.7, maxPct: 9.5, penalty: -4 },
  { minPct: 9.5, maxPct: 13.5, penalty: -3 },
  { minPct: 13.5, maxPct: 19.0, penalty: -2 },
  { minPct: 19.0, maxPct: 26.9, penalty: -1 },
] as const;

/** Article XXI.2.D -- a "standard" invitational breaks at least this share. */
export const STANDARD_BREAK_PCT = 26.9;

/**
 * Article XXI.2.E -- adjustment applied to breaking teams when the number of
 * prelims differs from the standard 5. Seven or more prelims all get +3.
 */
export const PRELIM_COUNT_ADJUSTMENTS: Record<number, number> = {
  3: -6,
  4: -3,
  5: 0,
  6: 1,
  7: 3,
};

export const STANDARD_PRELIM_COUNT = 5;
export const MAX_PRELIM_COUNT_ADJUSTMENT = 3;

/** Article XXI.7.A -- diminishing marginal returns weights, best tournament first. */
export const DIMINISHING_RETURNS_WEIGHTS = [1.0, 0.9, 0.6, 0.3, 0.1] as const;

/** Article XXI.5.C -- walkover and closeout adjustments (same school only). */
export const WALKOVER_ADJUSTMENTS = {
  /** Team that was walked over by a same-school team. */
  beingWalkedOver: 2,
  /** Team that walked over a same-school team. */
  walkingOver: -2,
  /** Each team involved in a same-school finals closeout. */
  finalsCloseout: -3,
} as const;

/** Article XXI.4.A -- NPDL Tournament of Champions point schedule. */
export const TOC_POINTS = {
  prelimBallotWon: 2,
  breakBonus: 2,
  elimWin: 4,
  championshipBonus: 2,
} as const;

/**
 * Article XXI.4.B -- CHSSA member league regular-season tournaments. Only the
 * first three such tournaments count, all rounds count as prelims, and only
 * the first four rounds count for points.
 */
export const CHSSA_LEAGUE_POINTS: Record<string, number> = {
  '2-1': 2,
  '3-0': 5,
  '3-1': 4,
  '4-0': 9,
};

export const CHSSA_MAX_TOURNAMENTS = 3;
export const CHSSA_MAX_SCORING_ROUNDS = 4;

/** Article XXI.4.B -- CHSSA member leagues whose tournaments are eligible. */
export const CHSSA_MEMBER_LEAGUES = [
  'CFL', 'GGSA', 'YFL', 'SVFL Kern', 'SVFL Redwood', 'CVFL',
  'SCDL', 'TCFL', 'WBFL', 'CBSR', 'OCSL', 'SDIVSL',
] as const;

/**
 * Article XXI.4.C -- CHSSA state qualifying and OSAA district tournaments.
 * These points do not count toward TOC qualification (XXII) and are not added
 * to the rankings until March 2 or later.
 */
export const QUALIFIER_POINTS = {
  alternate: { points: 4, minEntries: 20 },
  qualifier: { points: 8, minEntries: 10 },
} as const;

/** Article XXI.1.D -- minimum size for an invitational's open division. */
export const MIN_SCHOOLS = 5;
export const MIN_TEAMS = 10;
export const MIN_PRELIM_ROUNDS = 3;

/** Article XXI.1.G -- only two-person teams are eligible for points. */
export const REQUIRED_TEAM_SIZE = 2;

/** Article XXI.2.A -- teams forfeiting this many prelims do not count toward field size. */
export const FORFEITS_EXCLUDED_FROM_FIELD_SIZE = 2;

/**
 * Article XXI.2.C -- a team with a losing or even prelim record earns points
 * only if it reached an elim in which at most this share of the open field
 * debated or advanced without debating.
 */
export const LOSING_RECORD_ELIM_THRESHOLD = 1 / 3;

/** Article XXII.1.A -- individual points needed on March 1 to autoqualify to the TOC. */
export const TOC_AUTOQUAL_POINTS = 40;

/**
 * Article XXI.1.H -- tournaments held in these months, or in the December 24
 * to January 2 window, do not count for points.
 */
export const EXCLUDED_MONTHS = [6, 7, 8] as const;
export const EXCLUDED_WINDOW = { from: '12-24', to: '01-02' } as const;
