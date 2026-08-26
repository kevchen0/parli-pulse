/**
 * Shared season computation for the backtests: score every entry we can match
 * to a row in the official sheet, and expose the results keyed both by
 * tournament and by partnership.
 *
 * Partnership identity comes from the *sheet* side (school + surname pair)
 * rather than ours, so linking a team across tournaments does not also depend
 * on reconciling Tabroom's school-name variants.
 */
import { existsSync, readFileSync } from 'node:fs';
import { prelimPoints, scoreEntry, scoreToc, type ElimLevel } from '../../packages/rules/src/index.ts';
import {
  buildStudentIndex,
  computeEntryPerformances,
  computeFieldStats,
  normalizeTournament,
} from '../../packages/ingest/src/normalize.ts';
import {
  matchTeams,
  peopleFromEntryLabel,
  type EntryCandidate,
  type MatchTier,
} from '../../packages/ingest/src/matching.ts';
import { fieldEventFilter, openEventFilter } from '../../packages/ingest/src/event-selection.ts';
import { MANUAL_RESULTS } from '../../packages/ingest/src/manual-results.ts';
import {
  parseEntryTab,
  parseTournamentsTab,
  parseWorkbook,
  type OfficialEntry,
  type OfficialTournament,
  type SheetRow,
} from '../../packages/ingest/src/sheet.ts';

export const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/^[a-z]\.\s*/, '').replace(/[^a-z]/g, '');

export const pairKey = (a: string, b: string): string => [norm(a), norm(b)].sort().join('|');

/** Season-stable identity for a partnership: school plus its surname pair. */
export const teamKey = (school: string, a: string, b: string): string =>
  `${norm(school)}::${pairKey(a, b)}`;

export interface EntryCase {
  tournament: string;
  category: string;
  tournId: string;
  school: string;
  /** Second school on a hybrid entry; XXI.9.C splits its points between them. */
  hybridSchool: string | null;
  team: string;
  pair: string;
  entryId: string;
  /** Surnames as the league writes them; the normalized `pair` loses spacing. */
  partner1: string;
  partner2: string;
  matchTier: MatchTier;
  matchAmbiguous: boolean;
  /**
   * Where our figure came from. 'tabroom' is computed from round data;
   * 'manual' is hand-entered because no Tabroom data exists; 'sheet-record'
   * is scored from the league's own recorded result at a prelim-only
   * tournament, which needs no bracket.
   */
  provenance: 'tabroom' | 'manual' | 'sheet-record';
  ours: number;
  theirs: number;
  matched: boolean;
  broke: boolean;
  hybrid: boolean;
  ourBase: number | null;
  theirBase: number | null;
  /**
   * Prelim-count adjustment plus break penalty, which is the shape the sheet
   * reports them in: its `prelim/break percentage adj` is one column. Kept for
   * the comparison against `theirAdj`; the pieces below are what gets stored.
   */
  ourAdj: number;
  theirAdj: number | null;
  /** XXI.2.E, on its own. */
  ourPrelimAdj: number;
  /** XXI.2.D, on its own. */
  ourBreakPenalty: number;
  /**
   * XXI.5.C, as the league recorded it.
   *
   * Read from the sheet's `walkover_adjustment` rather than derived: a
   * walkover leaves three different shapes in Tabroom -- a short panel, a
   * fully-balloted finals closeout, and at Nueva no section at all -- so
   * nothing in the round data identifies them reliably. It is cumulative per
   * entry per tournament: -4 is two walkovers, -7 two walkovers and a finals
   * closeout.
   */
  ourWalkover: number;
  ourFloor: string | null;
}

export interface SeasonResult {
  cases: EntryCase[];
  /** Sheet rows we could not tie to a Tabroom entry. */
  unmatched: { tournament: string; team: string }[];
  /** Rows whose best candidates tied; deliberately left unscored. */
  ambiguous: { tournament: string; team: string }[];
  /** Sheet tournaments with no usable Tabroom payload. */
  skippedTournaments: string[];
  workbook: Map<string, SheetRow[]>;
  officialTournaments: OfficialTournament[];
  officialEntries: OfficialEntry[];
}

