/**
 * Computes season standings from loaded results: team (XXI.7), individual
 * (XXI.8), and school (XXI.9) totals, plus TOC qualification (XXII.1.A).
 *
 * Kept separate from the loader so standings can be recomputed after a rules
 * change without re-reading 370MB of payloads.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { weightedTotal } from '../packages/rules/src/index.ts';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import { collapsePartnerships, dominantSchool, loadNameIndex } from './lib/identity.ts';

const SEASON = process.env.SEASON ?? '2025-26';

/** Rank by descending points; XXI.7.B makes ties share the better rank. */
function assignRanks<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  return sorted.map((r, i) => ({
    ...r,
    rank: sorted.findIndex((o) => o.points === r.points) + 1 || i + 1,
  }));
}

/**
 * Merges duplicate debater records.
 *
 * A person can hold several Tabroom student ids -- ids are stable within a
 * chapter, not across them, so entering under a club or independent
 * registration creates another. Records recovered from entry labels add more,
 * usually with no first name at all. Left alone, one partnership becomes three
 * separate team rows: Diamond Bar's Liu & Zhu appeared at 37.5, 17.3 and 9.0.
 *
 * Records are grouped by school and surname, then split apart again by two
 * signals that prove distinctness:
 *
 *  - **Different first names.** Two records at one school both naming a first
 *    name that differs are different people, so each keeps its own group and
 *    any first-name-less record between them is left alone rather than guessed.
 *  - **Different partners at one tournament.** There really are two Jessica
 *    Lius; they debated the same weekend with different partners. The same
 *    partner twice is instead one person entered twice.
 */
