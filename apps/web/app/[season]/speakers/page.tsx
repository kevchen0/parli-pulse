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
        <span>
          <b>{speakers.length}</b> debaters with 20 or more ballots
          <sup className="fnref"><a href="#fn1">1</a></sup>
        </span>
        <span><b>{summary.rankedBallots.toLocaleString()}</b> ballots between them</span>
        <span>Open divisions only</span>
      </p>

      <SpeakerTable rows={speakers} season={season} />

      <ol className="footnotes">
        <li id="fn1">
          Twenty is where extra ballots stop buying precision. Among debaters with ten
          ballots or fewer, season averages are spread 0.71 standard deviations apart, and
          most of that is the draw rather than the debater; from eleven to twenty it is
          0.51, from twenty-one to thirty 0.37, and past fifty 0.30. A debater below the
          line keeps every score but is not ranked.
        </li>
        <li id="fn2">
          <b>Z-score</b> is how far a debater&rsquo;s speaks fell above or below the average
          of the judge who gave them, counted in standard deviations of that judge&rsquo;s
          own scores. Tabroom publishes no such figure: every ballot is normalized here
          against its own judge, and a debater&rsquo;s number is the mean of their ballots.
          Zero is exactly average and +1.00 is a full standard deviation above. The ± is the
          95% confidence interval on that mean, wider for a debater with fewer or more
          scattered ballots; where two scores tie, the narrower interval ranks first.
        </li>
        <li id="fn3">
          <b>Raw</b> is the plain average speaker score, with no adjustment for the judge, on
          the 25-30 scale. Tournaments using a different one (NYPDL runs 23-30) are mapped
          onto 25-30 first.
        </li>
      </ol>
    </>
  );
}
