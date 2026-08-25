/**
 * Turns loaded ballots into the rounds a rating can be run on.
 *
 * The one rule that matters here is the one plan/10-mistakes.md opens with: a
 * panel is not a round. Tabroom stores one ballot per judge, so a three-judge
 * round appears as three ballots on each side, and counting them as rounds
 * inflates everything. A round is won on a **majority** of its decided ballots,
 * never on `some`. That bug has been introduced twice in this codebase, the
 * second time in tooling written after the first fix, which is why the majority
 * is computed once, here, and nowhere else.
 *
 * Four kinds of section are left out, each counted so the loss is visible
 * rather than silent:
 *
 *  - **Byes.** One team in the section; nobody was beaten.
 *  - **Nothing entered.** No ballot in the section carries a result. There was
 *    a winner and the data does not say who; inferring one is pattern F.
 *  - **Ties.** An even panel split down the middle, which in practice is a
 *    three-judge panel with a ballot missing. Same reasoning.
 *  - **Half-known teams.** An entry recovered from a ballot label can carry one
 *    debater record or none, and a partnership we only know half of cannot be
 *    named. This costs the round for its opponent too, which is unfortunate and
 *    still better than attributing it to the wrong pair.
 *
 * Open divisions only, matching Article XXI.1.A and the speaker points: novice
 * and JV are a different competition, and a rating that mixed them would place
 * teams above opponents they could never meet.
 */
import { sql } from 'drizzle-orm';
import type { createDb } from '../../packages/db/src/client.ts';
import * as t from '../../packages/db/src/schema.ts';
import type { RatedRound, RatingPeriod } from '../../packages/rating/src/index.ts';
import {
  collapsePartnerships,
  dominantSchool,
  loadDebatersByEntry,
  loadNameIndex,
  loadStandingKeys,
  partnershipIndex,
  partnershipKey,
} from './identity.ts';

type Db = ReturnType<typeof createDb>['db'];

interface BallotRow {
  sectionId: string;
  entryId: string;
  schoolId: string | null;
  tournamentId: string;
  tournamentName: string;
  date: string | null;
  kind: 'prelim' | 'elim';
  side: number | null;
  decided: number;
  won: number;
  isBye: boolean;
}

export interface RatingData {
  periods: RatingPeriod[];
  rounds: RatedRound[];
  /** Partnership key -> the two canonical debater ids in it. */
  members: Map<string, readonly string[]>;
  /** Partnership key -> tournaments it competed at, in order. */
  tournamentsFor: Map<string, string[]>;
  tournamentNames: Map<string, string>;
  tournamentDates: Map<string, string>;
  skipped: {
    byes: number;
    undecided: number;
    tied: number;
    unknownTeam: number;
    oddSection: number;
    selfMatch: number;
  };
}

/**
 * A tournament with no date sorts as though it happened at the season's end.
 *
 * Two of the 2025-26 tournaments have neither a start nor an end date. Putting
 * them last means their results inform nothing that came before, which is the
 * conservative choice: guessing a date would silently reorder the season.
 */
const NO_DATE = '9999-12-31';

/**
 * Entry id -> the partnership it belongs to, under the same rule the standings
 * use.
 *
 * Keying on the canonical debater pair alone is not enough. `rollup` collapses
 * pairs a second time, on school and surnames, because a label-recovered record
 * that carries no first name never merges into its student record and leaves one
 * partnership holding two pairs. Rating the raw pairs left 59 of the league's
 * 799 partnerships with no rating at all and split others' seasons in half --
 * which on data this sparse is the difference between a rating and a rumour.
 *
 * Where a group contains the pair the standings already use, that pair names it,
 * so a rating row joins to a standing row without either side guessing.
 */
async function buildResolver(
  db: Db,
  season: string,
  rows: readonly BallotRow[],
  debatersByEntry: ReadonlyMap<string, string[]>,
): Promise<(entryId: string) => string | null> {
  const members = await db
    .select({ id: t.schools.id, isMember: t.schools.isMember })
    .from(t.schools);
  const memberSchools = new Set(members.filter((m) => m.isMember).map((m) => m.id));

  // Schools a pair entered under, so the collapse sees the one it competes for
  // rather than whichever registration happened to be read first.
  const schoolsByPair = new Map<string, (string | null)[]>();
  const pairOfEntry = new Map<string, string>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.entryId)) continue;
    seen.add(row.entryId);
    const pair = partnershipKey(debatersByEntry.get(row.entryId) ?? []);
    if (!pair) continue;
    pairOfEntry.set(row.entryId, pair);
    (schoolsByPair.get(pair) ?? schoolsByPair.set(pair, []).get(pair)!).push(row.schoolId);
  }

  const nameOf = await loadNameIndex(db);
  const collapsed = collapsePartnerships(
    [...schoolsByPair].map(([pair, schools]) => ({
      pair,
      schoolId: dominantSchool(schools, memberSchools) ?? '',
    })),
    nameOf,
  );
  const index = partnershipIndex(collapsed, await loadStandingKeys(db, season));
  return (entryId) => {
    const pair = pairOfEntry.get(entryId);
    return pair ? index.get(pair) ?? pair : null;
  };
}

