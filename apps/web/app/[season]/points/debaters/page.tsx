import { dbReady, getDebaters } from '@/lib/db';
import { TOC_AUTOQUAL_POINTS } from '@parli-pulse/rules';
import FootnoteRef from '@/app/footnote-ref';
import DebatersTable from './table';

export const revalidate = 300;

export default async function DebatersPage({
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
      <h1>Debaters</h1>
      <DebatersBoard season={season} initialQuery={(sp.q ?? '').trim()} />
    </>
  );
}

async function DebatersBoard({ season, initialQuery }: { season: string; initialQuery: string }) {
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const debaters = await getDebaters(season);
  if (debaters.length === 0) {
    return (
      <p className="empty">
        No standings yet for this season. They appear as tournaments report.
      </p>
    );
  }
  const qualified = debaters.filter((d) => d.autoQualified).length;

  return (
    <>
      <p className="meta">
        <span><b>{debaters.length}</b> debaters ranked</span>
        <span>
          <b>{qualified}</b> at or above the {TOC_AUTOQUAL_POINTS}-point
          autoqualification line<FootnoteRef notes={[1]} />
        </span>
      </p>

      <DebatersTable rows={debaters} season={season} initialQuery={initialQuery} />

      <ol className="footnotes">
        <li id="fn1">
          <b>AQ</b> means the debater is at or above the {TOC_AUTOQUAL_POINTS}-point
          autoqualification line. Under XXII.1.A an individual with at least{' '}
          {TOC_AUTOQUAL_POINTS} points on March 1 autoqualifies for the TOC.
        </li>
        <li id="fn2">
          The league publishes no per-debater table, and our points are derived from
          partnership data. An asterisk beside a total means it disagrees with the
          league&rsquo;s published sheet.{' '}
          <abbr className="tick pending">*</abbr>{' '}
          <b>amber</b> means the sheet has no row for this partnership yet, which is normal
          for a tournament the league has not scored.{' '}
          <abbr className="tick differs">*</abbr>{' '}
          <b>red</b> means results depend on partnership data that disagree with the
          league&rsquo;s sheet.{' '}
          <em>Wherever numbers disagree, the league&rsquo;s figure is the official one.</em>
        </li>
      </ol>
    </>
  );
}
