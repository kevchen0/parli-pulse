import { redirect } from 'next/navigation';
import { dbReady, getSeasons } from '@/lib/db';
import { currentSeason } from '@/lib/season';

export const revalidate = 300;

/**
 * The front door opens onto a table.
 *
 * Landing on a description of the rankings, one click from the rankings, is
 * friction for the people who come here most: a coach checking a standing does
 * not need to be sold the site every time. About, Privacy and Feedback stay in
 * the masthead for anyone who does want the explanation.
 *
 * It forwards to the most recent season that actually holds results, which in
 * the weeks around an opener is not the current one -- an empty table is worse
 * than last season's finished one, and the season bar says plainly which is on
 * screen.
 */
export default async function Home() {
  const current = currentSeason();
  const seasons = dbReady() ? await getSeasons() : [];
  const withResults = seasons.find((s) => s.tournaments > 0);
  const target = seasons.find((s) => s.id === current && s.tournaments > 0)
    ?? withResults
    ?? { id: current };
  redirect(`/${target.id}/points` as never);
}
