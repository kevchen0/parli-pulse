import {
  FORFEITS_EXCLUDED_FROM_FIELD_SIZE,
  REQUIRED_TEAM_SIZE,
  WALKOVER_ADJUSTMENTS,
  elimLevelFromSectionCount,
  type ElimLevel,
} from '@parli-pulse/rules';
import { classifyDivision, isParliEvent, type Division } from './divisions.ts';
import type {
  TabroomEvent,
  TabroomId,
  TabroomRound,
  TabroomTournament,
} from './tabroom-types.ts';

/** Tabroom returns ids as strings or numbers depending on field and tournament. */
export const id = (v: TabroomId | undefined | null): string | null =>
  v === undefined || v === null || v === '' ? null : String(v);

const num = (v: string | number | undefined | null): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Tabroom's round `type` names the *pairing method*, not the stage. 'highlow'
 * and 'highhigh' are both preliminary pairing schemes; missing 'highhigh' costs
 * the entire CHSSA league slate, which pairs high-high throughout.
 */
const PRELIM_TYPES = new Set(['prelim', 'highlow', 'high-low', 'highhigh', 'high-high']);
const ELIM_TYPES = new Set(['elim', 'final', 'finals', 'runoff']);

export const isPrelimRound = (r: TabroomRound): boolean =>
  PRELIM_TYPES.has((r.type ?? '').toLowerCase());
export const isElimRound = (r: TabroomRound): boolean =>
  ELIM_TYPES.has((r.type ?? '').toLowerCase());

export interface NormalizedEntry {
  entryId: string;
  code: string | null;
  name: string | null;
  schoolId: string | null;
  schoolName: string | null;
  studentIds: string[];
  /** XXI.1.G: only two-person teams are eligible for points. */
  eligibleTeamSize: boolean;
  hybrid: boolean;
  dropped: boolean;
}

export interface NormalizedBallot {
  ballotId: string | null;
  entryId: string | null;
  /** Denormalized on the ballot; the only name source for detached entries. */
  entryCode: string | null;
  entryName: string | null;
  side: number | null;
  judgeId: string | null;
  judgePersonId: string | null;
  /** null when the ballot carries no win/loss score at all. */
  won: boolean | null;
  /** Speaker points with the debater they were awarded to. */
  speakerPoints: { debaterId: string | null; value: number }[];
}

export interface NormalizedSection {
  sectionId: string | null;
  entryIds: string[];
  ballots: NormalizedBallot[];
  /** A section with a single entry: the team advanced without debating. */
  isBye: boolean;
  /** No ballot in the section carries a win/loss score. */
  unscored: boolean;
}

export interface NormalizedRound {
  roundId: string | null;
  name: string;
  /**
   * Tabroom's own short label for the round, where the tournament set one.
   *
   * Usually decorative -- "Finals", "Octos", "Quarters". At NYPDL it is load
   * bearing: the shared pool's two brackets are labelled `VO`/`VQ`/`VS`/`VF`
   * and `NQ`/`NS`/`NF`, which is the tournament stating outright which rounds
   * belong to which bracket. See partitionElimRounds.
   */
  label: string;
  type: string;
  isPrelim: boolean;
  isElim: boolean;
  sections: NormalizedSection[];
  /** Bracket implied by the section count; null if not a power-of-two bracket. */
  elimLevel: ElimLevel | null;
}

export interface NormalizedEvent {
  eventId: string;
  name: string;
  abbr: string | null;
  division: Division;
  isParli: boolean;
  entries: Map<string, NormalizedEntry>;
  rounds: NormalizedRound[];
  prelimCount: number;
  /**
   * Prelim wins as published by tab, keyed by entry id, read from the
   * `Prelim Seeds` result set's `WinPm` key. Authoritative where present:
   * counting win/loss ballots undercounts whenever a result was never entered.
   */
  publishedPrelimWins: Map<string, number>;
  /**
   * Prelim *ballots* won, from the seed set's `BalPm` key. Distinct from wins:
   * XXI.4.A pays per ballot, and a panelled round awards several. Tab computes
   * this itself and knows the outcome of rounds whose ballots were never
   * entered, which no amount of counting can recover.
   */
  publishedPrelimBallots: Map<string, number>;
  /**
   * Round-by-round prelim results recovered from the `Final Places` result
   * set, for events that published no pairings at all. Several CHSSA league
   * tournaments report only standings; without this they score nothing.
   */
  publishedRecords: Map<string, { wins: number; losses: number; rounds: number }>;
  /**
   * Entries the `Final Places` result set marks as champion. Normally one, but
   * a closeout (XXI.5.B) produces several -- Tabroom writes "Co-Champion", and
   * some tournaments simply list two "1st" rows.
   *
   * This is the one place place-labels earn their keep. Round data alone
   * cannot distinguish a closeout from a final whose result was never entered,
   * and the two differ by a full level: 6 points in every band.
   */
  finalPlacesChampions: Set<string>;
  /**
   * Entry -> its prelim seed, from the `Prelim Seeds` result set.
   *
   * Used to recover a team that broke and then debated no elim round at all,
   * which is invisible in the round data and still counts toward the elim
   * field. See computeFieldStats.
   */
  prelimSeeds: Map<string, number>;
}

