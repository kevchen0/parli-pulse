/**
 * Database schema.
 *
 * Two principles shape this:
 *
 *  1. **Official numbers and our numbers live in separate tables.** The league's
 *     published figures are mirrored verbatim into `official*` tables and are
 *     what the site displays. Ours land in `entryResults` and are used to
 *     check them. Nothing merges the two.
 *  2. **Every adjustment is stored separately, not just the total.** A backtest
 *     mismatch has to name the rule that diverged; a single opaque `points`
 *     column cannot do that.
 */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const divisionEnum = pgEnum('division', ['open', 'jv', 'novice', 'middle', 'unknown']);
export const roundKindEnum = pgEnum('round_kind', ['prelim', 'elim', 'other']);
export const elimLevelEnum = pgEnum('elim_level', [
  'tripleOcto', 'doubleOcto', 'octo', 'quarter', 'semi', 'second', 'first',
]);
export const disagreementStatusEnum = pgEnum('disagreement_status', [
  'open', 'our_bug', 'sheet_manual_override', 'missing_tabroom_data', 'accepted_divergence',
]);

// --- Core entities -------------------------------------------------------

export const seasons = pgTable('seasons', {
  /** "2025-26". Rules are versioned by season; see packages/rules. */
  id: text('id').primaryKey(),
  startsOn: text('starts_on').notNull(),
  endsOn: text('ends_on').notNull(),
  /** Archive seasons are mirrored only, never recomputed. */
  archival: boolean('archival').notNull().default(false),
});

export const tournaments = pgTable('tournaments', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  /** Tabroom `tourn_id`. Null for tournaments that never published there. */
  tabroomId: text('tabroom_id'),
  name: text('name').notNull(),
  /** Name as it appears in the league spreadsheet, for joining. */
  officialName: text('official_name'),
  startsOn: text('starts_on'),
  endsOn: text('ends_on'),
  location: text('location'),
  /** 'Regular' | 'NYPDL' | 'CHSSA' | 'OSAA'. Drives which XXI.4 rules apply. */
  category: text('category'),
  approval: text('approval'),
  /** Content hash of the cached Tabroom payload, so unchanged data is skipped. */
  payloadHash: text('payload_hash'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('tournaments_tabroom_idx').on(t.tabroomId),
  index('tournaments_season_idx').on(t.seasonId),
]);

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  abbr: text('abbr'),
  division: divisionEnum('division').notNull(),
  isParli: boolean('is_parli').notNull(),
  prelimCount: integer('prelim_count').notNull().default(0),
  /** Speaker scale in force, e.g. [25,30]; see packages/speaks. */
  speakerScaleMin: real('speaker_scale_min'),
  speakerScaleMax: real('speaker_scale_max'),
}, (t) => [index('events_tournament_idx').on(t.tournamentId)]);

export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  /** Canonical name from the league's SchoolList tab. */
  name: text('name').notNull(),
  shortName: text('short_name'),
  region: text('region'),
  /** Tabroom chapter id, stable across seasons where known. */
  tabroomChapterId: text('tabroom_chapter_id'),
  isMember: boolean('is_member').notNull().default(false),
}, (t) => [uniqueIndex('schools_name_idx').on(t.name)]);

