import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { dbReady, getSummary, getTeams, type TeamRow } from '@/lib/db';
import { seasonHref } from '@/lib/season';
import { Suspense } from 'react';
import Pager, { PAGE_SIZE, TableSearch, clampPage, pageCount } from '@/app/pager';
import TableSkeleton, { TEAM_COLUMNS } from '@/app/table-skeleton';
import { displayName, nameMatches } from '@/lib/names';
import DebaterLink from '@/app/debater-link';
import FootnoteRef from '@/app/footnote-ref';

export const revalidate = 300;

/**
 * A partnership's standing relative to the TOC, as far as points can say it.
 *
 * `bid` is the one the rules decide outright: XXII.1.E lets a partnership accept
 * an autoqualification bid only when both partners cleared the individual
 * threshold. `atLarge` marks a partnership with one partner qualified and one
 * not, which cannot accept a bid and would need an at-large one.
 *
 * At-large bids are awarded by committee against regional allocations that are
 * not modelled here, so this predicts nothing. It says which side of XXII.1.E a
 * partnership fell on, and no more.
 */
function tocStanding(team: TeamRow): 'bid' | 'atLarge' | null {
  if (team.partnersQualified >= 2) return 'bid';
  return team.partnersQualified === 1 ? 'atLarge' : null;
}

/**
 * The shell renders at once; the table suspends.
 *
 * The Suspense key carries the search parameters, so changing a page or a search
 * remounts the boundary and the skeleton appears immediately. Without the key
 * the boundary is already resolved and React keeps showing the previous rows
 * until the new ones arrive -- which is a click that looks like it did nothing.
 */
export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const sp = await searchParams;
  return (
    <>
      <h1>Teams</h1>
      <p className="lede">Points scored under the Article XXI rules.</p>
      <Suspense key={`${sp.q ?? ''}|${sp.page ?? ''}`} fallback={<TableSkeleton columns={TEAM_COLUMNS} />}>
        <TeamsTable season={season} query={(sp.q ?? '').trim()} pageParam={sp.page} />
      </Suspense>
    </>
  );
}

async function TeamsTable({
  season,
  query,
  pageParam,
}: {
  season: string;
  query: string;
  pageParam: string | undefined;
}) {
  const [teams, summary] = await Promise.all([getTeams(season), getSummary(season)]);
  if (teams.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }

  const needle = query.toLowerCase();
  const matches = needle
    ? teams.filter(
        (x) =>
          nameMatches(x.debater1, needle) ||
          nameMatches(x.debater2, needle) ||
          (x.school ?? '').toLowerCase().includes(needle),
      )
    : teams;
  const totalPages = pageCount(matches.length);
  const page = clampPage(pageParam, totalPages);
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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

      <TableSearch
        action={seasonHref(season, '/points')}
        query={query}
        placeholder="Search debaters or schools"
      />
      {matches.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Partnership</th>
              <th className="num">Tourns</th>
              <th className="num">
                Points<FootnoteRef notes={[2]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t, i) => {
              const standing = tocStanding(t);
              return (
                <tr key={`${t.debater1 ?? 'withheld'}-${t.debater2 ?? 'withheld'}-${i}`}>
                  <td className="rank">{t.rank}</td>
                  <td>
                    {t.school ?? '—'}
                    {t.region ? <span className="region"> · {t.region}</span> : null}
                  </td>
                  <td>
                    <DebaterLink season={season} id={t.debater1Id} name={t.debater1} />
                    {' & '}
                    <DebaterLink season={season} id={t.debater2Id} name={t.debater2} />
                    {standing === 'bid' && (
                      <abbr className="aq" title="Both partners autoqualified (XXII.1.A, XXII.1.E)">
                        {' '}AQ
                      </abbr>
                    )}
                    {standing === 'atLarge' && (
                      <abbr className="al" title="One partner autoqualified, the other did not">
                        {' '}AL
                      </abbr>
                    )}
                  </td>
                  <td className="num">{t.tournaments}</td>
                  <td className="pts num">
                    {Number(t.points).toFixed(1)}
                    {t.reconciliation === 'pending' && (
                      <abbr className="tick pending" title="Not yet published in the league's sheet">
                        {' '}*
                      </abbr>
                    )}
                    {t.reconciliation === 'differs' && (
                      <abbr
                        className="tick differs"
                        title={`League's sheet says ${Number(t.officialPoints).toFixed(1)}`}
                      >
                        {' '}*
                      </abbr>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pager
        page={page}
        total={totalPages}
        rows={matches.length}
        query={query}
        basePath={seasonHref(season, '/points')}
      />

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
