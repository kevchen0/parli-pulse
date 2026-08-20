import {
  FORFEITS_EXCLUDED_FROM_FIELD_SIZE,
  REQUIRED_TEAM_SIZE,
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
  side: number | null;
  judgeId: string | null;
  judgePersonId: string | null;
  /** null when the ballot carries no win/loss score at all. */
  won: boolean | null;
  speakerPoints: number[];
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
   * Entry the `Final Places` result set marks as champion, if any. Only used
   * to break ties when a final carries no ballot result; place labels are far
   * too inconsistent to drive anything else. See plan/02-findings.md.
   */
  finalPlacesWinner: string | null;
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
        side: num(b.side),
        judgeId: id(b.judge),
        judgePersonId: id(b.judge_person),
        won: wlValue === null ? null : wlValue >= 1,
        speakerPoints: scores
          .filter((x) => x.tag === 'point')
          .map((x) => num(x.value))
          .filter((n): n is number => n !== null),
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
              entries.set(entryId, {
                entryId,
                code: null,
                name: null,
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

      // `Prelim Seeds` carries tab's own win totals; prefer them over ballots.
      const publishedPrelimWins = new Map<string, number>();
      for (const rs of ev.result_sets ?? []) {
        if (rs.tag !== 'seed') continue;
        const winKey = (rs.result_keys ?? []).find((k) => k.tag === 'WinPm');
        if (!winKey) continue;
        const keyId = id(winKey.id);
        for (const res of rs.results ?? []) {
          const entryId = id(res.entry);
          const v = (res.values ?? []).find((x) => id(x.result_key) === keyId);
          if (!entryId || v?.value === undefined) continue;
          const n = Number(v.value);
          if (Number.isFinite(n)) publishedPrelimWins.set(entryId, n);
        }
      }

      let finalPlacesWinner: string | null = null;
      for (const rs of ev.result_sets ?? []) {
        if (rs.tag !== 'final') continue;
        for (const res of rs.results ?? []) {
          if (/^(1st|1|first|champion)/i.test((res.place ?? '').trim())) {
            finalPlacesWinner = id(res.entry);
            break;
          }
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
        finalPlacesWinner,
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
 * NYPDL tournaments run both inside a single Tabroom event: the top seeds
 * enter the main bracket while the next tier enters a parallel "Novice
 * Bracket", and their rounds interleave in the round list. Only the main
 * bracket counts as the open elim field.
 *
 * The two brackets never share a team, so we start at the last elim round and
 * walk backwards, keeping any round that shares a team with what we've already
 * kept. Everything left over is consolation.
 */
export function partitionElimRounds(rounds: NormalizedRound[]): {
  main: NormalizedRound[];
  consolation: NormalizedRound[];
} {
  const elims = rounds.filter((r) => r.isElim);
  if (elims.length <= 1) return { main: elims, consolation: [] };

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
  for (const r of event.rounds) {
    for (const s of r.sections) {
      for (const b of s.ballots) {
        if (!b.entryId) continue;
        if (b.won !== null) {
          anyScored = true;
          if (r.isPrelim) scoredPrelims.set(b.entryId, (scoredPrelims.get(b.entryId) ?? 0) + 1);
        } else if (r.isPrelim && s.isBye) {
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
  // Matching the league's actual behaviour needs two corrections:
  //  - a bye also leaves no win/loss, and is not a forfeit;
  //  - the operative signal is a team that stopped competing, which Tabroom
  //    records as `dropped`.
  // `dropped` OR three-plus missing reproduces 88% of official open fields,
  // against 62% for the literal reading. See plan/07-open-questions.md -- this
  // divergence from the text is worth confirming with the Reporting Director.
  const MISSING_PRELIM_THRESHOLD = 3;
  let forfeitedOut = 0;
  for (const [entryId, entry] of event.entries) {
    if (entry.dropped) {
      forfeitedOut++;
      continue;
    }
    if (!anyScored) continue;
    const missed =
      prelims.length - (scoredPrelims.get(entryId) ?? 0) - (prelimByes.get(entryId) ?? 0);
    if (missed >= MISSING_PRELIM_THRESHOLD) forfeitedOut++;
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

  return {
    rawEntries: event.entries.size,
    forfeitedOut,
    fieldSize: event.entries.size - forfeitedOut,
    elimField: elimEntries.size,
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
      p = { entryId, wins: 0, losses: 0, elimLevel: null, wonFinal: false, sameSchoolWalkovers: 0 };
      out.set(entryId, p);
    }
    return p;
  };
  for (const entryId of event.entries.keys()) get(entryId);

  const debated = new Map<string, number>();
  for (const r of event.rounds) {
    if (!r.isPrelim) continue;
    for (const s of r.sections) {
      for (const b of s.ballots) {
        if (!b.entryId || b.won === null) continue;
        const p = get(b.entryId);
        debated.set(b.entryId, (debated.get(b.entryId) ?? 0) + 1);
        if (b.won) p.wins++;
        else p.losses++;
      }
    }
  }

  // Where tab published win totals, trust them: a ballot whose result was
  // never entered otherwise silently shortens a team's record, which drops it
  // out of the XXI.3.A table entirely.
  const prelimCount = event.rounds.filter((r) => r.isPrelim).length;
  for (const [entryId, wins] of event.publishedPrelimWins) {
    const p = out.get(entryId);
    if (!p) continue;
    const rounds = Math.max(debated.get(entryId) ?? 0, prelimCount);
    p.wins = wins;
    p.losses = Math.max(0, rounds - wins);
  }

  const { main } = partitionElimRounds(event.rounds);
  // Deepest bracket first: fewer sections means a later round.
  const ordered = [...main].sort((a, b) => a.sections.length - b.sections.length);
  for (const r of ordered) {
    const level = elimLevelFromSectionCount(r.sections.length);
    if (!level) continue;
    for (const s of r.sections) {
      const schools = new Set(
        s.entryIds.map((e) => event.entries.get(e)?.schoolId).filter((x): x is string => !!x),
      );
      const walkover = s.entryIds.length === 2 && schools.size === 1 && s.unscored;
      for (const entryId of s.entryIds) {
        const p = get(entryId);
        if (walkover) p.sameSchoolWalkovers++;
        // Rounds are visited deepest-first, so the first assignment wins.
        if (p.elimLevel === null) {
          const won = s.ballots.some((b) => b.entryId === entryId && b.won === true);
          p.elimLevel = level === 'first' && !won ? 'second' : level;
          if (level === 'first' && won) p.wonFinal = true;
        }
      }
    }
  }
  // An unscored championship round is ambiguous: it is a closeout (XXI.5.B,
  // both teams champions) only when the finalists share a school. Otherwise
  // the result simply was not entered, and promoting the runner-up to champion
  // overstates them by a full level -- exactly 6 points in every band.
  //
  // For the not-entered case the round data cannot name a winner, so this is
  // the one place `Final Places` labels earn their keep: they are the only
  // remaining signal. Resolved by the caller via `finalPlacesWinner`.
  const championship = ordered[0];
  if (championship && championship.sections.length === 1) {
    const sec = championship.sections[0]!;
    if (sec.unscored && sec.entryIds.length > 1) {
      const schools = new Set(
        sec.entryIds.map((e) => event.entries.get(e)?.schoolId).filter((x): x is string => !!x),
      );
      const isCloseout = schools.size === 1;
      for (const entryId of sec.entryIds) {
        const p = out.get(entryId);
        if (!p) continue;
        if (isCloseout) { p.elimLevel = 'first'; p.wonFinal = true; }
        else if (p.elimLevel === 'first') { p.elimLevel = 'second'; p.wonFinal = false; }
      }
      if (!isCloseout) {
        const winner = event.finalPlacesWinner;
        const wp = winner ? out.get(winner) : undefined;
        if (wp && sec.entryIds.includes(winner!)) { wp.elimLevel = 'first'; wp.wonFinal = true; }
      }
    }
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