async function resolveIdentities(
  db: ReturnType<typeof createDb>['db'],
  memberSchools: Set<string>,
): Promise<number> {
  const people = await db
    .select({
      id: t.debaters.id, first: t.debaters.firstName, last: t.debaters.lastName,
      schoolId: t.debaters.schoolId,
    })
    .from(t.debaters)
    // Deterministic input, so grouping and merging do not depend on row order.
    .orderBy(t.debaters.id);

  const letters = (s: string | null): string =>
    (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

  // A label-recovered two-word surname may arrive split into first and last
  // ("Cassel" + "Engen") or run together ("casselengen"), so the surname key
  // includes both spellings.
  const surnameKeys = (p: (typeof people)[number]): string[] => {
    const last = letters(p.last);
    if (!last) return [];
    const joined = letters(p.first) + last;
    return joined !== last ? [last, joined] : [last];
  };

  const rows = await db
    .select({
      debaterId: t.entryDebaters.debaterId,
      tournamentId: t.events.tournamentId,
      entryId: t.entries.id,
    })
    .from(t.entryDebaters)
    .innerJoin(t.entries, eq(t.entries.id, t.entryDebaters.entryId))
    .innerJoin(t.events, eq(t.events.id, t.entries.eventId));

  const partnersByEntry = new Map<string, string[]>();
  for (const a of await db
    .select({ entryId: t.entryDebaters.entryId, debaterId: t.entryDebaters.debaterId })
    .from(t.entryDebaters)) {
    const l = partnersByEntry.get(a.entryId) ?? [];
    l.push(a.debaterId);
    partnersByEntry.set(a.entryId, l);
  }
  const surnameOf = new Map(people.map((p) => [p.id, letters(p.last) || p.id]));

  // debaterId -> tournament -> partner surnames seen there
  const seen = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const partners = (partnersByEntry.get(r.entryId) ?? [])
      .filter((d) => d !== r.debaterId)
      .map((d) => surnameOf.get(d) ?? d)
      .sort()
      .join('+');
    const byT = seen.get(r.debaterId) ?? new Map<string, Set<string>>();
    const set = byT.get(r.tournamentId) ?? new Set<string>();
    set.add(partners);
    byT.set(r.tournamentId, set);
    seen.set(r.debaterId, byT);
  }
  const appearances = (id: string): number => seen.get(id)?.size ?? 0;

  // Two different keys catch two different duplications, so both are used and
  // the results unioned:
  //  - full name, across schools, for a debater who also enters under a club
  //    or independent registration;
  //  - school plus surname, for label-recovered records that carry no first
  //    name and so cannot be grouped by full name at all.
  const groups = new Map<string, typeof people>();
  const push = (key: string, p: (typeof people)[number]): void => {
    const g = groups.get(key) ?? [];
    if (!g.some((x) => x.id === p.id)) g.push(p);
    groups.set(key, g);
  };
  for (const p of people) {
    const first = letters(p.first);
    const last = letters(p.last);
    if (first && last) push(`name|${first}${last}`, p);
    if (p.schoolId) for (const k of surnameKeys(p)) push(`school|${p.schoolId}|${k}`, p);
  }

  const conflicts = (a: (typeof people)[number], b: (typeof people)[number]): boolean => {
    // Two records naming different first names are different people -- unless
    // one is an abbreviation of the other. Tabroom carries "M" where the
    // league writes "Melina", and treating those as two people splits a
    // partnership in half.
    const fa = letters(a.first);
    const fb = letters(b.first);
    if (fa && fb && fa !== fb && !fa.startsWith(fb) && !fb.startsWith(fa)) return true;
    const sa = seen.get(a.id);
    const sb = seen.get(b.id);
    if (!sa || !sb) return false;
    for (const [tournament, pa] of sa) {
      const pb = sb.get(tournament);
      // Same tournament, different partners: two people, not one entered twice.
      if (pb && new Set([...pa, ...pb]).size > 1) return true;
    }
    return false;
  };

  // Union-find over the compatible pairs, so a record linked by either key ends
  // up in one component.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const p of people) parent.set(p.id, p.id);

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (find(a.id) === find(b.id)) continue;
        if (conflicts(a, b)) continue;
        union(a.id, b.id);
      }
    }
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const components = new Map<string, string[]>();
  for (const p of people) {
    const root = find(p.id);
    (components.get(root) ?? components.set(root, []).get(root)!).push(p.id);
  }

  const merged = new Map<string, string>();
  for (const [, ids] of components) {
    if (ids.length < 2) continue;
    const ranked = ids.map((id) => byId.get(id)!).sort((a, b) => {
      const am = memberSchools.has(a.schoolId ?? '') ? 1 : 0;
      const bm = memberSchools.has(b.schoolId ?? '') ? 1 : 0;
      if (am !== bm) return bm - am;
      // Prefer a real student record over one recovered from a label.
      const al = a.id.startsWith('lbl_') ? 0 : 1;
      const bl = b.id.startsWith('lbl_') ? 0 : 1;
      if (al !== bl) return bl - al;
      const ap = appearances(b.id) - appearances(a.id);
      if (ap !== 0) return ap;
      // A final, total tiebreak. Without one, two records tying on every test
      // above are ordered by however Postgres returned them, so the canonical
      // id flips between runs -- and with it every downstream row id keyed on a
      // partnership: team totals, speaker totals, ratings. Seven debaters
      // changed identity on a run that loaded no new data at all.
      return a.id.localeCompare(b.id);
    });
    const canonical = ranked[0]!;
    for (const id of ids) if (id !== canonical.id) merged.set(id, canonical.id);
  }

  // Collapse chains so every record points at a final canonical id.
  const resolve = (id: string, depth = 0): string => {
    const next = merged.get(id);
    return next && depth < 10 ? resolve(next, depth + 1) : id;
  };
  for (const [id] of merged) merged.set(id, resolve(id));

  for (const [id, canonicalId] of merged) {
    if (id === canonicalId) continue;
    await db.update(t.debaters).set({ canonicalId }).where(eq(t.debaters.id, id));
  }
  return merged.size;
}

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    console.log(`rolling up ${SEASON}\n`);
    await db.update(t.debaters).set({ canonicalId: null });
    const memberSchools = new Set(
      (await db.select({ id: t.schools.id, isMember: t.schools.isMember }).from(t.schools))
        .filter((s) => s.isMember).map((s) => s.id),
    );
    const merged = await resolveIdentities(db, memberSchools);
    console.log(`  merged duplicate debater records: ${merged}`);

    // Only scored, eligible entries count. XXI.1.G exclusions are stored with
    // their points intact, so they must be filtered here rather than assumed
    // to be zero.
    const results = await db
      .select({
        entryId: t.entries.id,
        points: t.entryResults.points,
        schoolId: t.entries.schoolId,
        hybridSchoolId: t.entries.hybridSchoolId,
        tournamentId: t.events.tournamentId,
      })
      .from(t.entryResults)
      .innerJoin(t.entries, eq(t.entries.id, t.entryResults.entryId))
      .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
      .innerJoin(t.tournaments, eq(t.tournaments.id, t.events.tournamentId))
      .where(and(eq(t.tournaments.seasonId, SEASON), isNull(t.entryResults.excludedReason)));

    const members = await db.select({ id: t.schools.id, isMember: t.schools.isMember }).from(t.schools);
    const memberIds = new Set(members.filter((m) => m.isMember).map((m) => m.id));

    const canon = new Map(
      (await db.select({ id: t.debaters.id, canonicalId: t.debaters.canonicalId }).from(t.debaters))
        .map((d) => [d.id, d.canonicalId ?? d.id]),
    );
    const pairs = await db
      .select({ entryId: t.entryDebaters.entryId, debaterId: t.entryDebaters.debaterId })
      .from(t.entryDebaters);
    const debatersByEntry = new Map<string, string[]>();
    for (const p of pairs) {
      const list = debatersByEntry.get(p.entryId) ?? [];
      // Group by canonical identity so a debater's school and independent
      // registrations count as one person.
      list.push(canon.get(p.debaterId) ?? p.debaterId);
      debatersByEntry.set(p.entryId, list);
    }

    // --- Teams (XXI.7): a partnership is a pair of debaters, not an entry. ---
    const teamPoints = new Map<string, { points: number[]; schools: (string | null)[]; ids: string[] }>();
    const debaterPoints = new Map<string, number[]>();
    const schoolPoints = new Map<string, number>();

    for (const r of results) {
      const ds = [...new Set(debatersByEntry.get(r.entryId) ?? [])].sort();
      if (ds.length === 2) {
        const key = ds.join('|');
        const e = teamPoints.get(key) ?? { points: [], schools: [], ids: ds };
        e.points.push(r.points);
        // A partnership can compete under more than one registration; the
        // league credits the school it belongs to, so take the one it entered
        // under most rather than whichever result happened to load first.
        e.schools.push(r.schoolId);
        teamPoints.set(key, e);
      }
      // XXI.8: a debater's own results, pooled across every partner.
      for (const d of ds) {
        const list = debaterPoints.get(d) ?? [];
        list.push(r.points);
        debaterPoints.set(d, list);
      }
      // XXI.9.C: hybrids count half to each school; XXI.9.A limits the table
      // to member schools.
      const schools = r.hybridSchoolId ? [r.schoolId, r.hybridSchoolId] : [r.schoolId];
      const share = r.hybridSchoolId ? 0.5 : 1;
      for (const s of schools) {
        if (!s || !memberIds.has(s)) continue;
        schoolPoints.set(s, (schoolPoints.get(s) ?? 0) + r.points * share);
      }
    }

    await db.delete(t.teamSeasonTotals).where(eq(t.teamSeasonTotals.seasonId, SEASON));
    await db.delete(t.debaterSeasonTotals).where(eq(t.debaterSeasonTotals.seasonId, SEASON));
    await db.delete(t.schoolSeasonTotals).where(eq(t.schoolSeasonTotals.seasonId, SEASON));

    // One partnership can still hold two rows when a label-recovered record
    // could not be tied to its student record. Same school and same surnames,
    // with no contradicting first name, is the same team. The rule lives in
    // scripts/lib/identity.ts because the rating has to reach the same answer:
    // a partnership the standings treat as one and the rating treats as two
    // gets a season's evidence split between two ratings too thin to publish.
    const nameOf = await loadNameIndex(db);
    const schoolFor = (pair: string): string | null =>
      dominantSchool(teamPoints.get(pair)?.schools ?? [], memberSchools);
    const collapsed = collapsePartnerships(
      [...teamPoints.keys()].map((pair) => ({ pair, schoolId: schoolFor(pair) ?? '' })),
      nameOf,
    );

    const teamRows = assignRanks(
      collapsed.map((c) => {
        const points = c.pairs.flatMap((pair) => teamPoints.get(pair)!.points);
        const schools = c.pairs.flatMap((pair) => teamPoints.get(pair)!.schools);
        return {
          key: c.key, points: weightedTotal(points), counted: Math.min(points.length, 5),
          schoolId: dominantSchool(schools, memberSchools), ids: c.ids,
        };
      }),
    ).map((r) => ({
      id: `team_${SEASON}_${r.ids.join('|')}`, seasonId: SEASON, schoolId: r.schoolId,
      debater1Id: r.ids[0]!, debater2Id: r.ids[1]!,
      points: r.points, rank: r.rank, tournamentsCounted: r.counted,
    }));

    const debaterRows = assignRanks(
      [...debaterPoints.entries()].map(([id, pts]) => ({ id, points: weightedTotal(pts) })),
    ).map((r) => ({
      id: `deb_${SEASON}_${r.id}`, seasonId: SEASON, debaterId: r.id,
      points: r.points, rank: r.rank,
      tocQualPoints: r.points, tocQualRank: r.rank,
      // XXII.1.A: 40 individual points on March 1.
      autoQualified: r.points >= 40,
    }));

    const schoolRows = assignRanks(
      [...schoolPoints.entries()].map(([id, points]) => ({ id, points })),
    ).map((r) => ({
      id: `sch_${SEASON}_${r.id}`, seasonId: SEASON, schoolId: r.id,
      points: r.points, rank: r.rank,
    }));

    const insert = async (table: never, rows: unknown[], label: string): Promise<void> => {
      if (!rows.length) return;
      for (let i = 0; i < rows.length; i += 500) {
        await db.insert(table).values(rows.slice(i, i + 500) as never).onConflictDoNothing();
      }
      console.log(`  ${label.padEnd(20)} ${rows.length}`);
    };
    await insert(t.teamSeasonTotals as never, teamRows, 'teams');
    await insert(t.debaterSeasonTotals as never, debaterRows, 'debaters');
    await insert(t.schoolSeasonTotals as never, schoolRows, 'schools');

    const qualified = debaterRows.filter((d) => d.autoQualified).length;
    console.log(`\nTOC autoqualified (>= 40 individual points): ${qualified}`);
    console.log('done');
  } finally {
    await close();
  }
}

await main();
