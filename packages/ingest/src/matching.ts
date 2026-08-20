/**
 * Matching league spreadsheet rows to Tabroom entries.
 *
 * The sheet identifies a team by school and two surnames, sometimes with a
 * disambiguating first initial ("C. Pennington", "Ma. Qiu"). Tabroom has full
 * names and stable student ids. Joining them is the single largest source of
 * missing data, and it is dangerous in a specific way: surnames repeat.
 * `He & Zhang` at CFL 3 is two different partnerships, and a matcher that
 * keys on surnames alone silently drops one of them.
 *
 * So matching is deliberately conservative:
 *  - candidates are scored in tiers, exact-and-disambiguated first;
 *  - assignment is one-to-one, best-scoring first, never reusing an entry;
 *  - a tie that cannot be broken is reported as ambiguous rather than guessed.
 */

/** A person as the sheet writes them: optional initial plus surname. */
export interface SheetName {
  /** Leading initial(s) without the dot, e.g. "c" or "ma". Null when absent. */
  initial: string | null;
  surname: string;
  raw: string;
}

const stripDiacritics = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Collapses a surname to comparable letters: "Babji-Ross" and "St. Martin". */
export const normalizeSurname = (s: string): string =>
  stripDiacritics(s).toLowerCase().replace(/[^a-z]/g, '');

/**
 * Splits "Ma. Qiu" into an initial and a surname. Initials may be more than one
 * letter, which is how the sheet separates siblings whose names share a first
 * letter. A bare surname yields a null initial.
 */
export function parseSheetName(raw: string): SheetName {
  const trimmed = raw.trim();
  const m = trimmed.match(/^([A-Za-z]{1,3})\.\s*(.+)$/);
  if (m) {
    return { initial: m[1]!.toLowerCase(), surname: normalizeSurname(m[2]!), raw: trimmed };
  }
  return { initial: null, surname: normalizeSurname(trimmed), raw: trimmed };
}

/**
 * Damerau-Levenshtein distance (optimal string alignment), abandoned once it
 * exceeds `max`.
 *
 * Adjacent transpositions count as one edit rather than two, because that is
 * what most misspelled names actually are -- "Stanislawski" recorded as
 * "Stansilawski". Plain Levenshtein scores that as 2 and would need a looser
 * bound, which admits genuinely different names.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let twoBack: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, twoBack[j - 2]! + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    twoBack = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * Recovers debater names from an entry's own label, for entries that exist
 * only in ballot data and therefore carry no student records. Several CHSSA
 * league tournaments and Ridge Debates are entirely in this state.
 *
 * `entry_name` is normally just the surnames ("Greenleaf & Singel"); `code`
 * prefixes the school and sometimes carries full names ("Mountain View Natalie
 * Chen & Neha Nalumasu"). First names are frequently absent, so they come back
 * empty and initial-based disambiguation simply cannot fire -- which leaves
 * genuine collisions ambiguous rather than wrongly resolved.
 */
export function peopleFromEntryLabel(
  name: string | null,
  code: string | null,
): { first: string; last: string }[] {
  const source = name && name.includes('&') ? name : code;
  if (!source || !source.includes('&')) return [];
  return source
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const words = part.split(/\s+/).filter(Boolean);
      const last = words[words.length - 1] ?? '';
      const first = words.length > 1 ? words[words.length - 2]! : '';
      return { first, last };
    })
    .filter((p) => p.last.length > 0);
}

/** A Tabroom entry reduced to what matching needs. */
export interface EntryCandidate {
  entryId: string;
  schoolName: string | null;
  /** One per debater on the entry; mavericks have a single element. */
  people: { first: string; last: string }[];
}

export interface SheetTeam {
  partner1: string;
  partner2: string;
  school: string;
}

export type MatchTier =
  | 'exact-initials'
  | 'exact-surnames'
  | 'partial-maverick'
  | 'fuzzy-surname';

export interface Match {
  entryId: string;
  tier: MatchTier;
  score: number;
  ambiguous: boolean;
}

const schoolTokens = (s: string): Set<string> =>
  new Set(stripDiacritics(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));

/** Loose school agreement: Tabroom writes "Mountain View/Mountain View". */
function schoolsAgree(a: string | null, b: string): boolean {
  if (!a) return false;
  const ta = schoolTokens(a);
  const tb = schoolTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const w of tb) if (ta.has(w)) return true;
  return false;
}

/** True when a sheet name is consistent with a Tabroom first name. */
function initialAgrees(name: SheetName, first: string): boolean {
  if (!name.initial) return true;
  return stripDiacritics(first).toLowerCase().startsWith(name.initial);
}