/** Free-text school names seen in the wild, mapped to a canonical school. */
export const schoolAliases = pgTable('school_aliases', {
  alias: text('alias').primaryKey(),
  schoolId: text('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
});

export const debaters = pgTable('debaters', {
  /**
   * Tabroom student id. Stable within a chapter but NOT across chapters: a
   * debater who also competes under an independent or club registration gets a
   * second id. See `canonicalId`.
   */
  id: text('id').primaryKey(),
  /**
   * The id this record has been merged into, or null if it is itself
   * canonical. Rankings group by this so one person's results are not split
   * across their school and independent registrations.
   */
  canonicalId: text('canonical_id'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  schoolId: text('school_id').references(() => schools.id),
  /** Set when a debater asks to be excluded from public profiles. */
  suppressed: boolean('suppressed').notNull().default(false),
}, (t) => [index('debaters_school_idx').on(t.schoolId)]);

export const judges = pgTable('judges', {
  /** Tabroom `judge_person` id. */
  id: text('id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
});

// --- Competition ---------------------------------------------------------

export const entries = pgTable('entries', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  code: text('code'),
  schoolId: text('school_id').references(() => schools.id),
  /** Second school for hybrids; XXI.9.C splits their points half to each. */
  hybridSchoolId: text('hybrid_school_id').references(() => schools.id),
  /** XXI.1.G: only two-person teams score. Stored, not inferred at read time. */
  teamSize: integer('team_size').notNull().default(0),
  dropped: boolean('dropped').notNull().default(false),
  prelimWins: integer('prelim_wins').notNull().default(0),
  prelimLosses: integer('prelim_losses').notNull().default(0),
  /** Ballots, not rounds: XXI.4.A counts these and panels award several. */
  prelimBallotsWon: integer('prelim_ballots_won').notNull().default(0),
  prelimBallotsTotal: integer('prelim_ballots_total').notNull().default(0),
  elimLevel: elimLevelEnum('elim_level'),
  wonFinal: boolean('won_final').notNull().default(false),
}, (t) => [index('entries_event_idx').on(t.eventId), index('entries_school_idx').on(t.schoolId)]);

export const entryDebaters = pgTable('entry_debaters', {
  entryId: text('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
  debaterId: text('debater_id').notNull().references(() => debaters.id, { onDelete: 'cascade' }),
  /** Each debater's own school, which for a hybrid is not the entry's. */
  schoolId: text('school_id').references(() => schools.id),
}, (t) => [
  primaryKey({ columns: [t.entryId, t.debaterId] }),
  index('entry_debaters_debater_idx').on(t.debaterId),
]);

export const rounds = pgTable('rounds', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Tabroom's raw type, which names the pairing method, not the stage. */
  tabroomType: text('tabroom_type'),
  kind: roundKindEnum('kind').notNull(),
  /** Bracket implied by the section count, not by any published label. */
  elimLevel: elimLevelEnum('elim_level'),
  /** True for a consolation bracket running alongside the main one. */
  isConsolation: boolean('is_consolation').notNull().default(false),
  sectionCount: integer('section_count').notNull().default(0),
}, (t) => [index('rounds_event_idx').on(t.eventId)]);

export const ballots = pgTable('ballots', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
  sectionId: text('section_id'),
  entryId: text('entry_id').references(() => entries.id, { onDelete: 'cascade' }),
  judgeId: text('judge_id').references(() => judges.id),
  side: integer('side'),
  /** Null where the result was never entered -- distinct from a loss. */
  won: boolean('won'),
  /** Alone in the section: advanced without debating. */
  isBye: boolean('is_bye').notNull().default(false),
}, (t) => [
  index('ballots_round_idx').on(t.roundId),
  index('ballots_entry_idx').on(t.entryId),
  index('ballots_judge_idx').on(t.judgeId),
]);

export const speakerScores = pgTable('speaker_scores', {
  id: text('id').primaryKey(),
  ballotId: text('ballot_id').notNull().references(() => ballots.id, { onDelete: 'cascade' }),
  debaterId: text('debater_id').references(() => debaters.id),
  judgeId: text('judge_id').references(() => judges.id),
  /** As published. Never overwritten. */
  raw: real('raw').notNull(),
  /** Judge-normalized, using a robust centre and spread. */
  z: real('z'),
  /** Rescaled onto the familiar 25-30 band, for display only. */
  display: real('display'),
  /** 0.0 forfeits and out-of-range values are held back for review. */
  excluded: boolean('excluded').notNull().default(false),
  exclusionReason: text('exclusion_reason'),
}, (t) => [
  index('speaker_scores_debater_idx').on(t.debaterId),
  index('speaker_scores_judge_idx').on(t.judgeId),
]);

// --- Scoring -------------------------------------------------------------

/** Field sizes per event, computed once because points depend on them. */
export const eventFieldStats = pgTable('event_field_stats', {
  eventId: text('event_id').primaryKey().references(() => events.id, { onDelete: 'cascade' }),
  rawEntries: integer('raw_entries').notNull(),
  forfeitedOut: integer('forfeited_out').notNull(),
  fieldSize: integer('field_size').notNull(),
  /** Bye-aware, main bracket only. Never sections x 2. */
  elimField: integer('elim_field').notNull(),
  adjustedFieldSize: integer('adjusted_field_size'),
  breakPct: real('break_pct'),
  unscored: boolean('unscored').notNull().default(false),
});

/**
 * Our Article XXI computation. Adjustments are stored one per column so a
 * disagreement can be attributed to a specific subsection rather than to a
 * total that happens to differ.
 */
export const entryResults = pgTable('entry_results', {
  entryId: text('entry_id').primaryKey().references(() => entries.id, { onDelete: 'cascade' }),
  points: real('points').notNull(),
  /** After the XXI.3.B floor, which lifts the base before adjustments apply. */
  basePoints: real('base_points'),
  prelimCountAdjustment: integer('prelim_count_adjustment').notNull().default(0),
  breakPenalty: integer('break_penalty').notNull().default(0),
  walkoverAdjustment: integer('walkover_adjustment').notNull().default(0),
  floorApplied: text('floor_applied'),
  /** Set when XXI.1.G or another rule excluded the entry entirely. */
  excludedReason: text('excluded_reason'),
  countsTowardToc: boolean('counts_toward_toc').notNull().default(true),
});

/** The league's published per-entry figures, mirrored verbatim. */
export const officialEntryResults = pgTable('official_entry_results', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),
  /** Matched entry, where we could tie the sheet row to Tabroom data. */
  entryId: text('entry_id').references(() => entries.id),
  schoolName: text('school_name').notNull(),
  hybridSchoolName: text('hybrid_school_name'),
  partner1: text('partner1').notNull(),
  partner2: text('partner2').notNull(),
  result: text('result'),
  points: real('points'),
  basePoints: real('base_points'),
  walkoverAdjustment: integer('walkover_adjustment'),
  breakPrelimAdjustment: integer('break_prelim_adjustment'),
  manualAdjustment: integer('manual_adjustment'),
  incorrectTeamSize: boolean('incorrect_team_size').notNull().default(false),
  tocQual: boolean('toc_qual').notNull().default(false),
}, (t) => [index('official_entry_results_tournament_idx').on(t.tournamentId)]);

