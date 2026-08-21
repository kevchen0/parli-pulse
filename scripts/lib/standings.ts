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
  const oursBySchool = new Map<string, OurTeam[]>();
  for (const o of ours) {
    const k = schoolKey(o.school ?? '');
    const l = oursBySchool.get(k) ?? [];
    l.push(o);
    oursBySchool.set(k, l);
  }

  const out: Pairing[] = [];
  const bySchool = new Map<string, OfficialTeam[]>();
  for (const t of official) {
    const k = schoolKey(t.school);
    const l = bySchool.get(k) ?? [];
    l.push(t);
    bySchool.set(k, l);
  }

  for (const [k, teams] of bySchool) {
    const candidates: EntryCandidate[] = (oursBySchool.get(k) ?? []).map((o) => ({
      entryId: o.teamId,
      schoolName: o.school,
      people: [
        { first: o.first1 ?? '', last: o.last1 },
        { first: o.first2 ?? '', last: o.last2 },
      ],
    }));
    const byId = new Map((oursBySchool.get(k) ?? []).map((o) => [o.teamId, o]));
    const result = matchTeams(
      teams.map((t) => ({ partner1: t.partner1, partner2: t.partner2, school: t.school })),
      candidates,
    );
    teams.forEach((t, i) => {
      const m = result.matches.get(i);
      const mine = m && !m.ambiguous ? byId.get(m.entryId) ?? null : null;
      out.push({ official: t, ours: mine, delta: mine ? mine.points - t.points : null });
    });
  }
  return out;
}
