import { dbReady, getDebaters } from '@/lib/db';
import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { seasonHref } from '@/lib/season';
import { Suspense } from 'react';
import Pager, { PAGE_SIZE, TableSearch, clampPage, pageCount } from '@/app/pager';
import TableSkeleton, { DEBATER_COLUMNS } from '@/app/table-skeleton';
import { displayName } from '@/lib/names';
import DebaterLink from '@/app/debater-link';

export const revalidate = 300;

export default async function DebatersPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { season } = await params;
  const sp = await searchParams;
  return (
    <>
      <h1>Debaters</h1>
      <Suspense key={`${sp.q ?? ''}|${sp.page ?? ''}`} fallback={<TableSkeleton columns={DEBATER_COLUMNS} />}>
        <DebatersTable season={season} query={(sp.q ?? '').trim()} pageParam={sp.page} />
      </Suspense>
    </>
  );
}

async function DebatersTable({
  season,
  query,
  pageParam,
}: {
  season: string;
  query: string;
  pageParam: string | undefined;
}) {
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const debaters = await getDebaters(season);
  if (debaters.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }

  const qualified = debaters.filter((d) => d.autoQualified).length;
  const needle = query.toLowerCase();
  const matches = needle
    ? debaters.filter(
        (d) =>
          displayName(d.name).toLowerCase().includes(needle) ||
          (d.school ?? '').toLowerCase().includes(needle),
      )
    : debaters;
  const totalPages = pageCount(matches.length);
  const page = clampPage(pageParam, totalPages);
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <>
      <p className="meta">
        <span><b>{debaters.length}</b> debaters ranked</span>
        <span>
          <b>{qualified}</b> at or above the {TOC_AUTOQUAL_POINTS}-point
          autoqualification line<sup className="fnref"><a href="#fn-aq">1</a></sup>
        </span>
      </p>
      <TableSearch
        action={seasonHref(season, '/points/debaters')}
        query={query}
        placeholder="Search debaters or schools"
      />
      {matches.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Debater</th>
              <th className="num">
                Points<sup className="fnref"><a href="#fn-recon">2</a></sup>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={`${d.id}-${i}`}>
                <td className="rank">{d.rank}</td>
                <td>
                  {d.school ?? '—'}
                  {d.region ? <span className="region"> · {d.region}</span> : null}
                </td>
                <td>
                  <DebaterLink season={season} id={d.id} name={d.name} />
                  {d.autoQualified ? (
                    <abbr className="aq" title="Autoqualified as an individual (XXII.1.A)">
                      {' '}AQ
                    </abbr>
                  ) : null}
                </td>
                  <td className="pts num">
                    {Number(d.points).toFixed(1)}
                    {d.reconciliation === 'pending' && (
                      <abbr className="tick pending" title="Not yet published in the league's sheet">
                        {' '}*
                      </abbr>
                    )}
                    {d.reconciliation === 'differs' && (
                      <abbr
                        className="tick differs"
                        title={`Up to ${Number(d.exposure).toFixed(1)} points rest on partnerships that disagree with the sheet`}
                      >
                        {' '}*
                      </abbr>
                    )}
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager
        page={page}
        total={totalPages}
        rows={matches.length}
        query={query}
        basePath={seasonHref(season, '/points/debaters')}
      />

      <ol className="footnotes">
        <li id="fn-aq">
          <b>AQ</b> means the debater is at or above the {TOC_AUTOQUAL_POINTS}-point
          autoqualification line. Under XXII.1.A an individual with at least{' '}
          {TOC_AUTOQUAL_POINTS} points on March 1 autoqualifies for the TOC.
        </li>
        <li id="fn-recon">
          The league publishes no per-debater table, and our points are derived from
          partnership data. An asterisk beside a total means it disagrees with the
          league&rsquo;s published sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has no row for this partnership yet, which is normal
          for a tournament the league has not scored.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means results depend on partnership data that disagree with the
          league&rsquo;s sheet.{' '}
          <em>Wherever numbers disagree, the league&rsquo;s figure is the official one.</em>
        </li>
      </ol>
    </>
  );
}
