import { dbReady, getSchools } from '@/lib/db';

export const revalidate = 300;

export default async function SchoolsPage() {
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const schools = await getSchools();
  if (schools.length === 0) return <p className="empty">No standings yet.</p>;

  return (
    <>
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
            {schools.map((s, i) => (
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
    </>
  );
}
