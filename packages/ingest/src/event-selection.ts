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

/**
 * League tournament name -> the event holding its results, and optionally a
 * different event supplying its field size.
 *
 * The two are not always the same thing. NPDL's Round Robin is a twelve-team
 * invitational running inside Nationals, and the league scores it against the
 * *Nationals* field rather than its own: both rows of the sheet carry an open
 * field of 37, an elim field of 13 and six prelims, which are Open Parli's
 * figures and not the Round Robin's twelve and six. Reading the field off the
 * event that holds the results puts a twelve-team AFS on a tournament the
 * league scored as a thirty-seven-team one -- several rows of the elim points
 * table apart.
 */
export const EVENT_OVERRIDES: {
  tournament: RegExp;
  event: RegExp;
  /** Where the field size comes from, when it is not the results event. */
  fieldEvent?: RegExp;
}[] = [
  { tournament: /^NPDL Round Robin$/i, event: /round\s*robin/i, fieldEvent: /open\s*parli/i },
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

/**
 * The events whose sizes make up this league tournament's field.
 *
 * Usually the same events the results come from. Where an override names a
 * `fieldEvent`, that one wins: see EVENT_OVERRIDES for why the Round Robin's
 * field is Nationals'.
 */
export function fieldEventFilter(
  officialName: string,
): (event: SelectableEvent) => boolean {
  const override = EVENT_OVERRIDES.find((o) => o.tournament.test(officialName));
  if (override?.fieldEvent) {
    const pattern = override.fieldEvent;
    return (e) => pattern.test(e.name);
  }
  return openEventFilter(officialName);
}

export { classifyDivision, isParliEvent };