/**
 * Scores one sheet team against one Tabroom entry. Higher is better; null when
 * they cannot be the same team.
 *
 * Tiers, in order: both surnames exact with initials confirming; both surnames
 * exact; a maverick sheet row whose single surname is present; and finally a
 * near-miss on spelling, which is only allowed when the school agrees.
 */
export function scoreCandidate(
  team: SheetTeam,
  candidate: EntryCandidate,
): { tier: MatchTier; score: number } | null {
  const names = [parseSheetName(team.partner1), parseSheetName(team.partner2)]
    .filter((n) => n.surname.length > 0);
  const people = candidate.people;
  if (names.length === 0 || people.length === 0) return null;

  const sameSchool = schoolsAgree(candidate.schoolName, team.school);

  // Try every assignment of sheet names to entry people; teams are at most two
  // people, so this is a pair of orderings rather than a real search.
  const orders = people.length === 2 ? [[0, 1], [1, 0]] : [[0]];
  let best: { tier: MatchTier; score: number } | null = null;

  for (const order of orders) {
    let exact = 0;
    let initialsConfirmed = 0;
    let fuzzy = 0;
    let failed = false;

    for (let i = 0; i < names.length; i++) {
      const person = people[order[i] ?? -1];
      if (!person) { failed = true; break; }
      const nm = names[i]!;
      const last = normalizeSurname(person.last);
      if (last === nm.surname) {
        if (!initialAgrees(nm, person.first)) { failed = true; break; }
        exact++;
        if (nm.initial) initialsConfirmed++;
      } else if (sameSchool && editDistance(last, nm.surname, 1) <= 1 && nm.surname.length >= 4) {
        if (!initialAgrees(nm, person.first)) { failed = true; break; }
        fuzzy++;
      } else {
        failed = true;
        break;
      }
    }
    if (failed) continue;

    const covered = exact + fuzzy;
    const isMaverick = names.length < people.length || people.length < 2;
    let tier: MatchTier;
    if (fuzzy > 0) tier = 'fuzzy-surname';
    else if (isMaverick) tier = 'partial-maverick';
    else if (initialsConfirmed > 0) tier = 'exact-initials';
    else tier = 'exact-surnames';

    const base =
      tier === 'exact-initials' ? 100 :
      tier === 'exact-surnames' ? 80 :
      tier === 'partial-maverick' ? 60 : 40;
    const score = base + covered * 2 + (sameSchool ? 5 : 0) + initialsConfirmed;
    if (!best || score > best.score) best = { tier, score };
  }
  return best;
}

export interface MatchResult {
  /** Index in the input array -> matched entry. */
  matches: Map<number, Match>;
  /** Sheet rows that matched nothing. */
  unmatched: number[];
  /** Rows whose best candidates tied; left unmatched rather than guessed. */
  ambiguous: { index: number; entryIds: string[] }[];
}

/**
 * Assigns sheet rows to Tabroom entries one-to-one within a single tournament.
 *
 * Greedy over the global best score. Because every score is computed before any
 * assignment, a strong exact match always claims its entry ahead of a weaker
 * fuzzy one competing for the same row.
 */
export function matchTeams(teams: SheetTeam[], candidates: EntryCandidate[]): MatchResult {
  interface Scored { index: number; entryId: string; tier: MatchTier; score: number }
  const scored: Scored[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (const c of candidates) {
      const s = scoreCandidate(teams[i]!, c);
      if (s) scored.push({ index: i, entryId: c.entryId, tier: s.tier, score: s.score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const matches = new Map<number, Match>();
  const usedEntries = new Set<string>();
  const ambiguous: { index: number; entryIds: string[] }[] = [];

  for (const s of scored) {
    if (matches.has(s.index) || usedEntries.has(s.entryId)) continue;
    // Refuse to pick between equally good candidates for the same row.
    const rivals = scored.filter(
      (o) => o.index === s.index && o.score === s.score && o.entryId !== s.entryId && !usedEntries.has(o.entryId),
    );
    if (rivals.length > 0) {
      ambiguous.push({ index: s.index, entryIds: [s.entryId, ...rivals.map((r) => r.entryId)] });
      matches.set(s.index, { entryId: s.entryId, tier: s.tier, score: s.score, ambiguous: true });
      usedEntries.add(s.entryId);
      continue;
    }
    matches.set(s.index, { entryId: s.entryId, tier: s.tier, score: s.score, ambiguous: false });
    usedEntries.add(s.entryId);
  }

  const unmatched: number[] = [];
  for (let i = 0; i < teams.length; i++) if (!matches.has(i)) unmatched.push(i);
  return { matches, unmatched, ambiguous };
}