export interface NormalizedTournament {
  tournId: string;
  name: string;
  start: string | null;
  end: string | null;
  events: NormalizedEvent[];
}

function normalizeSection(raw: NonNullable<TabroomEvent['rounds']>[number]['sections']) {
  return (raw ?? []).map((s): NormalizedSection => {
    const ballots = (s.ballots ?? []).map((b): NormalizedBallot => {
      const scores = b.scores ?? [];
      const wl = scores.find((x) => x.tag === 'winloss' && x.value !== undefined);
      const wlValue = wl ? num(wl.value) : null;
      return {
        ballotId: id(b.id),
        entryId: id(b.entry),
        entryCode: b.entry_code ?? null,
        entryName: b.entry_name ?? null,
        side: num(b.side),
        judgeId: id(b.judge),
        judgePersonId: id(b.judge_person),
        won: wlValue === null ? null : wlValue >= 1,
        speakerPoints: scores
          .filter((x) => x.tag === 'point')
          .map((x) => ({ debaterId: id(x.speaker), value: num(x.value) }))
          .filter((x): x is { debaterId: string | null; value: number } => x.value !== null),
      };
    });
    const entryIds = [...new Set(ballots.map((b) => b.entryId).filter((x): x is string => !!x))];
    return {
      sectionId: id(s.id),
      entryIds,
      ballots,
      isBye: entryIds.length === 1,
      unscored: ballots.every((b) => b.won === null),
    };
  });
}

export function normalizeTournament(t: TabroomTournament): NormalizedTournament {
  const tournId = id(t.id) ?? 'unknown';

  // Entry -> school, built once across the whole payload. Entries are listed
  // under schools, but an event's `rounds` can reference entries that are no
  // longer linked to it (see Stanford 35262 in plan/02-findings.md), so this
  // map is keyed by entry id rather than nested under the event.
  const entriesByEvent = new Map<string, Map<string, NormalizedEntry>>();
  for (const school of t.schools ?? []) {
    const schoolId = id(school.id);
    const schoolName = school.name ?? null;
    for (const e of school.entries ?? []) {
      const eventId = id(e.event);
      const entryId = id(e.id);
      if (!eventId || !entryId) continue;
      const studentIds = (e.students ?? []).map((s) => id(s)).filter((x): x is string => !!x);
      if (!entriesByEvent.has(eventId)) entriesByEvent.set(eventId, new Map());
      entriesByEvent.get(eventId)!.set(entryId, {
        entryId,
        code: e.code ?? null,
        name: e.name ?? null,
        schoolId,
        schoolName,
        studentIds,
        eligibleTeamSize: studentIds.length === REQUIRED_TEAM_SIZE,
        hybrid: e.hybrid !== null && e.hybrid !== undefined && String(e.hybrid) !== '0',
        dropped: String(e.dropped ?? '0') === '1',
      });
    }
  }

  const events: NormalizedEvent[] = [];
  for (const cat of t.categories ?? []) {
    for (const ev of cat.events ?? []) {
      const eventId = id(ev.id);
      if (!eventId) continue;
      const name = ev.name ?? '';
      const rounds = (ev.rounds ?? []).map((r): NormalizedRound => {
        const sections = normalizeSection(r.sections);
        return {
          roundId: id(r.id),
          name: String(r.name ?? ''),
          label: String(r.label ?? '').trim(),
          type: r.type ?? '',
          isPrelim: isPrelimRound(r),
          isElim: isElimRound(r),
          sections,
          elimLevel: isElimRound(r) ? elimLevelFromSectionCount(sections.length) : null,
        };
      });

      const entries = entriesByEvent.get(eventId) ?? new Map<string, NormalizedEntry>();
      // Fallback: adopt entries seen only in ballots, so a detached event still
      // reports a field. These carry no school until resolved elsewhere.
      for (const r of rounds) {
        for (const s of r.sections) {
          for (const entryId of s.entryIds) {
            if (!entries.has(entryId)) {
              const b = s.ballots.find((x) => x.entryId === entryId);
              entries.set(entryId, {
                entryId,
                code: b?.entryCode ?? null,
                name: b?.entryName ?? null,
                schoolId: null,
                schoolName: null,
                studentIds: [],
                eligibleTeamSize: false,
                hybrid: false,
                dropped: false,
              });
            }
          }
        }
      }

      // `Prelim Seeds` carries tab's own totals; prefer them over counting.
      const publishedPrelimWins = new Map<string, number>();
      const publishedPrelimBallots = new Map<string, number>();
      for (const rs of ev.result_sets ?? []) {
        if (rs.tag !== 'seed') continue;
        for (const [tag, target] of [
          ['WinPm', publishedPrelimWins],
          ['BalPm', publishedPrelimBallots],
        ] as const) {
          const key = (rs.result_keys ?? []).find((k) => k.tag === tag);
          if (!key) continue;
          const keyId = id(key.id);
          for (const res of rs.results ?? []) {
            const entryId = id(res.entry);
            const v = (res.values ?? []).find((x) => id(x.result_key) === keyId);
            if (!entryId || v?.value === undefined) continue;
            const n = Number(v.value);
            if (Number.isFinite(n)) target.set(entryId, n);
          }
        }
      }

      // Tab's per-entry summary string, e.g. "\nR1   W |\nR2  BYE  \nR3   L |".
      // A bye counts as a win, matching how the round data is scored.
      const parseBallotString = (v: string): { wins: number; losses: number; rounds: number } => {
        let wins = 0, losses = 0, rounds = 0;
        for (const m of v.matchAll(/R(\d+)\s+(BYE|W|L)\b/gi)) {
          rounds++;
          const token = m[2]!.toUpperCase();
          if (token === 'L') losses++;
          else wins++;
        }
        return { wins, losses, rounds };
      };

      const publishedRecords = new Map<string, { wins: number; losses: number; rounds: number }>();
      for (const rs of ev.result_sets ?? []) {
        if (rs.tag !== 'final' && rs.tag !== 'seed') continue;
        const ballotKey = id((rs.result_keys ?? []).find((k) => k.tag === 'Ballots')?.id);
        const winKey = id((rs.result_keys ?? []).find((k) => k.tag === 'Win' || k.tag === 'WinPm')?.id);
        if (!ballotKey && !winKey) continue;
        for (const res of rs.results ?? []) {
          const entryId = id(res.entry);
          if (!entryId || publishedRecords.has(entryId)) continue;
          const values = res.values ?? [];
          const ballots = values.find((v) => id(v.result_key) === ballotKey)?.value;
          if (typeof ballots === 'string' && /R\d/.test(ballots)) {
            const parsed = parseBallotString(ballots);
            if (parsed.rounds > 0) { publishedRecords.set(entryId, parsed); continue; }
          }
          const w = Number(values.find((v) => id(v.result_key) === winKey)?.value);
          if (Number.isFinite(w)) publishedRecords.set(entryId, { wins: w, losses: 0, rounds: 0 });
        }
      }

      const prelimSeeds = new Map<string, number>();
      for (const rs of ev.result_sets ?? []) {
        if (!/prelim\s*seed/i.test(String(rs.label ?? rs.tag ?? ''))) continue;
        for (const res of rs.results ?? []) {
          const e = id(res.entry);
          const rank = Number(res.rank);
          if (e && Number.isFinite(rank)) prelimSeeds.set(e, rank);
        }
      }

      const finalPlacesChampions = new Set<string>();
      for (const rs of ev.result_sets ?? []) {
        if (rs.tag !== 'final') continue;
        for (const res of rs.results ?? []) {
          const place = (res.place ?? '').trim();
          if (!/^(1st|1|first|champion|co-?champ)/i.test(place)) continue;
          const e = id(res.entry);
          if (e) finalPlacesChampions.add(e);
        }
      }

      events.push({
        eventId,
        name,
        abbr: ev.abbr ?? null,
        division: classifyDivision(name, ev.abbr, `${tournId}:${eventId}`),
        isParli: isParliEvent(name, ev.abbr),
        entries,
        rounds,
        prelimCount: rounds.filter((r) => r.isPrelim).length,
        publishedPrelimWins,
        publishedPrelimBallots,
        publishedRecords,
        finalPlacesChampions,
        prelimSeeds,
      });
    }
  }

  return {
    tournId,
    name: t.name ?? '',
    start: t.start ?? null,
    end: t.end ?? null,
    events,
  };
}

