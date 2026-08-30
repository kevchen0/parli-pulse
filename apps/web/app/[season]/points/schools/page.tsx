import { dbReady, getSchools } from '@/lib/db';
import SchoolsTable from './table';

export const revalidate = 300;

export default async function SchoolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { season } = await params;
  const sp = await searchParams;
  return (
    <>
      <h1>Schools</h1>
      <SchoolsBoard season={season} initialQuery={(sp.q ?? '').trim()} />
    </>
  );
}

async function SchoolsBoard({ season, initialQuery }: { season: string; initialQuery: string }) {
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const schools = await getSchools(season);
  if (schools.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }

  return (
    <>
      <p className="meta">
        <span><b>{schools.length}</b> member schools with points</span>
        <span>Hybrid partnerships count half to each school</span>
      </p>

      <SchoolsTable rows={schools} initialQuery={initialQuery} />

      <ol className="footnotes">
        <li id="fn1">
          An asterisk beside a total means it disagrees with the league&rsquo;s published
          sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has not updated its tournament results yet.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means results depend on partnership data that disagree with the
          league&rsquo;s sheet.{' '}
          <em>Wherever numbers disagree, the league&rsquo;s figure is the official one.</em>
        </li>
      </ol>
    </>
  );
}
