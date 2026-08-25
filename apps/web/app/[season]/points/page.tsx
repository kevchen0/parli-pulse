import { dbReady, getSummary, getTeams } from '@/lib/db';

export const revalidate = 300;

export default async function TeamsPage(
  { params }: { params: Promise<{ season: string }> },
) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const [teams, summary] = await Promise.all([getTeams(season), getSummary(season)]);
  if (teams.length === 0) {
    return <p className="empty">No standings yet. Run <code>npm run load</code> then <code>npm run rollup</code>.</p>;
  }

  return (
    <>
      <h1>Article XXI points</h1>
      <p className="lede">
        The league&rsquo;s own scoring, recomputed from published Tabroom results. Where
        these differ from the league&rsquo;s figures, the league&rsquo;s are correct.
      </p>
      <p className="meta">
        <span><b>{teams.length}</b> partnerships ranked</span>
        <span><b>{summary.tournaments}</b> tournaments</span>
        <span><b>{summary.ballots.toLocaleString()}</b> ballots</span>
        <span><b>{teams.filter((x) => x.bidEligible).length}</b> eligible for a TOC bid
          <sup className="fnref"><a href="#fn-bid">1</a></sup></span>
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
                <td>
                  {t.debater1} &amp; {t.debater2}
                  {t.bidEligible ? (
                    <span className="qual" title="Both partners autoqualified (XXII.1.E)">
                      {' '}TOC bid
                    </span>
                  ) : null}
                </td>
                <td className="num">{t.tournaments}</td>
                <td className="pts num">{Number(t.points).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="footnotes">
        <li id="fn-bid">
          <b>TOC bid.</b> Under XXII.1.E a partnership may accept an autoqualification bid
          only when <em>both</em> partners cleared the individual threshold on March 1.
          Individual autoqualification is shown on the debaters table; it is a different
          thing, and a debater can clear it without having a team that can accept.
        </li>
      </ol>
    </>
  );
}