export interface EventFieldStats {
  rawEntries: number;
  /** Entries missing a win/loss in >= 2 prelims (XXI.2.A). */
  forfeitedOut: number;
  /** Raw entries minus forfeit exclusions. */
  fieldSize: number;
  /** Distinct entries in the main elim bracket -- bye-aware, consolation excluded. */
  elimField: number;
  /** Bracket size implied by the first main-bracket round, for comparison. */
  firstElimBracket: number | null;
  prelimCount: number;
  byeCount: number;
  /** No entries and no ballots: a division that was created but never used. */
  phantom: boolean;
  /**
   * True when the event published no win/loss scores at all. Forfeit exclusion
   * is meaningless here and is skipped; points must come from `result_sets`.
   */
  unscored: boolean;
  /** Elim rounds excluded as a separate consolation/novice bracket. */
  consolationRounds: string[];
}

/**
 * Splits an event's elim rounds into the main bracket and any consolation
 * bracket running alongside it.
 *
 * NYPDL runs both inside a single Tabroom event. Its format is one shared
 * preliminary pool with no separate novice prelims; every team at 4-1 or
 * better breaks to the open elims, and the teams below that line break into a
 * separate novice bracket of fixed size. Their rounds interleave in the round
 * list. Only the open bracket is the elim field for XXI.2.
 *
 * Verified across the 2025-26 NYPDL slate: in 15 of 17 tournaments the open
 * bracket contains exactly the 5-0 and 4-1 teams, and the parallel bracket
 * exactly the 3-2s and 2-3s. Two tournaments differ -- November California
 * broke 3-2s into the open bracket as well -- so the break line is read from
 * the data rather than assumed to sit at 4-1.
 *
 * The two brackets never share a team, so we start at the last elim round and
 * walk backwards, keeping any round that shares a team with what we've already
 * kept. Everything left over is consolation.
 */
/**
 * The tournament's own statement of which bracket a round is in, where it made
 * one: NYPDL labels its varsity rounds `VO`/`VQ`/`VS`/`VF` and its novice
 * rounds `NQ`/`NS`/`NF`, and other tournaments write `Var1`/`Nov1` or
 * `Novice Finals`.
 *
 * Only trusted when every elim round carries a label, all of them begin with V
 * or N, and both letters appear. That is deliberately narrow: it fires on the
 * 15 shared-pool events in 2025-26 and on nothing whose labels are the ordinary
 * decorative "Octos"/"Finals", where the letters would mean nothing. A partition
 * read off what the tab director wrote beats one inferred from bracket shape,
 * which is why it is tried first.
 */
