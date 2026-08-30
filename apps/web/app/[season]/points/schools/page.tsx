import { dbReady, getSchools } from '@/lib/db';
import { seasonHref } from '@/lib/season';
import { Suspense } from 'react';
import Pager, { PAGE_SIZE, TableSearch, clampPage, pageCount } from '@/app/pager';
import LoadingBar from '@/app/loading-bar';
import FootnoteRef from '@/app/footnote-ref';

export const revalidate = 300;

export default async function SchoolsPage({
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
      <h1>Schools</h1>
      <Suspense key={`${sp.q ?? ''}|${sp.page ?? ''}`} fallback={<LoadingBar label="Loading the school standings" />}>
        <SchoolsTable season={season} query={(sp.q ?? '').trim()} pageParam={sp.page} />
      </Suspense>
    </>
  );
}

async function SchoolsTable({
  season,
  query,
  pageParam,
}: {
  season: string;
  query: string;
  pageParam: string | undefined;
}) {
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const schools = await getSchools(season);
  const needle = query.toLowerCase();
  const matches = needle
    ? schools.filter(
        (x) => x.name.toLowerCase().includes(needle) || (x.region ?? '').toLowerCase().includes(needle),
      )
    : schools;
  const totalPages = pageCount(matches.length);
  const page = clampPage(pageParam, totalPages);
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (schools.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }

  return (
    <>
      <p className="meta">
        <span><b>{schools.length}</b> member schools with points</span>
        <span>Hybrid partnerships count half to each school</span>
      </p>
      <TableSearch
        action={seasonHref(season, '/points/schools')}
        query={query}
        placeholder="Search schools or regions"
      />
      {matches.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Region</th>
              <th className="num">
                Points<FootnoteRef notes={[1]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => (
              <tr key={`${s.name}-${i}`}>
                <td className="rank">{s.rank}</td>
                <td>{s.name}</td>
                <td className="region">{s.region ?? '—'}</td>
                  <td className="pts num">
                    {Number(s.points).toFixed(1)}
                    {s.reconciliation === 'pending' && (
                      <abbr className="tick pending" title="Not yet published in the league's sheet">
                        {' '}*
                      </abbr>
                    )}
                    {s.reconciliation === 'differs' && (
                      <abbr
                        className="tick differs"
                        title={`Up to ${Number(s.exposure).toFixed(1)} points rest on partnerships that disagree with the sheet`}
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
        basePath={seasonHref(season, '/points/schools')}
      />

      <ol className="footnotes">
        <li id="fn1">
          An asterisk beside a total means it disagrees with the league&rsquo;s published
          sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has not updated its tournament results yet.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means results depend on partnership data that disagree with the
          league&rsquo;s sheet.{' '}
          <em>Wherever numbers disagree, the league&rsquo;s figure is the official one.</em>
        </li>
      </ol>
    </>
  );
}