/** The league's published per-tournament field figures, mirrored verbatim. */
export const officialTournamentStats = pgTable('official_tournament_stats', {
  tournamentId: text('tournament_id').primaryKey().references(() => tournaments.id, { onDelete: 'cascade' }),
  openField: integer('open_field'),
  njvField: integer('njv_field'),
  adjustedFieldSize: integer('adjusted_field_size'),
  openElimField: integer('open_elim_field'),
  prelimCount: integer('prelim_count'),
  /** Lowest breaking record with a winning record; drives the XXI.3.B floor. */
  breakingRecord: text('breaking_record'),
  prelimAdjustment: integer('prelim_adjustment'),
  breakPct: real('break_pct'),
  breakPenalty: integer('break_penalty'),
});

/**
 * Divergences between our computation and the league's, triaged by hand.
 * Only `accepted_divergence` rows are ever surfaced publicly; the default
 * display is always the official number.
 */
export const disagreements = pgTable('disagreements', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').references(() => seasons.id),
  tournamentId: text('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),
  entryId: text('entry_id').references(() => entries.id),
  scope: text('scope').notNull(),
  ourValue: real('our_value'),
  officialValue: real('official_value'),
  /** Full adjustment trail, so triage does not require rerunning the engine. */
  detail: jsonb('detail'),
  status: disagreementStatusEnum('status').notNull().default('open'),
  note: text('note'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [index('disagreements_status_idx').on(t.status)]);

/** Hand-entered corrections: walkovers, closeouts, and XXI.10.B reports. */
export const manualOverrides = pgTable('manual_overrides', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').references(() => entries.id, { onDelete: 'cascade' }),
  tournamentId: text('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),
  field: text('field').notNull(),
  value: text('value').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Derived rankings ----------------------------------------------------

export const teamSeasonTotals = pgTable('team_season_totals', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  schoolId: text('school_id').references(() => schools.id),
  debater1Id: text('debater1_id').references(() => debaters.id),
  debater2Id: text('debater2_id').references(() => debaters.id),
  /** Diminishing-returns weighting of the best five (XXI.7.A). */
  points: real('points').notNull(),
  rank: integer('rank'),
  tournamentsCounted: integer('tournaments_counted').notNull().default(0),
}, (t) => [index('team_season_totals_season_idx').on(t.seasonId)]);

export const debaterSeasonTotals = pgTable('debater_season_totals', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  debaterId: text('debater_id').notNull().references(() => debaters.id),
  /** XXI.8: the debater's own results pooled across every partner. */
  points: real('points').notNull(),
  rank: integer('rank'),
  tocQualPoints: real('toc_qual_points'),
  tocQualRank: integer('toc_qual_rank'),
  /** XXII.1.A: 40 individual points on March 1. */
  autoQualified: boolean('auto_qualified').notNull().default(false),
}, (t) => [uniqueIndex('debater_season_idx').on(t.seasonId, t.debaterId)]);

export const schoolSeasonTotals = pgTable('school_season_totals', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  schoolId: text('school_id').notNull().references(() => schools.id),
  /** Unweighted sum; hybrids contribute half to each school (XXI.9.C). */
  points: real('points').notNull(),
  rank: integer('rank'),
}, (t) => [uniqueIndex('school_season_idx').on(t.seasonId, t.schoolId)]);

/**
 * Season speaker standings per debater, from judge-normalized scores.
 *
 * Separate from Article XXI entirely: speaker points carry no ranking weight
 * in the rules, and this is our own measure. Stored with the sample size it
 * came from, because a mean over four ballots and one over forty are not the
 * same claim.
 */
export const debaterSpeakerTotals = pgTable('debater_speaker_totals', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  debaterId: text('debater_id').notNull().references(() => debaters.id),
  /** Usable ballots, after forfeits and out-of-range values are removed. */
  ballots: integer('ballots').notNull(),
  /** Mean standard deviations from the judge's own baseline. */
  meanZ: real('mean_z').notNull(),
  /** The same figure expressed on the familiar 25-30 scale. */
  meanDisplay: real('mean_display').notNull(),
  /**
   * Spread of the debater's own ballots. With `ballots`, this gives the
   * standard error of the mean -- how much of the figure above is signal.
   */
  sdZ: real('sd_z'),
  /** Half-width of the 95% interval on `meanDisplay`, in display points. */
  marginDisplay: real('margin_display'),
  /** Null until the debater clears the minimum-ballot threshold. */
  rank: integer('rank'),
}, (t) => [uniqueIndex('debater_speaker_season_idx').on(t.seasonId, t.debaterId)]);

