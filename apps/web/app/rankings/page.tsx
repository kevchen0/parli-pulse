import { dbReady, getSummary, getTeams } from '@/lib/db';

export const revalidate = 300;

export default async function TeamsPage() {
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const [teams, summary] = await Promise.all([getTeams(), getSummary()]);
  if (teams.length === 0) {
    return <p className="empty">No standings yet. Run <code>npm run load</code> then <code>npm run rollup</code>.</p>;
  }

  return (
    <>
      <p className="meta">
        <span><b>{teams.length}</b> partnerships ranked</span>
        <span><b>{summary.tournaments}</b> tournaments</span>
        <span><b>{summary.ballots.toLocaleString()}</b> ballots</span>
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Partnership</th>
              <th className="num">Tourns</th><th className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={`${t.debater1}-${t.debater2}-${i}`}>
                <td className="rank">{t.rank}</td>
                <td>
                  {t.school ?? '—'}
                  {t.region ? <span className="region"> · {t.region}</span> : null}
                </td>
                <td>{t.debater1} &amp; {t.debater2}</td>
                <td className="num">{t.tournaments}</td>
                <td className="pts num">{Number(t.points).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
