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
 * Tabroom student ids are stable within a chapter but not across them: a
 * debater who also enters under an independent or club registration gets a
 * second id, which otherwise splits one person's season in two. Stuyvesant's
 * top team competed as both "Stuyvesant" and "Rodda's Disciples".
 *
 * Same name is not sufficient on its own -- there really are two Jessica Lius.
 * The discriminator is partners: if two same-named ids appear at the same
 * tournament with *different* partners they are different people, whereas the
 * same partner twice is one person entered twice. Groups with any conflicting
 * evidence are left unmerged.
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
    .from(t.debaters);

  const key = (f: string | null, l: string | null): string | null =>
    f && l ? `${f.trim().toLowerCase()} ${l.trim().toLowerCase()}` : null;

  const groups = new Map<string, typeof people>();
  for (const p of people) {
    const k = key(p.first, p.last);
    if (!k) continue;
    const g = groups.get(k) ?? [];
    g.push(p);
    groups.set(k, g);
  }

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
  const all = await db
    .select({ entryId: t.entryDebaters.entryId, debaterId: t.entryDebaters.debaterId })
    .from(t.entryDebaters);
  for (const a of all) {
    const l = partnersByEntry.get(a.entryId) ?? [];
    l.push(a.debaterId);
    partnersByEntry.set(a.entryId, l);
  }
  const nameOf = new Map(people.map((p) => [p.id, key(p.first, p.last) ?? p.id]));

  // debaterId -> tournament -> set of partner name-keys
  const seen = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const partners = (partnersByEntry.get(r.entryId) ?? [])
      .filter((d) => d !== r.debaterId)
      .map((d) => nameOf.get(d) ?? d)
      .sort()
      .join('+');
    const byT = seen.get(r.debaterId) ?? new Map<string, Set<string>>();
    const set = byT.get(r.tournamentId) ?? new Set<string>();
    set.add(partners);
    byT.set(r.tournamentId, set);
    seen.set(r.debaterId, byT);
  }

  let merged = 0;
  const updates: { id: string; canonicalId: string }[] = [];
  for (const [, group] of groups) {
    if (group.length < 2) continue;

    let conflict = false;
    for (let i = 0; i < group.length && !conflict; i++) {
      for (let j = i + 1; j < group.length && !conflict; j++) {
        const a = seen.get(group[i]!.id);
        const b = seen.get(group[j]!.id);
        if (!a || !b) continue;
        for (const [tourn, pa] of a) {
          const pb = b.get(tourn);
          if (!pb) continue;
          // Same tournament: different partners means two different people.
          const union = new Set([...pa, ...pb]);
          if (union.size > 1) { conflict = true; break; }
        }
      }
    }
    if (conflict) continue;

    // Prefer an identity attached to a member school, then the busiest one.
    const ranked = [...group].sort((a, b) => {
      const am = memberSchools.has(a.schoolId ?? '') ? 1 : 0;
      const bm = memberSchools.has(b.schoolId ?? '') ? 1 : 0;
      if (am !== bm) return bm - am;
      return (seen.get(b.id)?.size ?? 0) - (seen.get(a.id)?.size ?? 0);
    });
    const canonical = ranked[0]!;
    for (const p of group) {
      if (p.id === canonical.id) continue;
      updates.push({ id: p.id, canonicalId: canonical.id });
      merged++;
    }
  }

  for (const u of updates) {
    await db.update(t.debaters).set({ canonicalId: u.canonicalId }).where(eq(t.debaters.id, u.id));
  }
  return merged;
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
    const teamPoints = new Map<string, { points: number[]; schoolId: string | null; ids: string[] }>();
    const debaterPoints = new Map<string, number[]>();
    const schoolPoints = new Map<string, number>();

    for (const r of results) {
      const ds = [...new Set(debatersByEntry.get(r.entryId) ?? [])].sort();
      if (ds.length === 2) {
        const key = ds.join('|');
        const e = teamPoints.get(key) ?? { points: [], schoolId: r.schoolId, ids: ds };
        e.points.push(r.points);
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

    const teamRows = assignRanks(
      [...teamPoints.entries()].map(([key, v]) => ({
        key, points: weightedTotal(v.points), counted: Math.min(v.points.length, 5),
        schoolId: v.schoolId, ids: v.ids,
      })),
    ).map((r) => ({
      id: `team_${SEASON}_${r.key}`, seasonId: SEASON, schoolId: r.schoolId,
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
