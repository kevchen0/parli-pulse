import Link from 'next/link';
import { WITHHELD, isWithheld } from '@/lib/names';
import { debaterHref } from '@/lib/season';

/**
 * A debater's name, linked to their page unless it has been withheld.
 *
 * The two halves belong together. A withheld debater has no page -- the route
 * returns a 404 rather than a stub -- so a link to one would be a promise the
 * site cannot keep, and a link whose text is a placeholder invites a reader to
 * click it to find out who. One component so the two facts cannot come apart
 * in one of the four tables that render a name.
 */
export default function DebaterLink({
  season,
  id,
  name,
}: {
  season: string;
  id: string;
  name: string | null;
}) {
  if (isWithheld(name)) return <span className="faint">{WITHHELD}</span>;
  return <Link href={debaterHref(season, id)}>{name}</Link>;
}