function partitionByLabel(elims: NormalizedRound[]): {
  main: NormalizedRound[];
  consolation: NormalizedRound[];
} | null {
  if (!elims.every((r) => r.label)) return null;
  const varsity = (r: NormalizedRound): boolean => /^v/i.test(r.label);
  const novice = (r: NormalizedRound): boolean => /^n/i.test(r.label);
  if (!elims.every((r) => varsity(r) || novice(r))) return null;
  if (!elims.some(varsity) || !elims.some(novice)) return null;
  return { main: elims.filter(varsity), consolation: elims.filter(novice) };
}

export function partitionElimRounds(rounds: NormalizedRound[]): {
  main: NormalizedRound[];
  consolation: NormalizedRound[];
} {
  const elims = rounds.filter((r) => r.isElim);
  if (elims.length <= 1) return { main: elims, consolation: [] };

  const labelled = partitionByLabel(elims);
  if (labelled) return labelled;

  const teamsOf = (r: NormalizedRound): Set<string> =>
    new Set(r.sections.flatMap((s) => s.entryIds));

  // The championship round is the smallest, latest round; ties go to the one
  // Tabroom typed 'final'.
  const ordered = [...elims].sort((a, b) => {
    const na = Number(a.name);
    const nb = Number(b.name);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return rounds.indexOf(a) - rounds.indexOf(b);
  });
  const championship =
    [...ordered].reverse().find((r) => r.type.toLowerCase().startsWith('final')) ??
    ordered[ordered.length - 1]!;

  const main = [championship];
  const seen = teamsOf(championship);
  for (const r of [...ordered].reverse()) {
    if (r === championship) continue;
    const teams = teamsOf(r);
    if ([...teams].some((t) => seen.has(t))) {
      main.push(r);
      for (const t of teams) seen.add(t);
    }
  }

  const mainSet = new Set(main);
  return {
    main: ordered.filter((r) => mainSet.has(r)),
    consolation: ordered.filter((r) => !mainSet.has(r)),
  };
}

/**
 * Teams that broke and then debated no elim round at all.
 *
 * They are invisible in the round data -- Tabroom pairs nobody against them --
 * and the league still counts them in the elim field, which is the numerator of
 * the break percentage that drives XXI.2.D. One such team at NYPDL October OL
 * takes the break from 20.0% to 18.8%, across a threshold, costing every
 * breaking team at the tournament a point.
 *
 * Recovering one needs three things to line up, and all three are necessary:
 *
 *  - **The bracket has an unused slot.** A full bracket has nothing missing: at
 *    Nueva the fourth seed withdrew and the ninth was pulled up from below the
 *    line to fill the eight slots, so the gap in the seeds is not a team that
 *    broke. October OL's bracket held sixteen slots and fifteen teams.
 *  - **The gap sits below a seed that did break.** Seeds are only evidence
 *    where the bracket reached past them.
 *  - **The team's record is at least the worst that did break.** NYPDL November
 *    OL has a seed-10 gap at 2-3 against a bracket whose worst is 4-1: that
 *    team did not break, it simply is not in the bracket.
 *
 * Reproduces the league's open elim field for 78 of 80 tournaments, against 76
 * without it, and moves nothing else. `npm run backtest:fields` reruns it.
 */
function recoverAbsentBreakers(
  event: NormalizedEvent,
  main: NormalizedRound[],
  elimEntries: ReadonlySet<string>,
): number {
  if (elimEntries.size === 0 || event.prelimSeeds.size === 0) return 0;

  const widest = main.reduce((w, r) => Math.max(w, r.sections.length), 0);
  const unfilled = widest * 2 - elimEntries.size;
  if (unfilled <= 0) return 0;

  const seedOf = event.prelimSeeds;
  const ranks = [...elimEntries].map((e) => seedOf.get(e)).filter((r): r is number => r != null);
  if (ranks.length !== elimEntries.size) return 0;
  const present = new Set(ranks);
  const deepest = Math.max(...ranks);

  const perf = computeEntryPerformances(event);
  // The break line, read off the teams that actually appeared.
  let lineWins = Infinity;
  let lineLosses = -Infinity;
  for (const e of elimEntries) {
    const p = perf.get(e);
    if (!p) continue;
    if (p.wins < lineWins || (p.wins === lineWins && p.losses > lineLosses)) {
      lineWins = p.wins;
      lineLosses = p.losses;
    }
  }
  if (!Number.isFinite(lineWins)) return 0;

  const byRank = new Map<number, string>();
  for (const [entryId, rank] of seedOf) if (event.entries.has(entryId)) byRank.set(rank, entryId);

  let recovered = 0;
  for (let rank = 1; rank < deepest && recovered < unfilled; rank++) {
    if (present.has(rank)) continue;
    const entryId = byRank.get(rank);
    if (!entryId) continue;
    const p = perf.get(entryId);
    if (!p) continue;
    const clearedTheLine = p.wins > lineWins || (p.wins === lineWins && p.losses <= lineLosses);
    if (clearedTheLine) recovered++;
  }
  return recovered;
}

