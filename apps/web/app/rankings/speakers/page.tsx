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
        <span><b>{speakers.length}</b> ranked, of {summary.total} who competed</span>
        <span><b>{summary.scores.toLocaleString()}</b> ballots normalized</span>
        <span>minimum 20 ballots to be ranked</span>
      </p>

      <p className="note">
        <b>vs judge</b> is how far above or below that judge&rsquo;s own average the debater
        scored, in standard deviations — so +0.50 means half a deviation better than the
        typical ballot from the judges they drew. <b>Adjusted</b> is the same figure put back
        on the 25-30 scale, and <b>±</b> is the 95% interval around it, which narrows as a
        debater accumulates ballots. Open divisions only. This is our own measure — Article XXI gives speaker points no
        ranking weight, and the league publishes no speaker standings. It covers more debaters
        than the team table does: the league records only results that earned points, so a
        debater with strong speaks and a losing record appears here and not there.
      </p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Debater</th>
              <th className="num">Ballots</th><th className="num">vs judge</th>
              <th className="num">Adjusted</th><th className="num">±95%</th>
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
                <td className="num region">
                  {s.marginDisplay === null ? '—' : `±${Number(s.marginDisplay).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