/**
 * Per-partnership reconciliation against the league's published standings.
 *
 * Stored rather than computed on demand because it is the site's honesty
 * surface: it shows exactly where our figures differ from the league's and
 * which tournament caused it. `results` carries the whole season for the
 * partnership, so a reader can see that a total is wrong by one result rather
 * than wrong everywhere.
 */
export const standingDiagnostics = pgTable('standing_diagnostics', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  schoolName: text('school_name').notNull(),
  region: text('region'),
  debater1: text('debater1').notNull(),
  debater2: text('debater2').notNull(),
  officialRank: integer('official_rank'),
  officialPoints: real('official_points').notNull(),
  ourPoints: real('our_points'),
  /** ourPoints - officialPoints; null when we have no standing at all. */
  delta: real('delta'),
  /** Results that differ, and whether each is inside the counting best five. */
  mismatchedResults: integer('mismatched_results').notNull().default(0),
  /** Full season: [{tournament, official, ours, delta, counted, provenance}]. */
  results: jsonb('results'),
}, (t) => [
  index('standing_diagnostics_season_idx').on(t.seasonId),
  index('standing_diagnostics_delta_idx').on(t.delta),
]);

/**
 * Glicko-2 ratings, snapshotted per rating period so history can be charted.
 * Deliberately separate from Article XXI points: this is our own metric and
 * must never be presented as league rankings.
 */
export const ratings = pgTable('ratings', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').references(() => seasons.id),
  /** Rated subject: a partnership, or a debater once TrueSkill-style. */
  subjectKind: text('subject_kind').notNull(),
  subjectId: text('subject_id').notNull(),
  /** Rating period boundary, normally one tournament. */
  tournamentId: text('tournament_id').references(() => tournaments.id),
  rating: doublePrecision('rating').notNull(),
  deviation: doublePrecision('deviation').notNull(),
  volatility: doublePrecision('volatility').notNull(),
  roundsCounted: integer('rounds_counted').notNull().default(0),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ratings_subject_idx').on(t.subjectKind, t.subjectId)]);

/**
 * Judge aggregates. Sparse by nature -- most judges never sit on a panel --
 * so every rate is stored beside the sample it came from and shrunk toward the
 * pool before display.
 */
export const judgeStats = pgTable('judge_stats', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').references(() => seasons.id),
  judgeId: text('judge_id').notNull().references(() => judges.id),
  tournamentsJudged: integer('tournaments_judged').notNull().default(0),
  roundsJudged: integer('rounds_judged').notNull().default(0),
  panelRounds: integer('panel_rounds').notNull().default(0),
  dissents: integer('dissents').notNull().default(0),
  /** Shrunk toward the pool mean; meaningless without `panelRounds`. */
  squirrelRate: real('squirrel_rate'),
  meanSpeakerPoints: real('mean_speaker_points'),
  speakerPointsZ: real('speaker_points_z'),
  propWinRate: real('prop_win_rate'),
}, (t) => [uniqueIndex('judge_season_idx').on(t.seasonId, t.judgeId)]);
