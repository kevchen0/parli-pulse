/**
 * How a partnership is named, in one place.
 *
 * A partnership is a pair of people, not a registration: the same two debaters
 * can enter under their school one weekend and a club the next, and Tabroom
 * gives them different ids each time. `debaters.canonical_id` records the
 * merging that rollup.ts works out; everything downstream has to follow it or a
 * season splits in half.
 *
 * Extracted because the standings and the rating both need it and a second copy
 * would drift -- see plan/10-mistakes.md, pattern G, where exactly that happened
 * to the season computation and a fix appeared to do nothing for twenty minutes.
 */
import { eq, inArray } from 'drizzle-orm';
import type { createDb } from '../../packages/db/src/client.ts';
import * as t from '../../packages/db/src/schema.ts';

type Db = ReturnType<typeof createDb>['db'];

/** Every debater id mapped to the record it has been merged into. */
export async function loadCanonicalMap(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: t.debaters.id, canonicalId: t.debaters.canonicalId })
    .from(t.debaters);
  return new Map(rows.map((d) => [d.id, d.canonicalId ?? d.id]));
}

/**
 * Entry id -> the canonical debaters in it, deduplicated and sorted.
 *
 * Sorted so the pair reads the same whichever debater was listed first, and
 * deduplicated because two merged records can both sit on one entry.
 */
export async function loadDebatersByEntry(db: Db): Promise<Map<string, string[]>> {
  const canon = await loadCanonicalMap(db);
  const rows = await db
    .select({ entryId: t.entryDebaters.entryId, debaterId: t.entryDebaters.debaterId })
    .from(t.entryDebaters);
  const raw = new Map<string, string[]>();
  for (const p of rows) {
    const list = raw.get(p.entryId) ?? [];
    list.push(canon.get(p.debaterId) ?? p.debaterId);
    raw.set(p.entryId, list);
  }
  return new Map([...raw].map(([id, ds]) => [id, [...new Set(ds)].sort()]));
}

/**
 * The key a pair of canonical debater ids is stored under, or null if the entry
 * is not a partnership.
 *
 * Entries recovered from ballot labels often carry one debater record or none,
 * and there is no honest way to name a partnership we only know half of. They
 * are counted and reported rather than guessed at.
 */
export function partnershipKey(debaterIds: readonly string[]): string | null {
  return debaterIds.length === 2 ? debaterIds.join('|') : null;
}

/** Splits a key back into its two debater ids. */
export function partnershipMembers(key: string): string[] {
  return key.split('|');
}

/**
 * Two partnerships that are one, seen twice.
 *
 * `debaters.canonical_id` merges a person's several Tabroom records, but it
 * cannot always: a record recovered from an entry label often carries no first
 * name, and one surname at one school is not proof of anything -- there really
 * are two Jessica Lius. At the level of a *pair* the evidence is stronger. Two
 * surnames matching at one school, with no first name contradicting either, is
 * the same partnership.
 *
 * This is the rule the season standings have always used; it lives here so the
 * rating uses the same one. Diamond Bar's Liu & Zhu existed three times before
 * it -- at 37.5, 17.3 and 9.0 -- and a rating keyed on the raw pairs would
 * repeat that, splitting one team's season into three ratings too thin to say
 * anything.
 */
export interface PairInput {
  /** Canonical pair key, from `partnershipKey`. */
  pair: string;
  /** The school the partnership is credited to, or '' if unknown. */
  schoolId: string;
}

export interface CollapsedPartnership {
  /** Grouping key. Not meaningful outside this collapse. */
  key: string;
  /** Every canonical pair that resolves to this partnership, in input order. */
  pairs: string[];
  /** The two debater ids to represent it, preferring records that are named. */
  ids: string[];
}

export type NameIndex = ReadonlyMap<string, { first: string | null; last: string | null }>;