/**
 * Field sizes per XXI.2.A.
 *
 * Three things here are easy to get wrong and all change points:
 *  - teams forfeiting two or more prelims leave the field entirely;
 *  - the elim field counts teams that actually broke, which is not
 *    `sections * 2` when the bracket contains byes;
 *  - a consolation bracket sharing the event is not part of the elim field.
 */
export function computeFieldStats(event: NormalizedEvent): EventFieldStats {
  const prelims = event.rounds.filter((r) => r.isPrelim);
  const scoredPrelims = new Map<string, number>();
  const prelimByes = new Map<string, number>();
  let anyScored = false;
  /**
   * Whether any *prelim* carries a result, which is the only thing forfeit
   * exclusion can be measured against. `anyScored` is true when an elim was
   * scored too, and several tournaments publish elim results without prelim
   * ones -- at Bargain Belt that made every team look like it had never
   * competed, and excluded the entire field.
   */
  let anyPrelimScored = false;
  for (const r of event.rounds) {
    for (const s of r.sections) {
      for (const b of s.ballots) {
        if (!b.entryId) continue;
        if (b.won !== null) {
          anyScored = true;
          if (r.isPrelim) {
            anyPrelimScored = true;
            scoredPrelims.set(b.entryId, (scoredPrelims.get(b.entryId) ?? 0) + 1);
          }
        } else if (r.isPrelim && s.isBye) {
          // Counted as a win in computeEntryPerformances; here it only needs to
          // not look like a forfeit.
          prelimByes.set(b.entryId, (prelimByes.get(b.entryId) ?? 0) + 1);
        }
      }
    }
  }

  // XXI.2.A -- "teams that forfeited two or more prelims shall not count
  // toward field size".
  //
  // Taken literally (count prelims with no win/loss, threshold 2) this
  // over-excludes badly: it reproduces the official open field for only 62% of
  // tournaments, because an unscored ballot is usually a result nobody entered
  // rather than a forfeit. At Harvard, two teams had two unscored prelims each
  // and the league counted both in the field; the five it did exclude were
  // exactly the five Tabroom had flagged `dropped`.
  //
  // Matching the league's actual behaviour needs three corrections:
  //  - a bye also leaves no win/loss, and is not a forfeit;
  //  - the operative signal is a team that stopped competing, which Tabroom
  //    records as `dropped`;
  //  - the rest is a team that never competed at all -- no prelim of theirs was
  //    ever scored. Not a count of missing rounds: an absolute threshold has to
  //    mean different things at a four-round tournament and a six-round one,
  //    and every threshold measured did worse.
  //
  // Swept against the 81 tournaments whose open field the sheet publishes:
  //
  //   literal, two or more missing        26/81  (32%)
  //   dropped only                        63/81  (78%)
  //   dropped or three or more missing    72/81  (89%)
  //   dropped or four or more missing     74/81  (91%)
  //   dropped or more than half missing   73/81  (90%)
  //   dropped or nothing scored           76/81  (94%)
  //
  // Of the five it still misses, two are known gaps -- Ridge Debates published
  // four of twenty-eight teams, and the Round Robin's field is Nationals' --
  // and three are off by one. `npm run backtest:fields` reruns it.
  //
  // This remains a divergence from XXI.2.A as written and is worth confirming
  // with the Reporting Director. See plan/07-open-questions.md.
  let forfeitedOut = 0;
  for (const [entryId, entry] of event.entries) {
    if (entry.dropped) {
      forfeitedOut++;
      continue;
    }
    // Nothing to measure against: no prelim here carries a result.
    if (!anyPrelimScored) continue;
    const competed =
      (scoredPrelims.get(entryId) ?? 0) + (prelimByes.get(entryId) ?? 0);
    if (competed === 0) forfeitedOut++;
  }

  const { main, consolation } = partitionElimRounds(event.rounds);
  const elimEntries = new Set<string>();
  let byeCount = 0;
  for (const r of main) {
    for (const s of r.sections) {
      if (s.isBye) byeCount++;
      for (const e of s.entryIds) elimEntries.add(e);
    }
  }
  const elimField = elimEntries.size + recoverAbsentBreakers(event, main, elimEntries);

  return {
    rawEntries: event.entries.size,
    forfeitedOut,
    fieldSize: event.entries.size - forfeitedOut,
    elimField,
    firstElimBracket: main.length ? main[0]!.sections.length * 2 : null,
    prelimCount: prelims.length,
    byeCount,
    phantom:
      event.entries.size === 0 &&
      event.rounds.every((r) => r.sections.every((sec) => sec.ballots.length === 0)),
    unscored: !anyScored,
    consolationRounds: consolation.map((r) => r.name),
  };
}

