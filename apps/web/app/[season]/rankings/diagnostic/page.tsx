import {
  dbReady,
  getDiagnostics,
  getDiagnosticSummary,
  getTournamentDiagnostics,
  type DiagnosticResult,
} from '@/lib/db';

export const revalidate = 300;

const fmt = (n: number | null): string => (n === null ? '—' : n.toFixed(1));
const signed = (n: number | null): string =>
  n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

function ResultRow({ r }: { r: DiagnosticResult }) {
  const off = r.ours === null || r.delta !== 0;
  return (
    <tr className={off ? 'off' : undefined}>
      <td>
        {r.tournament}
        {r.counted ? <span className="counted" title="counts toward the season total"> · counts</span> : null}
      </td>
      <td className="num">{fmt(r.official)}</td>
      <td className="num">{r.ours === null ? 'missing' : fmt(r.ours)}</td>
      <td className="num">{r.ours === null ? '' : signed(r.delta)}</td>
      <td className="region">{r.provenance === 'tabroom' ? '' : r.provenance}</td>
    </tr>
  );
}

export default async function DiagnosticPage(
  { params }: { params: Promise<{ season: string }> },
) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Database not connected.</p>;
  const [rows, summary, tournaments] = await Promise.all([
    getDiagnostics(season),
    getDiagnosticSummary(season),
    getTournamentDiagnostics(season),
  ]);
  if (summary.total === 0) {
    return <p className="empty">No diagnostics yet. Run <code>npm run diagnostics</code>.</p>;
  }

  const pct = (n: number): string => `${((100 * n) / summary.total).toFixed(1)}%`;

  return (
    <>
      <p className="lede" style={{ marginTop: '-1rem' }}>
        Every partnership reconciled against the league&rsquo;s published standings, result by
        result. A season total is the weighted best five, so a single wrong result moves it —
        the breakdowns below show which tournament is responsible.
      </p>

      <p className="meta">
        <span><b>{summary.exact}</b> of {summary.total} exact ({pct(summary.exact)})</span>
        <span><b>{summary.differ}</b> differ</span>
        <span><b>{summary.missing}</b> with no standing</span>
      </p>

      <h2>Tournaments contributing differing results</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Tournament</th><th className="num">Results</th><th className="num">Points</th></tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.tournament}>
                <td>{t.tournament}</td>
                <td className="num">{t.differing}</td>
                <td className="num">{Number(t.points).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Partnerships that differ</h2>
      <p className="note">
        Expand a row to see its whole season. Results marked <em>counts</em> are inside the
        best five and therefore affect the total; the rest do not.
      </p>
      {rows.map((row) => (
        <details key={`${row.schoolName}-${row.debater1}-${row.debater2}`} className="diag">
          <summary>
            <span className="rank">{row.officialRank ?? '—'}</span>
            <span className="who">
              {row.schoolName} — {row.debater1} &amp; {row.debater2}
              {row.region ? <span className="region"> · {row.region}</span> : null}
            </span>
            <span className="nums">
              official <b>{fmt(row.officialPoints)}</b>
              {' · '}ours <b>{row.ourPoints === null ? 'none' : fmt(row.ourPoints)}</b>
              {row.delta !== null ? <span className="delta"> ({signed(row.delta)})</span> : null}
            </span>
          </summary>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Tournament</th><th className="num">Official</th>
                  <th className="num">Ours</th><th className="num">Δ</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {row.results.map((r) => <ResultRow key={r.tournament} r={r} />)}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </>
  );
}