/** Letters only, accents folded: how names are compared throughout. */
export const nameLetters = (v: string | null): string =>
  (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export function collapsePartnerships(
  inputs: Iterable<PairInput>,
  nameOf: NameIndex,
): CollapsedPartnership[] {
  const collapsed = new Map<string, CollapsedPartnership>();
  const firstNamesOf = (ids: readonly string[]): string =>
    ids.map((id) => nameLetters(nameOf.get(id)?.first ?? null)).sort().join('|');

  for (const { pair, schoolId } of inputs) {
    const ids = partnershipMembers(pair);
    const people = ids.map((id) => nameOf.get(id));
    const surnames = people.map((p) => nameLetters(p?.last ?? null)).sort().join('|');
    const firsts = firstNamesOf(ids);

    let key = `${schoolId}::${surnames}`;
    const existing = collapsed.get(key);
    if (existing) {
      const otherFirsts = firstNamesOf(existing.ids);
      // Both pairs naming first names, and naming different ones, means two
      // real partnerships rather than one recovered twice.
      const bothNamed = firsts.replace(/\|/g, '') && otherFirsts.replace(/\|/g, '');
      if (bothNamed && firsts !== otherFirsts) key = `${key}::${firsts}`;
    }

    const target = collapsed.get(key);
    if (target) {
      target.pairs.push(pair);
      // Prefer the identity that carries real names, so the partnership is not
      // labelled by whichever nameless record happened to arrive first.
      if (target.ids.some((id) => !nameOf.get(id)?.first) && people.every((p) => p?.first)) {
        target.ids = ids;
      }
    } else {
      collapsed.set(key, { key, pairs: [pair], ids });
    }
  }
  return [...collapsed.values()];
}

/**
 * Pair key -> the key of the partnership it belongs to, for lookup.
 *
 * `preferred` names the keys the season standings already use. When a group
 * contains one, it wins the group, so a rating can be joined to a standing row
 * without either side guessing. The collapse itself is order-sensitive -- the
 * first pair seen represents the group unless a fully-named one displaces it --
 * and the two callers cannot see the same pairs in the same order, so agreeing
 * on the answer matters more than agreeing on the traversal.
 */
export function partnershipIndex(
  collapsed: readonly CollapsedPartnership[],
  preferred: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of collapsed) {
    const key = c.pairs.find((p) => preferred.has(p)) ?? c.ids.join('|');
    for (const p of c.pairs) out.set(p, key);
  }
  return out;
}

/** The partnership keys the season standings are stored under. */
export async function loadStandingKeys(db: Db, season: string): Promise<Set<string>> {
  const rows = await db
    .select({ a: t.teamSeasonTotals.debater1Id, b: t.teamSeasonTotals.debater2Id })
    .from(t.teamSeasonTotals)
    .where(eq(t.teamSeasonTotals.seasonId, season));
  return new Set(
    rows
      .filter((r): r is { a: string; b: string } => Boolean(r.a && r.b))
      .map((r) => [r.a, r.b].sort().join('|')),
  );
}

/**
 * The school a partnership is credited to, when its registrations disagree.
 *
 * The one it entered under most often, with a member school breaking a tie:
 * XXI.9.A only tables member schools, so a partnership that entered once
 * independently and three times for its school belongs to the school.
 */
export function dominantSchool(
  schools: readonly (string | null)[],
  memberSchools: ReadonlySet<string>,
): string | null {
  const counts = new Map<string, number>();
  for (const s of schools) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best: string | null = null;
  let bestScore = -1;
  for (const [id, n] of counts) {
    const score = n * 2 + (memberSchools.has(id) ? 1 : 0);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

/** Loads the first and last names every collapse needs. */
export async function loadNameIndex(db: Db): Promise<NameIndex> {
  const rows = await db
    .select({ id: t.debaters.id, first: t.debaters.firstName, last: t.debaters.lastName })
    .from(t.debaters);
  return new Map(rows.map((d) => [d.id, { first: d.first, last: d.last }]));
}

/** Display names for a set of partnership keys, school included. */
export async function loadPartnershipNames(
  db: Db,
  keys: Iterable<string>,
): Promise<Map<string, { school: string | null; names: string[] }>> {
  const ids = [...new Set([...keys].flatMap(partnershipMembers))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: t.debaters.id,
      first: t.debaters.firstName,
      last: t.debaters.lastName,
      school: t.schools.shortName,
      schoolName: t.schools.name,
    })
    .from(t.debaters)
    .leftJoin(t.schools, eq(t.schools.id, t.debaters.schoolId))
    .where(inArray(t.debaters.id, ids));
  const byId = new Map(rows.map((r) => [r.id, { ...r, school: r.school ?? r.schoolName }]));
  const out = new Map<string, { school: string | null; names: string[] }>();
  for (const key of keys) {
    const people = partnershipMembers(key).map((id) => byId.get(id));
    out.set(key, {
      school: people.find((p) => p?.school)?.school ?? null,
      names: people.map((p, i) =>
        p ? [p.first, p.last].filter(Boolean).join(' ') || p.id : partnershipMembers(key)[i]!,
      ),
    });
  }
  return out;
}
