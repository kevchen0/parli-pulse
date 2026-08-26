/**
 * How a debater is named on the site, including when they have asked not to be.
 *
 * The Privacy page commits to a removal path: "results will still count toward
 * school and partnership figures where the rules require, but the name will not
 * appear." That is two separate behaviours, and only the second belongs here.
 * The points stay in every total, so a school's figure does not move when a
 * debater withdraws their name -- which is both what the rules require and what
 * stops a removal request being legible from the arithmetic.
 *
 * Queries return `null` for a suppressed name rather than the placeholder, so
 * the absence is a value the type system can see. A page that forgets to
 * substitute renders nothing rather than leaking a name.
 */

/** Shown wherever a suppressed debater would otherwise be named. */
export const WITHHELD = 'Name withheld';

/** A debater's name, or the placeholder where a removal request is honoured. */
export const displayName = (name: string | null | undefined): string => name ?? WITHHELD;

/** Whether a name came back suppressed, for styling or for gating a link. */
export const isWithheld = (name: string | null | undefined): boolean =>
  name === null || name === undefined;
