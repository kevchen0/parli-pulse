import { dbReady, getSpeakers, getSpeakerSummary } from '@/lib/db';
import SpeakerTable from './table';

export const revalidate = 300;

export default async function SpeakersPage(
  { params }: { params: Promise<{ season: string }> },
) {
  const { season } = await params;
  if (!dbReady()) return <p className="empty">Standings are unavailable right now. Please try again shortly.</p>;
  const [speakers, summary] = await Promise.all([getSpeakers(season), getSpeakerSummary(season)]);
  if (speakers.length === 0) {
    return (
      <p className="empty">
        No speaker standings yet for this season. They appear as tournaments report.
      </p>
    );
  }

  return (
    <>
      <h1>Speaker points</h1>
      <p className="lede">
        Speaker points adjusted for the judge who awarded them. Panels differ by two points or
        more, so a raw average depends heavily on the draw.
      </p>

      <p className="meta">
        <span><b>{speakers.length}</b> debaters with 20 or more ballots</span>
        <span><b>{summary.rankedBallots.toLocaleString()}</b> ballots between them</span>
        <span>
          open divisions only<sup className="fnref"><a href="#fn4">4</a></sup>
        </span>
      </p>

      <SpeakerTable rows={speakers} season={season} />

      <ol className="footnotes">
        <li id="fn1">
          <b>Z-score.</b> Every ballot is measured against the judge who gave it, in standard
          deviations from that judge&rsquo;s own average, and a debater&rsquo;s figure is the
          mean of theirs. Zero is exactly average; +1.00 is a full standard deviation above the
          typical ballot. It orders the table by default because it is the only column that
          does not reward drawing generous judges.
        </li>
        <li id="fn2">
          <b>The ± figure</b> is the 95% confidence interval on that mean — wider for a debater
          with fewer or more scattered ballots. Where two scores tie, the narrower interval
          ranks first.
        </li>
        <li id="fn3">
          <b>Raw.</b> The plain average speaker score, with no adjustment for the judge, on the
          25-30 scale. Tournaments using a different one (NYPDL runs 23-30, for example) are
          mapped onto 25-30 first.
        </li>
        <li id="fn4">
          Open divisions only. This is our own measure; the league publishes no speaker
          standings and Article XXI gives speaker points no ranking weight.
        </li>
      </ol>
    </>
  );
}
