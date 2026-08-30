import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { dbReady, getSummary, getTeams } from '@/lib/db';
import { Suspense } from 'react';
import LoadingBar from '@/app/loading-bar';
import FootnoteRef from '@/app/footnote-ref';
import TeamsTable from './table';

export const revalidate = 300;

/**
 * The shell renders at once; the board suspends.
 *
 * `?q=` is read here and handed down as the table's opening query, so a search
 * someone shared still arrives filtered. The table keeps the parameter current
 * from then on without coming back through the server, which is why there is no
 * `?page=` any more and no key on the boundary: nothing the reader does inside
 * the table re-renders this.
 */
export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const sp = await searchParams;
  return (
    <>
      <h1>Teams</h1>
      <p className="lede">Points scored under the Article XXI rules.</p>
      <Suspense fallback={<LoadingBar label="Loading the team standings" />}>
        <TeamsBoard season={season} initialQuery={(sp.q ?? '').trim()} />
      </Suspense>
    </>
  );
}

async function TeamsBoard({ season, initialQuery }: { season: string; initialQuery: string }) {
  const [teams, summary] = await Promise.all([getTeams(season), getSummary(season)]);
  if (teams.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }
  const bids = teams.filter((x) => x.partnersQualified >= 2).length;

  return (
    <>
      <p className="meta">
        <span><b>{teams.length}</b> partnerships ranked</span>
        <span><b>{summary.tournaments}</b> tournaments</span>
        <span>
          <b>{bids}</b> eligible for a TOC bid
          <FootnoteRef notes={[1]} />
        </span>
      </p>

      <TeamsTable rows={teams} season={season} initialQuery={initialQuery} />

      <ol className="footnotes">
        <li id="fn1">
          <b>AQ</b> means both partners are at or above the {TOC_AUTOQUAL_POINTS}-point
          autoqualification line. Under XXII.1.A an individual autoqualifies at that
          threshold, and under XXII.1.E a partnership may accept a bid only when both
          partners autoqualify.{' '}
          <b>AL</b> marks a partnership where one partner autoqualified and the other did
          not, so it cannot accept an autoqualification bid and would need an at-large one.{' '}
          <em>
            TOC qualification labels here are only a prediction. At-large bids depend on
            ordinal rankings, regional bid distributions, and underrepresented group point
            allocations that are not modelled here.
          </em>
        </li>
        <li id="fn2">
          An asterisk beside a total means it disagrees with the league&rsquo;s published
          sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has no row for this partnership yet, which is normal
          for a tournament the league has not scored.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means the sheet reports a figure different from ours. Hover for the
          league&rsquo;s number.{' '}
          <em>Wherever numbers disagree, the league&rsquo;s figure is the official one.</em>
        </li>
      </ol>
    </>
  );
}
