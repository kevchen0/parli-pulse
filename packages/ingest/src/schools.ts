/**
 * Canonical school identity.
 *
 * The league's `SchoolList` tab is the authority: it maps a full name to a
 * short name and a region. Tabroom writes school names freely, so the same
 * program appears as "Mountain View", "Mountain View/Mountain View", and
 * "Mountain View High School". Everything is resolved through here so that a
 * school's points are not split across three near-identical rows.
 */
import { SCHOOL_ALIASES } from './school-aliases.ts';
import { indexHeaders, type SheetRow } from './sheet.ts';

export interface CanonicalSchool {
  id: string;
  name: string;
  shortName: string | null;
  region: string | null;
  isMember: boolean;
}

const NOISE = /\b(high school|high|school|academy|hs|the)\b/g;

/** Loose comparison key: lowercase letters only, common suffixes dropped. */
export function schoolKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // "Mountain View/Mountain View" is one school written twice.
    .split('/')[0]!
    .replace(NOISE, ' ')
    .replace(/[^a-z0-9]/g, '');
}

export const schoolId = (name: string): string => `sch_${schoolKey(name) || 'unknown'}`;

export interface SchoolIndex {
  /** Canonical schools, keyed by id. */
  byId: Map<string, CanonicalSchool>;
  /** Resolves any free-text school name to a canonical school. */
  resolve: (raw: string | null | undefined) => CanonicalSchool | null;
}

/**
 * Builds the index from the `SchoolList` tab, which names every school seen in
 * the season -- 379 of them -- and from the `School` tab, which is the league's
 * own ranking and therefore the list of the 56 schools it treats as members.
 *
 * The distinction matters: XXI.9.A restricts school rankings to member schools,
 * so appearing in `SchoolList` is not membership. Pass `memberNames` to mark
 * them; without it nothing is a member, which is the safe default.
 */
export function buildSchoolIndex(rows: SheetRow[], memberNames: readonly string[] = []): SchoolIndex {
  const { headerIndex, col } = indexHeaders(rows);
  const c = { name: col('Name'), short: col('Short Name'), region: col('Region') };

  const byId = new Map<string, CanonicalSchool>();
  const lookup = new Map<string, CanonicalSchool>();
  const members = new Set(memberNames.map((n) => schoolKey(n)));

  const register = (school: CanonicalSchool, ...aliases: string[]): void => {
    byId.set(school.id, school);
    for (const a of [school.name, ...aliases]) {
      const k = schoolKey(a);
      if (k && !lookup.has(k)) lookup.set(k, school);
    }
  };

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i]!;
    const name = (r[c.name] ?? '').trim();
    if (!name) continue;
    const shortName = (r[c.short] ?? '').trim() || null;
    const school: CanonicalSchool = {
      id: schoolId(name),
      name,
      shortName,
      region: (r[c.region] ?? '').trim() || null,
      isMember: members.has(schoolKey(name)) || (shortName ? members.has(schoolKey(shortName)) : false),
    };
    register(school, ...(shortName ? [shortName] : []));
  }

  // Alternate registrations resolve to the school the league credits. Applied
  // after the roster so a club never shadows a real school of the same name.
  for (const [alias, canonicalName] of Object.entries(SCHOOL_ALIASES)) {
    const target = lookup.get(schoolKey(canonicalName));
    if (!target) continue;
    const k = schoolKey(alias);
    if (k) lookup.set(k, target);
  }

  return {
    byId,
    resolve(raw) {
      if (!raw) return null;
      const key = schoolKey(raw);
      if (!key) return null;
      const hit = lookup.get(key);
      if (hit) return hit;
      // Unknown school: record it so results are not silently dropped, but do
      // not claim membership.
      const created: CanonicalSchool = {
        id: schoolId(raw),
        name: raw.split('/')[0]!.trim(),
        shortName: null,
        region: null,
        isMember: false,
      };
      register(created);
      return created;
    },
  };
}
