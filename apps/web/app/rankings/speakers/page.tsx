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
        judge as much as the debater — panels differ by two points or more — so{' '}
        <strong>every ballot is scored against the judge who gave it</strong>, and a
        debater&rsquo;s figure is the average of those comparisons across every judge they
        faced.
      </p>

      <p className="meta">
        <span><b>{speakers.length}</b> ranked speakers</span>
        <span><b>{summary.total}</b> debaters with open-division ballots</span>
        <span><b>{summary.scores.toLocaleString()}</b> ballots normalized</span>
        <span>minimum 20 ballots to rank</span>
      </p>

      <p className="note">
        <b>vs judges</b> averages one comparison per ballot: each is measured in standard
        deviations against the average score <em>that particular judge</em> gives, then the
        debater&rsquo;s ballots are averaged. So +0.50 across 40 ballots means half a deviation
        better than typical, sustained over 40 separate judges&rsquo; standards — not a single
        comparison. <b>Adjusted</b> puts that back on the 25-30 scale. <b>±95%</b> is the
        confidence interval on it, from the spread of the debater&rsquo;s own ballots and how
        many they have. Open divisions only. This is our own measure — Article XXI gives speaker points no
        ranking weight, and the league publishes no speaker standings. It covers more debaters
        than the team table does: the league records only results that earned points, so a
        debater with strong speaks and a losing record appears here and not there.
      </p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>School</th><th>Debater</th>
              <th className="num">Ballots</th><th className="num">vs judges</th>
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
