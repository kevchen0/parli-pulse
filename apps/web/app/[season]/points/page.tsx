import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { dbReady, getSummary, getTeams, type TeamRow } from '@/lib/db';
import { seasonHref } from '@/lib/season';
import Pager, { PAGE_SIZE, TableSearch, clampPage, pageCount } from '@/app/pager';

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

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const [teams, summary] = await Promise.all([getTeams(season), getSummary(season)]);
  if (teams.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }

  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const needle = query.toLowerCase();
  const matches = needle
    ? teams.filter(
        (x) =>
          x.debater1.toLowerCase().includes(needle) ||
          x.debater2.toLowerCase().includes(needle) ||
          (x.school ?? '').toLowerCase().includes(needle),
      )
    : teams;
  const totalPages = pageCount(matches.length);
  const page = clampPage(sp.page, totalPages);
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const bids = teams.filter((x) => x.partnersQualified >= 2).length;
  const unresolved = teams.filter((x) => x.reconciliation !== 'agrees').length;

  return (
    <>
      <h1>Teams</h1>
      <p className="lede">
        Points scored under the Article XXI rules, computed from published Tabroom results.
      </p>
      <p className="meta">
        <span><b>{teams.length}</b> partnerships ranked</span>
        <span><b>{summary.tournaments}</b> tournaments</span>
        <span>
          <b>{bids}</b> eligible for a TOC bid
          <sup className="fnref"><a href="#fn-toc">1</a></sup>
        </span>
        {unresolved > 0 && (
          <span>
            <b>{unresolved}</b> not settled against the sheet
            <sup className="fnref"><a href="#fn-recon">2</a></sup>
          </span>
        )}
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
              <th className="num">Tourns</th><th className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t, i) => {
              const standing = tocStanding(t);
              return (
                <tr key={`${t.debater1}-${t.debater2}-${i}`}>
                  <td className="rank">{t.rank}</td>
                  <td>
                    {t.school ?? '—'}
                    {t.region ? <span className="region"> · {t.region}</span> : null}
                  </td>
                  <td>
                    {t.debater1} &amp; {t.debater2}
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
        <li id="fn-toc">
          <b>AQ</b> means both partners finished at or above the {TOC_AUTOQUAL_POINTS}-point
          individual line. Under XXII.1.A an individual autoqualifies at that threshold, and
          under XXII.1.E a partnership may accept a bid only when both partners did — so a
          debater can autoqualify and still have no team able to accept.{' '}
          <b>AL</b> marks a partnership where one partner autoqualified and the other did
          not, so it cannot accept an autoqualification bid and would need an at-large one.{' '}
          <em>
            AL is our guess and nothing more. At-large bids are awarded by committee against
            regional allocations that are not modelled here, qualification depends on results
            reported by a deadline, and a bid must be accepted to be used. Treat this column
            as a rough guide and never as a statement about who is going.
          </em>
        </li>
        <li id="fn-recon">
          An asterisk beside a total means it is not settled against the league&rsquo;s
          published sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has no row for this partnership yet, which is normal
          for a tournament the league has not written up.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means the sheet has a figure and ours differs, which means one of the
          two is wrong. Hover for the league&rsquo;s number. Where they disagree, the
          league&rsquo;s figure is the official one; the{' '}
          <a href={seasonHref(season, '/diagnostic')}>reconciliation page</a> shows which
          result caused it.
        </li>
      </ol>
    </>
  );
}