export async function loadRatingData(db: Db, season: string): Promise<RatingData> {
  const rows = (
    await db.execute(sql`
      select b.section_id as "sectionId", b.entry_id as "entryId",
             en.school_id as "schoolId",
             e.tournament_id as "tournamentId",
             coalesce(t.official_name, t.name) as "tournamentName",
             coalesce(t.starts_on, t.ends_on) as date,
             r.kind::text as kind, min(b.side) as side,
             bool_or(b.is_bye) as "isBye",
             count(*) filter (where b.won is not null)::int as decided,
             count(*) filter (where b.won)::int as won
      from ballots b
      join rounds r on r.id = b.round_id
      join events e on e.id = r.event_id
      join tournaments t on t.id = e.tournament_id
      join entries en on en.id = b.entry_id
      where t.season_id = ${season}
        and e.division = 'open'
        and b.entry_id is not null
      group by 1, 2, 3, 4, 5, 6, 7
    `)
  ).rows as unknown as BallotRow[];

  const debatersByEntry = await loadDebatersByEntry(db);
  const resolve = await buildResolver(db, season, rows, debatersByEntry);

  const bySection = new Map<string, BallotRow[]>();
  for (const r of rows) {
    (bySection.get(r.sectionId) ?? bySection.set(r.sectionId, []).get(r.sectionId)!).push(r);
  }

  const skipped = { byes: 0, undecided: 0, tied: 0, unknownTeam: 0, oddSection: 0, selfMatch: 0 };
  const rounds: RatedRound[] = [];
  const members = new Map<string, readonly string[]>();
  const tournamentNames = new Map<string, string>();
  const tournamentDates = new Map<string, string>();
  const tournamentsFor = new Map<string, string[]>();

  for (const [sectionId, sides] of bySection) {
    if (sides.some((s) => s.isBye)) { skipped.byes += 1; continue; }
    if (sides.length !== 2) { skipped.oddSection += 1; continue; }
    const [a, b] = sides as [BallotRow, BallotRow];

    // Tabroom writes one ballot per judge *per entry*, so a three-judge round
    // holds six rows and the panel size is the count on one side, not the sum.
    // Getting this wrong reads every single-judge round as a 1-1 tie.
    const panel = Math.max(a.decided, b.decided);
    if (panel === 0) { skipped.undecided += 1; continue; }
    // The majority, over the decided ballots only. An even split is not a
    // result: in practice it is a three-judge panel with a ballot missing.
    if (a.won * 2 === panel) { skipped.tied += 1; continue; }

    const keyA = resolve(a.entryId);
    const keyB = resolve(b.entryId);
    if (!keyA || !keyB) { skipped.unknownTeam += 1; continue; }
    // Two registrations resolving to one pair, which happens when a partnership
    // enters twice. There is nothing to learn from a team beating itself.
    if (keyA === keyB) { skipped.selfMatch += 1; continue; }

    members.set(keyA, keyA.split('|'));
    members.set(keyB, keyB.split('|'));
    tournamentNames.set(a.tournamentId, a.tournamentName);
    tournamentDates.set(a.tournamentId, a.date ?? NO_DATE);
    for (const k of [keyA, keyB]) {
      const list = tournamentsFor.get(k) ?? [];
      if (!list.includes(a.tournamentId)) list.push(a.tournamentId);
      tournamentsFor.set(k, list);
    }

    rounds.push({
      id: sectionId,
      a: keyA,
      b: keyB,
      wonA: a.won,
      ballots: panel,
      // A section always carries both sides; `min(side)` per entry recovers
      // which one this entry debated.
      sideA: a.side ?? 0,
      kind: a.kind,
    });
  }

  // One rating period per tournament, in date order. Rounds inside a period are
  // all judged against the ratings held before it, so their order within the
  // tournament does not matter and is not relied on.
  const byTournament = new Map<string, RatedRound[]>();
  const tournamentOf = new Map<string, string>();
  for (const r of rows) tournamentOf.set(r.sectionId, r.tournamentId);
  for (const r of rounds) {
    const tid = tournamentOf.get(r.id)!;
    (byTournament.get(tid) ?? byTournament.set(tid, []).get(tid)!).push(r);
  }

  const periods = [...byTournament]
    .map(([id, rs]) => ({ id, date: tournamentDates.get(id) ?? NO_DATE, rounds: rs }))
    .sort((x, y) => (x.date === y.date ? x.id.localeCompare(y.id) : x.date.localeCompare(y.date)));

  return { periods, rounds, members, tournamentsFor, tournamentNames, tournamentDates, skipped };
}