export interface EntryPerformance {
  entryId: string;
  wins: number;
  losses: number;
  /** Highest elim level reached in the main bracket, null if the team did not break. */
  elimLevel: ElimLevel | null;
  /** True when the team reached the championship round and won it. */
  wonFinal: boolean;
  /** Elim sections where this team faced a same-school opponent with no result. */
  sameSchoolWalkovers: number;
  /**
   * XXI.5.C, derived from the bracket: -2 for each teammate walked over, +2 for
   * each time this team stood down, and -3 for a finals closeout.
   *
   * The signature is a same-school elim section that drew a **short panel** --
   * fewer ballots than the same round gave its other sections. Two things it is
   * deliberately not:
   *
   *  - not "same school", because teammates do sometimes debate. Harvard's
   *    octafinal between two Menlo-Atherton teams went 2-1 on a full panel and
   *    the league records no adjustment for it;
   *  - not "no result entered", because a walkover still carries a token ballot
   *    naming whoever went through. That test finds 4 of roughly 47.
   *
   * Reproduces the league's own column for 1,525 of 1,541 matched entries;
   * `npm run check:walkovers` reruns it. Eleven of the sixteen residuals are
   * closeouts Tabroom holds no section for at all -- when a final or semi is
   * conceded, some tournaments never create the round.
   */
  walkoverAdjustment: number;
  /**
   * Prelim ballots won, for XXI.4.A's ballot-counted schedule. Not the same as
   * `wins`: panelled prelims award several ballots per round.
   */
  prelimBallotsWon: number;
  /** Prelim ballots available to the team, won or lost. */
  prelimBallotsTotal: number;
  /**
   * Elim rounds won, derived from how far up the bracket the team went rather
   * than by counting published rounds. XXI.4.A pays per elim win, and the
   * final round is frequently missing from Tabroom, which would otherwise
   * short a champion by a whole win.
   */
  elimWins: number;
}

/**
 * Per-entry prelim record and elim depth.
 *
 * Elim depth is taken from the main bracket only, and from section counts
 * rather than result labels; see `partitionElimRounds` and
 * `elimLevelFromSectionCount` for why.
 */
