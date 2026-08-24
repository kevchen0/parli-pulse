/**
 * Ties the league's published team rows to our computed standings.
 *
 * Uses the same matcher the ingestion path uses, deliberately: keying on
 * surnames alone collapses "Egleson & S. Goyal" into "Egleson & N. Goyal",
 * which are two real Menlo partnerships eighty points apart. Comparison
 * tooling that gets this wrong reports data problems that do not exist.
 */
import { sql } from 'drizzle-orm';
import type { createDb } from '../../packages/db/src/client.ts';
import { matchTeams, type EntryCandidate } from '../../packages/ingest/src/matching.ts';
import { schoolKey } from '../../packages/ingest/src/schools.ts';

export interface OfficialTeam {
  rank: number;
  points: number;
  school: string;
  partner1: string;
  partner2: string;
  label: string;
}

export interface OurTeam {
  teamId: string;
  school: string | null;
  first1: string; last1: string;
  first2: string; last2: string;
  points: number;
}

export async function loadOurTeams(
  db: ReturnType<typeof createDb>['db'],
  season: string,
): Promise<OurTeam[]> {
  const rows = await db.execute(sql`
    select ts.id as "teamId", coalesce(s.short_name, s.name) as school,
           a.first_name as "first1", a.last_name as "last1",
           b.first_name as "first2", b.last_name as "last2",
           ts.points
    from team_season_totals ts
    join debaters a on a.id = ts.debater1_id
    join debaters b on b.id = ts.debater2_id
    left join schools s on s.id = ts.school_id
    where ts.season_id = ${season}
  `);
  return (rows.rows as unknown as OurTeam[]).filter((r) => r.last1 && r.last2);
}

export interface Pairing {
  official: OfficialTeam;
  ours: OurTeam | null;
  delta: number | null;
}

/**
 * Matches within a school, so a surname pair only ever competes against other
 * partnerships from the same program.
 */
export function pairStandings(official: OfficialTeam[], ours: OurTeam[]): Pairing[] {
  // A hybrid is written "Princeton/Stuyvesant", and our team sits under
  // whichever of the two the league credits. Key on both halves so the match
  // does not depend on guessing which one that is.
  const halves = (school: string): string[] => {
    const parts = school.split('/').map((p) => schoolKey(p)).filter(Boolean);
    return parts.length ? [...new Set(parts)] : [schoolKey(school)];
  };

  const oursBySchool = new Map<string, OurTeam[]>();
  for (const o of ours) {
    for (const k of halves(o.school ?? '')) {
      const l = oursBySchool.get(k) ?? [];
      l.push(o);
      oursBySchool.set(k, l);
    }
  }

  const out: Pairing[] = [];
  const bySchool = new Map<string, OfficialTeam[]>();
  for (const t of official) {
    // Group under the first half; the candidate pool below unions both.
    const k = halves(t.school)[0]!;
    const l = bySchool.get(k) ?? [];
    l.push(t);
    bySchool.set(k, l);
  }

  const claimed = new Set<string>();
  for (const [k, teams] of bySchool) {
    const pool = new Map<string, OurTeam>();
    for (const t of teams) {
      for (const h of halves(t.school)) {
        for (const o of oursBySchool.get(h) ?? []) pool.set(o.teamId, o);
      }
    }
    for (const o of oursBySchool.get(k) ?? []) pool.set(o.teamId, o);
    const available = [...pool.values()].filter((o) => !claimed.has(o.teamId));
    const candidates: EntryCandidate[] = available.map((o) => ({
      entryId: o.teamId,
      schoolName: o.school,
      people: [
        { first: o.first1 ?? '', last: o.last1 },
        { first: o.first2 ?? '', last: o.last2 },
      ],
    }));
    const byId = new Map(available.map((o) => [o.teamId, o]));
    const result = matchTeams(
      teams.map((t) => ({ partner1: t.partner1, partner2: t.partner2, school: t.school })),
      candidates,
    );
    teams.forEach((t, i) => {
      const m = result.matches.get(i);
      // An ambiguous match usually means our own duplicate rows, not two real
      // teams; take the best-scoring candidate rather than discarding it, since
      // a wrong attribution here only affects the comparison, not the site.
      const mine = m ? byId.get(m.entryId) ?? null : null;
      if (mine) claimed.add(mine.teamId);
      out.push({ official: t, ours: mine, delta: mine ? mine.points - t.points : null });
    });
  }
  return out;
}
