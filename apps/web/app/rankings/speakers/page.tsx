import { dbReady, getSpeakers, getSpeakerSummary } from '@/lib/db';

export const revalidate = 300;

export default async function SpeakersPage() {
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const [speakers, summary] = await Promise.all([getSpeakers(), getSpeakerSummary()]);
  if (speakers.length === 0) {
    return <p className="empty">No speaker standings yet. Run <code>npm run speaks</code>.</p>;
  }

  return (
    <>
      <p className="lede" style={{ marginTop: '-1rem' }}>
        Speaker points normalized against the judge who awarded them. A raw score measures the
        judge as much as the debater — panels differ by two points or more — so these are
        expressed as standard deviations from each judge&rsquo;s own baseline, then mapped back
        onto the familiar scale.
      </p>

      <p className="meta">
        <span><b>{summary.ranked}</b> of {summary.total} debaters listed</span>
        <span><b>{summary.scores.toLocaleString()}</b> ballots normalized</span>
        <span>minimum 20 ballots to be ranked</span>
      </p>

      <p className="note">
        This is our own measure. Article XXI gives speaker points no ranking weight, and the
        league publishes no speaker standings.
      </p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Debater</th>
              <th className="num">Ballots</th><th className="num">vs judge</th>
              <th className="num">Adjusted</th>
            </tr>
          </thead>
          <tbody>
            {speakers.map((s, i) => (
              <tr key={`${s.name}-${i}`}>
                <td className="rank">{s.rank}</td>
                <td>
                  {s.school ?? '—'}
                  {s.region ? <span className="region"> · {s.region}</span> : null}
                </td>
                <td>{s.name}</td>
                <td className="num region">{s.ballots}</td>
                <td className="num">
                  {Number(s.meanZ) > 0 ? '+' : ''}{Number(s.meanZ).toFixed(2)}
                </td>
                <td className="pts num">{Number(s.meanDisplay).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
