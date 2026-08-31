import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { dbReady, getSummary, getTeams } from '@/lib/db';
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
      <TeamsBoard season={season} initialQuery={(sp.q ?? '').trim()} />
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
        <span>
          <b>{bids}</b> eligible for a TOC bid
          <FootnoteRef notes={[1]} />
        </span>
        <span><b>{summary.tournaments}</b> tournaments</span>
      </p>

      <TeamsTable rows={teams} season={season} initialQuery={initialQuery} />

      <ol className="footnotes">
        <li id="fn1">
          <b>AQ</b> means both partners are at or above the {TOC_AUTOQUAL_POINTS}-point
          line, autoqualifying the partnership for the TOC. <b>AL</b> means only one
          debater in a partnership has autoqualified, meaning the team would need an
          at-large bid.{' '}
          <em>
            All TOC qualification labels here are our prediction. At-large bids depend on
            regional bid distributions, underrepresented group point allocations, and other
            factors that are not calculated here.
          </em>
        </li>
        <li id="fn2">
          An asterisk means a figure disagrees with the league&rsquo;s published sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has no row for this partnership yet, which is normal
          for a recent tournament the league has not yet scored.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means our number is different from the league&rsquo;s. Hover for the
          league&rsquo;s number.{' '}
          <em>When in conflict, the league&rsquo;s sheet is always the most accurate.</em>
        </li>
      </ol>
    </>
  );
}