/**
 * XXI.3.B's floor: the record of the lowest-seeded team that broke.
 *
 * The sheet publishes this as `Breaking Record` and Tabroom never states it, so
 * computing our own means reading it off the entries that actually appear in an
 * elim: among those, the worst prelim record. Teams with a losing record are
 * excluded because the floor is defined over breaking teams with a *winning*
 * record, and a bracket sometimes reaches below .500 to fill itself.
 */
function lowestBreakingRecord(
  perfs: readonly { elimLevel: ElimLevel | null; wins: number; losses: number }[],
): { wins: number; losses: number } | undefined {
  const broke = perfs.filter((p) => p.elimLevel !== null && p.wins > p.losses);
  if (broke.length === 0) return undefined;
  // Fewest wins, then most losses: the last team in.
  return broke.reduce((worst, p) =>
    p.wins < worst.wins || (p.wins === worst.wins && p.losses > worst.losses)
      ? { wins: p.wins, losses: p.losses }
      : worst,
  { wins: broke[0]!.wins, losses: broke[0]!.losses });
}

const parseRecord = (s: string): { wins: number; losses: number } | undefined => {
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  return m ? { wins: Number(m[1]), losses: Number(m[2]) } : undefined;
};

/**
 * Where the inputs to scoring come from.
 *
 * `sheet` takes the league's published field sizes, break percentage, prelim
 * count and walkover adjustment wherever it has them, falling back to ours.
 * That is right for a *backtest* -- it isolates the points rules, so a mismatch
 * can never be a field-size mismatch in disguise -- and wrong for the live
 * pipeline, which wants figures it can compute for a tournament the league has
 * not written up yet. Both used one function until this flag existed.
 *
 * `tabroom` computes every one of them from the payload. Discovery still comes
 * from the sheet: its `Results` column decides which tournaments exist, and the
 * `Entry` tab decides which teams the league scores. Neither is a number.
 */
export type InputSource = 'sheet' | 'tabroom';

/**
 * Which inputs to take from the sheet, so one can be moved at a time.
 *
 * Switching all of them at once says the accuracy changed and not which input
 * did it. Each of these is separately measurable, and they are not equally
 * hard: field sizes are arithmetic over the payload, while the breaking record
 * is a rule about which team was last in.
 */
export interface InputSources {
  fields: InputSource;
  breakingRecord: InputSource;
  walkover: InputSource;
}

export const ALL_SHEET: InputSources = {
  fields: 'sheet', breakingRecord: 'sheet', walkover: 'sheet',
};
export const ALL_TABROOM: InputSources = {
  fields: 'tabroom', breakingRecord: 'tabroom', walkover: 'tabroom',
};

export interface SeasonOptions {
  /** A single source for everything, or one per input. */
  source?: InputSource | Partial<InputSources>;
}

/**
 * The source the pipeline and its reports run under.
 *
 * `tabroom` by default, matching what `load` writes, so a backtest measures the
 * engine that actually ships rather than one nothing uses. `SOURCE=sheet`
 * restores the rule-isolating view: taking the league's field sizes means a
 * points mismatch can never be a field-size mismatch in disguise, which is the
 * right instrument when the question is whether a *rule* is wrong.
 */
export const sourceFromEnv = (): InputSource =>
  process.env.SOURCE === 'sheet' ? 'sheet' : 'tabroom';

const resolveSources = (source: SeasonOptions['source']): InputSources =>
  source === undefined ? ALL_SHEET
    : source === 'sheet' ? ALL_SHEET
    : source === 'tabroom' ? ALL_TABROOM
    : { ...ALL_SHEET, ...source };

