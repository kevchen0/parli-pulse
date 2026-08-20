/**
 * Classifying a Tabroom event into an NPDL division.
 *
 * Tournaments name their events freely: "Open Parli", "OPEN PARLI",
 * "Parli (Open)", "Varsity Parli", "PARLI", "Parli - TOC", "Open
 * Parliamentary", "Parli (Online)". Article XXI cares about exactly two things
 * -- whether an event is parliamentary debate, and whether it is the open
 * (varsity) division -- so those are what we classify.
 */

export type Division = 'open' | 'jv' | 'novice' | 'middle' | 'unknown';

/** Events whose names defeat the heuristics, keyed `${tournId}:${eventId}`. */
export const DIVISION_OVERRIDES: Record<string, Division> = {};

const NOVICE = /\bnovice\b|\brookie\b/i;
const JV = /\bjv\b|\bj\.?v\.?\b|junior\s*varsity/i;
const MIDDLE = /\bmiddle\s*school\b|\bms\b|\bmspf\b/i;
const OPEN = /\bopen\b|\bvarsity\b|\bvar\b|\btoc\b|\bchampionship\b/i;

const PARLI = /\bparli\b|\bparliamentary\b|\bnpda\b|\bpar\b/i;

/** True if the event is parliamentary debate rather than PF/LD/speech. */
export function isParliEvent(name: string, abbr?: string | null): boolean {
  const haystack = `${name} ${abbr ?? ''}`;
  if (!PARLI.test(haystack)) return false;
  // "MSPF"/"NPF"/"OPF" are Public Forum; the bare "PF" substring must not be
  // allowed to match the \bpar\b alternative via abbreviation soup.
  if (/\bpf\b|public\s*forum/i.test(haystack) && !/parli/i.test(haystack)) return false;
  return true;
}

/**
 * Classifies the competitive division. Order matters: a name like "Novice
 * Parli Open Division" is novice, so the restrictive labels are tested first
 * and `open` is the fallback for an unqualified parli event.
 */
export function classifyDivision(
  name: string,
  abbr?: string | null,
  overrideKey?: string,
): Division {
  if (overrideKey && DIVISION_OVERRIDES[overrideKey]) return DIVISION_OVERRIDES[overrideKey]!;

  const haystack = `${name} ${abbr ?? ''}`;
  if (MIDDLE.test(haystack)) return 'middle';
  if (NOVICE.test(haystack)) return 'novice';
  if (JV.test(haystack)) return 'jv';
  if (OPEN.test(haystack)) return 'open';

  // An unqualified parli event at a tournament with no other divisions is the
  // open division -- "PARLI" at every NYPDL tournament, for instance.
  return isParliEvent(name, abbr) ? 'open' : 'unknown';
}
