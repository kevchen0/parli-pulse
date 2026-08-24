/**
 * Choosing which Tabroom event a league result belongs to.
 *
 * Normally a tournament has one open parli division and the choice is
 * automatic. Occasionally one Tabroom tournament hosts several competitions
 * that the league scores separately: "NPDL Nationals and Round Robin" carries
 * an `Open Parli` field of 41 and a 12-team invitational `Round Robin`, and the
 * league lists them as two tournaments sharing a single tourn_id.
 *
 * Left alone, both sets of results are matched against the Nationals field, so
 * the Round Robin's disappear entirely -- and its event is not even recognised
 * as parliamentary debate, since nothing in the name says so.
 */
import { classifyDivision, isParliEvent } from './divisions.ts';

/** League tournament name -> the event name that actually holds its results. */
export const EVENT_OVERRIDES: { tournament: RegExp; event: RegExp }[] = [
  { tournament: /^NPDL Round Robin$/i, event: /round\s*robin/i },
  { tournament: /^NPDL Nationals$/i, event: /open\s*parli/i },
];

export interface SelectableEvent {
  name: string;
  abbr: string | null;
  division: string;
  isParli: boolean;
}

/**
 * Returns a predicate selecting the open-division events for one league
 * tournament. Falls back to the ordinary rule -- parliamentary, open division
 * -- when no override applies.
 */
export function openEventFilter(
  officialName: string,
): (event: SelectableEvent) => boolean {
  const override = EVENT_OVERRIDES.find((o) => o.tournament.test(officialName));
  // Every league tournament sharing a payload has its own entry above, so the
  // default rule never needs to exclude a sibling's event -- and must not try,
  // since patterns like /open parli/ match most tournaments in the season.
  if (override) return (e) => override.event.test(e.name);
  return (e) => e.isParli && e.division === 'open';
}

export { classifyDivision, isParliEvent };
