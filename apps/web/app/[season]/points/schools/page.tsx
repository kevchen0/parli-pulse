import { dbReady, getSchools } from '@/lib/db';
import { seasonHref } from '@/lib/season';
import Pager, { PAGE_SIZE, TableSearch, clampPage, pageCount } from '@/app/pager';

export const revalidate = 300;

export default async function SchoolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const schools = await getSchools(season);
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const needle = query.toLowerCase();
  const matches = needle
    ? schools.filter(
        (x) => x.name.toLowerCase().includes(needle) || (x.region ?? '').toLowerCase().includes(needle),
      )
    : schools;
  const totalPages = pageCount(matches.length);
  const page = clampPage(sp.page, totalPages);
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (schools.length === 0) return <p className="empty">No standings yet.</p>;

  return (
    <>
      <h1>Schools</h1>
      <p className="meta">
        <span><b>{schools.length}</b> member schools</span>
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
            <tr><th>#</th><th>School</th><th>Region</th><th className="num">Points</th></tr>
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
        <li id="fn-recon">
          An asterisk beside a total means it is not settled against the league&rsquo;s
          published sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          amber means the sheet has no row yet, which is normal for a tournament the
          league has not written up.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          red means results behind this total disagree with the sheet by enough to matter.
          The league publishes no per-school table we mirror, so this is derived from the
          partnerships behind the total rather than compared directly, and thresholded on
          size — a total is marked when at least one per cent of it rests on partnerships
          that disagree. It says a result feeding this figure is unsettled, not that the
          league&rsquo;s school total differs.
          The <a href={seasonHref(season, '/diagnostic')}>reconciliation page</a> shows
          which result caused it.
        </li>
      </ol>
    </>
  );
}