export function computeEntryPerformances(event: NormalizedEvent): Map<string, EntryPerformance> {
  const out = new Map<string, EntryPerformance>();
  const get = (entryId: string): EntryPerformance => {
    let p = out.get(entryId);
    if (!p) {
      p = {
        entryId, wins: 0, losses: 0, elimLevel: null, wonFinal: false,
        sameSchoolWalkovers: 0, walkoverAdjustment: 0,
        prelimBallotsWon: 0, prelimBallotsTotal: 0,
        elimWins: 0,
      };
      out.set(entryId, p);
    }
    return p;
  };
  for (const entryId of event.entries.keys()) get(entryId);

  // A round is won on a majority of its ballots, not per ballot: where prelims
  // are panelled, counting ballots turns a 4-round tournament into a 6-0
  // record and puts the team outside the XXI.3.A table entirely.
  const debated = new Map<string, number>();
  // Byes are credited as wins but are not evidence that results were entered;
  // counting them here would suppress the published-record fallback for an
  // event whose only "scored" round is a single bye.
  let scoredBallots = 0;
  for (const r of event.rounds) {
    if (!r.isPrelim) continue;
    const perEntry = new Map<string, { won: number; total: number }>();
    for (const s of r.sections) {
      for (const b of s.ballots) {
        if (!b.entryId) continue;
        // A prelim bye is a win, not an unplayed round: the team sat alone in
        // the section and advances with the round credited to it.
        if (b.won === null) {
          if (!s.isBye) continue;
          const t = perEntry.get(b.entryId) ?? { won: 0, total: 0 };
          t.total++;
          t.won++;
          perEntry.set(b.entryId, t);
          continue;
        }
        scoredBallots++;
        const t = perEntry.get(b.entryId) ?? { won: 0, total: 0 };
        t.total++;
        if (b.won) t.won++;
        perEntry.set(b.entryId, t);
      }
    }
    for (const [entryId, t] of perEntry) {
      const p = get(entryId);
      debated.set(entryId, (debated.get(entryId) ?? 0) + 1);
      if (t.won * 2 > t.total) p.wins++;
      else p.losses++;
    }
  }

  // Where tab published win totals, trust them over counted ballots.
  const prelimCount = event.rounds.filter((r) => r.isPrelim).length;
  for (const [entryId, wins] of event.publishedPrelimWins) {
    const p = out.get(entryId);
    if (p) p.wins = wins;
  }

  // Some events publish standings but nothing to count: either no pairings at
  // all, or pairings whose ballots carry no win/loss. Both leave every team at
  // 0-N, which scores nothing. Recover the record from tab's own summary --
  // but keep going, because the elim rounds may still be scored.
  const usePublished = prelimCount === 0 || scoredBallots === 0;
  if (usePublished) {
    for (const [entryId, rec] of event.publishedRecords) {
      const p = out.get(entryId);
      if (!p || rec.rounds === 0) continue;
      p.wins = rec.wins;
      p.losses = rec.losses;
    }
  } else {
    // Where tab published win totals, trust them over counted ballots.
    for (const [entryId, wins] of event.publishedPrelimWins) {
      const p = out.get(entryId);
      if (p) p.wins = wins;
    }

    // Losses are the rounds a team did not win, not the losses we could find a
    // ballot for. An unscored ballot otherwise shortens the record -- 2-1
    // becomes 2-0 -- and a short record is absent from the XXI.3.A table, so
    // the team silently scores nothing. The league counts the full round
    // schedule; teams that genuinely stopped competing are removed by the
    // forfeit rule instead.
    for (const [entryId, p] of out) {
      if (!event.entries.has(entryId)) continue;
      const played = Math.max(debated.get(entryId) ?? 0, prelimCount);
      p.losses = Math.max(0, played - p.wins);
    }
  }

  // Ballot counts for XXI.4.A.
  //
  // Where tab publishes them, they are authoritative and used directly. An
  // unentered round had a real winner that the ballots do not record, and
  // guessing in either direction is wrong: at the 2025-26 TOC, Campolindo and
  // Evergreen Valley shared such a room and the league credited the round to
  // one of them, not to both. Only tab knows which.
  //
  // The fallback below credits an unentered round at full panel size, which
  // over-credits the loser; it applies only where no published figure exists.
  const prelims = event.rounds.filter((r) => r.isPrelim);
  const panelSizes: number[] = [];
  for (const r of prelims) {
    for (const sec of r.sections) {
      if (sec.entryIds.length < 2) continue;
      const scored = sec.ballots.filter((b) => b.won !== null).length;
      if (scored > 0) panelSizes.push(scored / sec.entryIds.length);
    }
  }
  const panelSize = panelSizes.length
    ? [...panelSizes].sort((a, b) => panelSizes.filter((v) => v === a).length - panelSizes.filter((v) => v === b).length).pop()!
    : 1;

  for (const [entryId, p] of out) {
    const published = event.publishedPrelimBallots.get(entryId);
    if (published !== undefined) {
      p.prelimBallotsWon = published;
      p.prelimBallotsTotal = prelims.length * panelSize;
      continue;
    }
    for (const r of prelims) {
      const mine = r.sections.flatMap((sec) => sec.ballots).filter((b) => b.entryId === entryId);
      const scored = mine.filter((b) => b.won !== null);
      if (scored.length > 0) {
        p.prelimBallotsTotal += scored.length;
        p.prelimBallotsWon += scored.filter((b) => b.won === true).length;
      } else {
        p.prelimBallotsTotal += panelSize;
        p.prelimBallotsWon += panelSize;
      }
    }
  }

  const { main } = partitionElimRounds(event.rounds);
  // Deepest bracket first: fewer sections means a later round.
  const ordered = [...main].sort((a, b) => a.sections.length - b.sections.length);
  for (const r of ordered) {
    const level = elimLevelFromSectionCount(r.sections.length);
    if (!level) continue;
    // The largest panel this round gave any of its sections, per side. A
    // walkover section is the one that drew fewer.
    const panelPerSide = (sec: (typeof r.sections)[number], entryId: string): number =>
      sec.ballots.filter((b) => b.entryId === entryId).length;
    const roundMaxBallots = Math.max(
      0,
      ...r.sections.flatMap((sec) => sec.entryIds.map((e) => panelPerSide(sec, e))),
    );

    for (const s of r.sections) {
      const schools = new Set(
        s.entryIds.map((e) => event.entries.get(e)?.schoolId).filter((x): x is string => !!x),
      );
      const sameSchoolPair = s.entryIds.length === 2 && schools.size === 1;
      const walkover = sameSchoolPair && s.unscored;
      for (const entryId of s.entryIds) {
        const p = get(entryId);
        if (walkover) p.sameSchoolWalkovers++;
        if (sameSchoolPair && panelPerSide(s, entryId) < roundMaxBallots) {
          // Who advanced, from the bracket first and the ballots second.
          //
          // Rounds are visited deepest-first, so an entry already holding an
          // elim level went further than this round. That is the reliable
          // signal, but it says nothing at the *deepest published* round, where
          // nobody has a level yet -- and the deepest round is exactly where a
          // walkover is most likely, because a closed-out final is often never
          // created. There the token ballot decides: a walkover still records
          // who went through, even though both sides sometimes carry a loss.
          const wonHere = s.ballots.filter((b) => b.entryId === entryId && b.won === true).length;
          const votedHere = s.ballots.filter((b) => b.entryId === entryId && b.won !== null).length;
          const advanced = p.elimLevel !== null || (votedHere > 0 && wonHere * 2 > votedHere);
          if (level === 'first') p.walkoverAdjustment += WALKOVER_ADJUSTMENTS.finalsCloseout;
          else p.walkoverAdjustment +=
            advanced ? WALKOVER_ADJUSTMENTS.walkingOver : WALKOVER_ADJUSTMENTS.beingWalkedOver;
        }
        // Rounds are visited deepest-first, so the first assignment wins.
        if (p.elimLevel === null) {
          // A round is won on a majority of its ballots. Testing whether any
          // ballot was won makes a 1-2 panel decision look like a victory,
          // which promoted beaten finalists to champion -- a full level, and
          // six points in every band.
          const mine = s.ballots.filter((b) => b.entryId === entryId && b.won !== null);
          const won = mine.filter((b) => b.won === true).length * 2 > mine.length;
          p.elimLevel = level === 'first' && !won ? 'second' : level;
          if (level === 'first' && won) p.wonFinal = true;
        }
      }
    }
  }
  // Tournaments routinely stop publishing before the bracket ends: Nueva
  // posted quarterfinals and a final but no semifinal, and Harvard stopped at
  // semifinals. A team that won its deepest published round did reach the next
  // level, so promote it when that level has no round at all. Guarded on the
  // level being genuinely absent, so a team that simply lost a published round
  // is never promoted.
  /** Entries lifted to co-champion because no final was published. */
  const promotedToFinal = new Set<string>();
  const publishedLevels = new Set(
    main.map((r) => elimLevelFromSectionCount(r.sections.length)).filter((l): l is ElimLevel => l !== null),
  );
  const deeper: Record<ElimLevel, ElimLevel | null> = {
    tripleOcto: 'doubleOcto', doubleOcto: 'octo', octo: 'quarter',
    quarter: 'semi', semi: 'first', second: null, first: null,
  };
  for (const [entryId, p] of out) {
    if (p.elimLevel === null || p.wonFinal) continue;
    const round = ordered.find((r) => r.sections.some((s) => s.entryIds.includes(entryId)));
    if (!round) continue;
    const wonIt = round.sections.some((s) =>
      s.entryIds.includes(entryId) &&
      s.ballots.filter((b) => b.entryId === entryId && b.won === true).length * 2 >
        s.ballots.filter((b) => b.entryId === entryId && b.won !== null).length);
    if (!wonIt) continue;
    const next = deeper[p.elimLevel];
    if (next && !publishedLevels.has(next)) {
      p.elimLevel = next;
      if (next === 'first') p.wonFinal = true;
      if (next === 'first') promotedToFinal.add(entryId);
    }
  }

  // XXI.5.C, the closeout that leaves no round behind.
  //
  // Two teams from one school win the semifinals and the final is never
  // published, because it was never debated: they closed out and share the
  // title. There is no section to read a short panel from -- the round does
  // not exist -- so this is inferred from the shape above it, which is the
  // only witness. Both are already promoted to co-champions by the block
  // above; the closeout is what the league prices at -3 each.
  //
  // Gated on the promoted champions sharing a school, per XXI.5.C. Clackamas
  // Holiday Edge has an unplayed final between West Linn and Beaverton and the
  // league still recorded -3 for both, which the rules text does not provide
  // for; that divergence stays in the disagreement queue rather than being
  // reproduced here. See plan/09-data-quality.md.
  if (promotedToFinal.size >= 2) {
    const schools = new Set(
      [...promotedToFinal].map((id) => event.entries.get(id)?.schoolId ?? `?${id}`),
    );
    if (schools.size === 1) {
      for (const id of promotedToFinal) {
        const p = out.get(id);
        if (p) p.walkoverAdjustment += WALKOVER_ADJUSTMENTS.finalsCloseout;
      }
    }
  }

  // Resolve the championship round. Two failure modes matter and pull in
  // opposite directions: a closeout gives every finalist champion points, and
  // a final whose result was never entered gives none of them champion points.
  // Round data cannot tell them apart, so `Final Places` decides where it
  // speaks -- this is the only judgement it is trusted with.
  const championship = ordered[0];
  if (championship && championship.sections.length === 1) {
    const sec = championship.sections[0]!;
    const champions = event.finalPlacesChampions;
    const knownHere = sec.entryIds.filter((e) => champions.has(e));

    if (knownHere.length > 0) {
      for (const entryId of sec.entryIds) {
        const p = out.get(entryId);
        if (!p) continue;
        const isChampion = champions.has(entryId);
        p.elimLevel = isChampion ? 'first' : 'second';
        p.wonFinal = isChampion;
      }
    } else if (sec.unscored && sec.entryIds.length > 1) {
      // No result and no label. Same school means a closeout; otherwise the
      // result is merely missing and nobody may be promoted to champion.
      const schools = new Set(
        sec.entryIds.map((e) => event.entries.get(e)?.schoolId).filter((x): x is string => !!x),
      );
      const isCloseout = schools.size === 1;
      for (const entryId of sec.entryIds) {
        const p = out.get(entryId);
        if (!p) continue;
        p.elimLevel = isCloseout ? 'first' : 'second';
        p.wonFinal = isCloseout;
      }
    }
  }

  // Elim wins from the bracket ladder: a team that entered at octofinals and
  // won the tournament won four rounds, whether or not all four were posted.
  const LADDER: ElimLevel[] = ['tripleOcto', 'doubleOcto', 'octo', 'quarter', 'semi', 'first'];
  const rung = (l: ElimLevel): number => (l === 'second' ? LADDER.indexOf('first') : LADDER.indexOf(l));
  const entryRung = new Map<string, number>();
  for (const r of main) {
    const level = elimLevelFromSectionCount(r.sections.length);
    if (!level) continue;
    for (const s of r.sections) {
      for (const e of s.entryIds) {
        const v = rung(level);
        if (!entryRung.has(e) || v < entryRung.get(e)!) entryRung.set(e, v);
      }
    }
  }
  for (const [entryId, p] of out) {
    if (p.elimLevel === null) continue;
    const from = entryRung.get(entryId);
    if (from === undefined) continue;
    const to = rung(p.elimLevel);
    p.elimWins = Math.max(0, to - from + (p.wonFinal ? 1 : 0));
  }

  return out;
}

/** Surname lookup for every student in the payload, by Tabroom student id. */
export function buildStudentIndex(t: TabroomTournament): Map<string, { first: string; last: string }> {
  const out = new Map<string, { first: string; last: string }>();
  for (const school of t.schools ?? []) {
    for (const s of school.students ?? []) {
      const sid = id(s.id);
      if (sid) out.set(sid, { first: s.first ?? '', last: s.last ?? '' });
    }
  }
  return out;
}
