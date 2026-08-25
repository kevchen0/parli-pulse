import { redirect } from 'next/navigation';
import { currentSeason } from '@/lib/season';

/**
 * The season-less paths, kept working.
 *
 * `/rankings/...` predates seasons being routable and is what any link shared
 * before this change points at. It forwards to whichever season is current when
 * the request arrives -- computed per request, not at build, so the site rolls
 * over on the morning of an opener without a redeploy.
 *
 * A temporary redirect rather than a permanent one: the destination changes
 * every August, and a 308 would be cached by browsers long past the point where
 * it is still true.
 */
export default async function LegacyRankings({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;
  const tail = rest?.length ? `/${rest.join('/')}` : '';
  // The destination is only known at request time, so it cannot be checked
  // against the route table the way a literal href is.
  redirect(`/${currentSeason()}/rankings${tail}` as never);
}
