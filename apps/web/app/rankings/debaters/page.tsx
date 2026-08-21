import { dbReady, getDebaters } from '@/lib/db';
import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';

export const revalidate = 300;

export default async function DebatersPage() {
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const debaters = await getDebaters();
  if (debaters.length === 0) return <p className="empty">No standings yet.</p>;

  const qualified = debaters.filter((d) => d.autoQualified).length;
  return (
    <>
      <p className="meta">
        <span><b>{debaters.length}</b> debaters listed</span>
        <span>
          <b>{qualified}</b> at or above the {TOC_AUTOQUAL_POINTS}-point TOC
          autoqualification line
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
            {debaters.map((d, i) => (
              <tr key={`${d.name}-${i}`}>
                <td className="rank">{d.rank}</td>
                <td>
                  {d.school ?? '—'}
                  {d.region ? <span className="region"> · {d.region}</span> : null}
                </td>
                <td>
                  {d.name}
                  {d.autoQualified ? <span className="qual"> · TOC</span> : null}
                </td>
                <td className="pts num">{Number(d.points).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
