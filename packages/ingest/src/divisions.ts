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

/**
 * A prefix rather than a whole word, so a misspelling still classifies.
 *
 * Singletary's open division is "Novice Parlimentary Debate" -- one letter
 * short of parliamentary -- and under a `\bparli\b` alternative it was not a
 * parli event at all, so its nine novice teams never reached the AFS. One event
 * in the 2025-26 slate, and the looser pattern matches nothing else new.
 */
const PARLI = /\bparli\w*|\bnpda\b|\bpar\b/i;

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
 *
 * Novice and JV are tested **before** middle school, which decides the handful
 * of divisions that combine them -- Stanford's "Parli - Middle School + Novice
 * Combined", thirty teams. XXI.2.B counts novice and JV toward the adjusted
 * field size and middle school not at all, and the league counts these: its
 * Stanford N/JV is 49 against a JV division of 18. A pure middle-school event
 * still classifies as middle and stays out, which the same sheet confirms --
 * NPDL Nationals records N/JV as 0 beside a 15-team Middle School Parli.
 */
export function classifyDivision(
  name: string,
  abbr?: string | null,
  overrideKey?: string,
): Division {
  if (overrideKey && DIVISION_OVERRIDES[overrideKey]) return DIVISION_OVERRIDES[overrideKey]!;

  const haystack = `${name} ${abbr ?? ''}`;
  if (NOVICE.test(haystack)) return 'novice';
  if (JV.test(haystack)) return 'jv';
  if (MIDDLE.test(haystack)) return 'middle';
  if (OPEN.test(haystack)) return 'open';

  // An unqualified parli event at a tournament with no other divisions is the
  // open division -- "PARLI" at every NYPDL tournament, for instance.
  return isParliEvent(name, abbr) ? 'open' : 'unknown';
}