export function computeSeason(
  zipPath = 'data/raw/sheet/rankings.zip',
  options: SeasonOptions = {},
): SeasonResult {
  const sources = resolveSources(options.source);
  /** The sheet's figure, or undefined when we are computing our own. */
  const fromSheet = <T>(v: T | null | undefined): T | undefined =>
    sources.fields === 'sheet' ? (v ?? undefined) : undefined;
  const workbook = parseWorkbook(new Uint8Array(readFileSync(zipPath)));
  const officialTournaments = parseTournamentsTab(workbook.get('Tournaments')!);
  const officialEntries = parseEntryTab(workbook.get('Entry')!);

  const cases: EntryCase[] = [];
  const unmatched: { tournament: string; team: string }[] = [];
  const ambiguous: { tournament: string; team: string }[] = [];
  const skippedTournaments: string[] = [];

  for (const off of officialTournaments) {
    const sheetRows = officialEntries.filter((e) => e.tournament === off.name);
    if (!sheetRows.length) continue;
    const path = off.tournId ? `data/raw/tabroom/${off.tournId}.json` : '';
    if (!path || !existsSync(path)) {
      // No Tabroom data at all. Tournaments that run on another platform are
      // still scoreable from the hand-entered table; anything else is a gap.
      skippedTournaments.push(off.name);
      for (const row of sheetRows) {
        const manual = MANUAL_RESULTS.find(
          (m) => m.tournament === off.name &&
            pairKey(m.partner1, m.partner2) === pairKey(row.partner1, row.partner2),
        );
        const team = teamKey(row.school1, row.partner1, row.partner2);
        if (!manual) { unmatched.push({ tournament: off.name, team }); continue; }
        cases.push({
          tournament: off.name, category: off.category || '(none)', tournId: '',
          school: row.school1, hybridSchool: row.school2 || null, team,
          pair: pairKey(row.partner1, row.partner2),
          partner1: row.partner1, partner2: row.partner2,
          entryId: `manual_${off.name}_${pairKey(row.partner1, row.partner2)}`.replace(/\s+/g, '_'),
          matchTier: 'exact-surnames', matchAmbiguous: false, provenance: 'manual',
          ours: manual.points, theirs: row.calcPoints ?? 0,
          matched: manual.points === (row.calcPoints ?? 0),
          broke: false, hybrid: row.hybrid,
          ourBase: manual.points, theirBase: row.basePoints,
          ourAdj: 0, theirAdj: row.breakPrelimAdjustment,
          ourPrelimAdj: 0, ourBreakPenalty: 0, ourWalkover: 0, ourFloor: null,
        });
      }
      continue;
    }

    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const t = normalizeTournament(raw);
    const students = buildStudentIndex(raw);
    const selectOpen = openEventFilter(off.name);
    const opens = t.events.filter((e) => selectOpen(e) && !computeFieldStats(e).phantom);
    if (!opens.length) { skippedTournaments.push(off.name); continue; }
    // Usually the same events; different only where a league tournament runs
    // inside another one's field. See EVENT_OVERRIDES.
    const selectField = fieldEventFilter(off.name);
    const fieldEvents = t.events.filter((e) => selectField(e) && !computeFieldStats(e).phantom);

    // Under `sheet` these prefer the league's published figures, so a points
    // mismatch is never just a field-size mismatch wearing a disguise. Under
    // `tabroom` every one is computed from the payload.
    const stats = (fieldEvents.length ? fieldEvents : opens).map(computeFieldStats);
    // Computed once and reused: the breaking record below needs them, and so
    // does the per-entry loop.
    const perfByEvent = opens.map((ev) => computeEntryPerformances(ev));
    const perfs = perfByEvent.flatMap((m) => [...m.values()]);
    const openField = fromSheet(off.openField) ?? stats.reduce((a, s) => a + s.fieldSize, 0);
    // XXI.2.B -- AFS is the open field *plus* the novice/JV field, both with
    // XXI.2.A's forfeit exclusion applied. Falling back to the open field alone
    // reads Berkeley as 104 where the league has 141, which is not a rounding
    // difference but a different row of the elim points table.
    //
    // XXI.6.C: where a tournament runs several open divisions each counts on
    // its own and novice/JV is not added to any of them.
    const njvField = stats.length > 1
      ? 0
      : t.events
        .filter((e) => e.isParli && (e.division === 'jv' || e.division === 'novice'))
        .map(computeFieldStats)
        .filter((f) => !f.phantom)
        .reduce((a, f) => a + f.fieldSize, 0);
    const afs = fromSheet(off.afs) ?? openField + njvField;
    const elimField = fromSheet(off.openElimField) ?? stats.reduce((a, s) => a + s.elimField, 0);
    const breakPct = fromSheet(off.breakPct) ?? (openField ? (100 * elimField) / openField : 0);
    const prelimCount = fromSheet(off.prelimCount) ?? Math.max(...stats.map((s) => s.prelimCount));
    // XXI.3.B's floor needs the lowest-seeded breaking record, which the sheet
    // publishes and Tabroom does not state. Derived from the entries that broke.
    const breakingRecord = (sources.breakingRecord === 'sheet'
      ? parseRecord(off.breakingRecord)
      : undefined) ?? lowestBreakingRecord(perfs);
    const ctx = { afs, breakPct, prelimCount, breakingRecord };

    interface Mine {
      wins: number; losses: number; elimLevel: ElimLevel | null;
      size: boolean; prelimBallotsWon: number; elimWins: number;
      /** XXI.5.C derived from the bracket; used when the source is `tabroom`. */
      walkover: number;
    }
    const byEntry = new Map<string, Mine>();
    const candidates: EntryCandidate[] = [];

    for (const [evIndex, ev] of opens.entries()) {
      const perf = perfByEvent[evIndex]!;
      for (const [entryId, entry] of ev.entries) {
        const people = entry.studentIds
          .map((sid) => students.get(sid))
          .filter((x): x is { first: string; last: string } => !!x && !!x.last);
        // Entries known only from ballots have no student records; fall back to
        // the names carried on the entry label itself.
        const resolved = people.length ? people : peopleFromEntryLabel(entry.name, entry.code);
        if (resolved.length === 0) continue;
        const p = perf.get(entryId)!;
        // Elim *wins* are round wins, not ballots: a 3-0 panel is one win.
        const elimRoundWins = ev.rounds.filter((r) => r.isElim).filter((r) =>
          r.sections.some((sec) => {
            const mineB = sec.ballots.filter((b) => b.entryId === entryId);
            return mineB.length > 0 && mineB.filter((b) => b.won === true).length * 2 > mineB.length;
          }),
        ).length;
        byEntry.set(entryId, {
          wins: p.wins, losses: p.losses, elimLevel: p.elimLevel,
          size: entry.eligibleTeamSize,
          prelimBallotsWon: p.prelimBallotsWon,
          elimWins: p.elimWins,
          walkover: p.walkoverAdjustment,
        });
        candidates.push({ entryId, schoolName: entry.schoolName, people: resolved });
      }
    }

    const teams = sheetRows.map((r) => ({
      partner1: r.partner1,
      partner2: r.partner2,
      school: r.school1,
    }));
    const result = matchTeams(teams, candidates);

    for (const [i, m] of result.matches) {
      const row = sheetRows[i]!;
      const mine = byEntry.get(m.entryId);
      if (!mine) continue;
      const team = teamKey(row.school1, row.partner1, row.partner2);
      // An unbreakable tie is not a match. Scoring it would attribute one
      // partnership's result to another, which is worse than a gap.
      if (m.ambiguous) {
        ambiguous.push({ tournament: off.name, team });
        continue;
      }

      const isQualifier = (off.category === 'CHSSA' || off.category === 'OSAA')
        ? ({ qual: 8, alt: 4 } as Record<string, number>)[row.result.toLowerCase()]
        : undefined;
      const isToc = /NPDL-TOC/i.test(off.name);
      const walkover = sources.walkover === 'sheet'
        ? (row.walkoverAdjustment ?? 0)
        : mine.walkover;
      const sb = isQualifier !== undefined
        ? { points: isQualifier, basePoints: isQualifier, prelimCountAdjustment: 0, breakPenalty: 0,
            walkoverAdjustment: 0, floorApplied: 'none' as const, excluded: null, broke: false }
        : isToc
          ? scoreToc({
              prelimBallotsWon: mine.prelimBallotsWon,
              broke: mine.elimLevel !== null,
              elimWins: mine.elimWins,
              champion: mine.elimLevel === 'first',
              walkoverAdjustment: walkover,
            }, breakPct)
          : scoreEntry({
              wins: mine.wins, losses: mine.losses, elimLevel: mine.elimLevel,
              eligibleTeamSize: mine.size, walkoverAdjustment: walkover,
            }, ctx);

      cases.push({
        tournament: off.name,
        category: off.category || '(none)',
        tournId: off.tournId!,
        school: row.school1,
        hybridSchool: row.school2 || null,
        team,
        pair: pairKey(row.partner1, row.partner2),
        partner1: row.partner1,
        partner2: row.partner2,
        entryId: m.entryId,
        matchTier: m.tier,
        matchAmbiguous: m.ambiguous,
        provenance: 'tabroom',
        ours: sb.points,
        theirs: row.calcPoints ?? 0,
        matched: sb.points === (row.calcPoints ?? 0),
        broke: mine.elimLevel !== null,
        hybrid: row.hybrid,
        ourBase: sb.basePoints,
        theirBase: row.basePoints,
        ourAdj: sb.prelimCountAdjustment + sb.breakPenalty,
        theirAdj: row.breakPrelimAdjustment,
        ourPrelimAdj: sb.prelimCountAdjustment,
        ourBreakPenalty: sb.breakPenalty,
        ourWalkover: sb.walkoverAdjustment,
        ourFloor: sb.floorApplied ?? null,
      });
    }
    for (const i of result.unmatched) {
      const row = sheetRows[i]!;
      const team = teamKey(row.school1, row.partner1, row.partner2);

      // Hand-entered results for tournaments Tabroom does not carry.
      const manual = MANUAL_RESULTS.find(
        (m) => m.tournament === off.name && pairKey(m.partner1, m.partner2) === pairKey(row.partner1, row.partner2),
      );
      // Prelim-only formats need no bracket: the record alone determines the
      // points, so a row the matcher could not place is still scoreable from
      // the league's own recorded result. Marked as such, because it is a
      // weaker check than recomputing from rounds.
      const record = parseRecord(row.result);
      const prelimOnly = (off.category === 'CHSSA' || off.category === 'OSAA');
      const qualifier = prelimOnly
        ? ({ qual: 8, alt: 4 } as Record<string, number>)[row.result.toLowerCase()]
        : undefined;
      const fallback = manual
        ? { points: manual.points, provenance: 'manual' as const }
        : qualifier !== undefined
          ? { points: qualifier, provenance: 'sheet-record' as const }
          : prelimOnly && record
            ? { points: prelimPoints(record.wins, record.losses), provenance: 'sheet-record' as const }
            : null;

      if (!fallback) {
        unmatched.push({ tournament: off.name, team });
        continue;
      }
      cases.push({
        tournament: off.name,
        category: off.category || '(none)',
        tournId: off.tournId ?? '',
        school: row.school1,
        hybridSchool: row.school2 || null,
        team,
        pair: pairKey(row.partner1, row.partner2),
        partner1: row.partner1,
        partner2: row.partner2,
        entryId: `${fallback.provenance}_${off.name}_${pairKey(row.partner1, row.partner2)}`.replace(/\s+/g, '_'),
        matchTier: 'exact-surnames',
        matchAmbiguous: false,
        provenance: fallback.provenance,
        ours: fallback.points,
        theirs: row.calcPoints ?? 0,
        matched: fallback.points === (row.calcPoints ?? 0),
        broke: false,
        hybrid: row.hybrid,
        ourBase: fallback.points,
        ourPrelimAdj: 0, ourBreakPenalty: 0, ourWalkover: 0, ourFloor: null,
        theirBase: row.basePoints,
        ourAdj: 0,
        theirAdj: row.breakPrelimAdjustment,
      });
    }
  }

  return { cases, unmatched, ambiguous, skippedTournaments, workbook, officialTournaments, officialEntries };
}
