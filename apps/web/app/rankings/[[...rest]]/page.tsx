import { redirect } from 'next/navigation';
import { currentSeason } from '@/lib/season';

/**
 * The paths that existed before sections were grouped, kept working.
 *
 * `/rankings/...` is what every link shared before this change points at, and
 * the shape it pointed at is gone: Teams, Debaters and Schools now sit under
 * Points, and the two measures of our own sit outside it. The mapping is
 * explicit rather than a prefix rewrite, because the restructure moved pages
 * between sections and a rewrite would land them in the wrong one.
 *
 * A temporary redirect: the destination season changes every August, and a
 * permanent one would be cached by browsers long past the point it is true.
 */
const MOVED: Record<string, string> = {
  '': '/points',
  'debaters': '/points/debaters',
  'schools': '/points/schools',
  'speakers': '/speakers',
  'ratings': '/ratings',
  'ratings/method': '/method/ratings',
  'diagnostic': '/diagnostic',
};

export default async function LegacyRankings({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;
  const key = rest?.join('/') ?? '';
  // An unrecognised tail lands on Points rather than a 404: the reader followed
  // a link that used to work, and the season's front page is a better answer
  // than an error.
  const target = MOVED[key] ?? '/points';
  redirect(`/${currentSeason()}${target}` as never);
}
