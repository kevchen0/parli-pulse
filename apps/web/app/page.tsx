import { CURRENT_SEASON, hasDatabase } from '@/lib/season';

export default function Home() {
  const connected = hasDatabase();

  return (
    <main>
      <h1>Parli Pulse</h1>
      <p className="lede">
        Rankings for American high school parliamentary debate — the league&rsquo;s official
        Article XXI points, alongside an independent rating computed from round-level
        results.
      </p>

      <p className="status">
        <span className={connected ? 'dot on' : 'dot'} aria-hidden />
        {connected
          ? `Database connected — ${CURRENT_SEASON} season.`
          : 'Database not connected yet. Rankings appear once ingestion runs.'}
      </p>

      <h2>What goes here</h2>
      <div className="grid">
        <section className="card">
          <h3>Rankings</h3>
          <p>Team, individual, school, and TOC-qualification tables, with each team&rsquo;s
            best-five point breakdown.</p>
        </section>
        <section className="card">
          <h3>Rating</h3>
          <p>A Glicko-2 rating over every ballot, shown with its confidence interval and
            kept visually distinct from official points.</p>
        </section>
        <section className="card">
          <h3>Speaker points</h3>
          <p>Normalized within each judge, so a generous panel and a harsh one are
            comparable.</p>
        </section>
        <section className="card">
          <h3>Profiles</h3>
          <p>Debater, team, school, and tournament pages, including head-to-head
            records.</p>
        </section>
      </div>
    </main>
  );
}
