import { dbReady, getSchools } from '@/lib/db';
import { seasonHref } from '@/lib/season';
import Pager, { PAGE_SIZE, clampPage, pageCount } from '@/app/pager';

export const revalidate = 300;

export default async function SchoolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const schools = await getSchools(season);
  const totalPages = pageCount(schools.length);
  const page = clampPage((await searchParams).page, totalPages);
  const shown = schools.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (schools.length === 0) return <p className="empty">No standings yet.</p>;

  return (
    <>
      <h1>Schools</h1>
      <p className="meta">
        <span><b>{schools.length}</b> member schools</span>
        <span>Hybrid partnerships count half to each school</span>
      </p>
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
                <td className="pts num">{Number(s.points).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager
        page={page}
        total={totalPages}
        rows={schools.length}
        basePath={seasonHref(season, '/points/schools')}
      />
    </>
  );
}
