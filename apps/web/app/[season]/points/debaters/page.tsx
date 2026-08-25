import { dbReady, getDebaters } from '@/lib/db';
import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import { seasonHref } from '@/lib/season';
import Pager, { PAGE_SIZE, clampPage, pageCount } from '@/app/pager';

export const revalidate = 300;

export default async function DebatersPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const debaters = await getDebaters(season);
  if (debaters.length === 0) return <p className="empty">No standings yet.</p>;

  const qualified = debaters.filter((d) => d.autoQualified).length;
  const totalPages = pageCount(debaters.length);
  const page = clampPage((await searchParams).page, totalPages);
  const shown = debaters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <>
      <h1>Debaters</h1>
      <p className="meta">
        <span><b>{debaters.length}</b> debaters with Article XXI points</span>
        <span>
          <b>{qualified}</b> at or above the {TOC_AUTOQUAL_POINTS}-point
          autoqualification line<sup className="fnref"><a href="#fn-aq">1</a></sup>
        </span>
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Debater</th><th className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={`${d.name}-${i}`}>
                <td className="rank">{d.rank}</td>
                <td>
                  {d.school ?? '—'}
                  {d.region ? <span className="region"> · {d.region}</span> : null}
                </td>
                <td>
                  {d.name}
                  {d.autoQualified ? (
                    <abbr className="aq" title="Autoqualified as an individual (XXII.1.A)">
                      {' '}AQ
                    </abbr>
                  ) : null}
                </td>
                <td className="pts num">{Number(d.points).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager
        page={page}
        total={totalPages}
        rows={debaters.length}
        basePath={seasonHref(season, '/points/debaters')}
      />

      <ol className="footnotes">
        <li id="fn-aq">
          <b>AQ.</b> Under XXII.1.A an individual with at least {TOC_AUTOQUAL_POINTS} points
          on March 1 autoqualifies for the TOC. It is an individual threshold: a partnership
          may only accept a bid when <em>both</em> partners cleared it, which is shown on the{' '}
          <a href={seasonHref(season, '/points')}>teams table</a>. Autoqualification also
          depends on results being reported by the deadline, so treat this as a guide rather
          than a statement about who is going.
        </li>
      </ol>
    </>
  );
}
