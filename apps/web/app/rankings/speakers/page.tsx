import { dbReady, getSpeakers, getSpeakerSummary } from '@/lib/db';
import SpeakerTable from './table';

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
        Speaker points adjusted for the judge who awarded them. Panels differ by two points or
        more, so a raw average depends heavily on the draw.
      </p>

      <p className="meta">
        <span><b>{speakers.length}</b> debaters with 20 or more ballots</span>
        <span><b>{summary.scores.toLocaleString()}</b> ballots</span>
      </p>

      <SpeakerTable rows={speakers} />

      <ol className="footnotes">
        <li>
          <b>Z-score</b> measures every ballot against the judge who gave it — how many
          standard deviations above or below that judge&rsquo;s own average it sits — and
          averages a debater&rsquo;s ballots. Zero is exactly average; +1.00 is a full
          deviation better than the typical ballot from the judges they faced. The figures at
          the top of this table each rest on 19 to 71 different judges, so they average across
          many standards rather than comparing anyone to a single judge. Judges are measured by
          median and interquartile spread, so one unusually low ballot cannot shift everyone
          else they ranked, and a judge with few ballots is pulled toward the field average.
        </li>
        <li>
          The smaller figure beside each z-score is the <b>95% confidence interval</b>: the
          true average is very likely within that much of the number shown. It comes from the
          spread of the debater&rsquo;s own ballots and how many they have, so it narrows over
          a season. Where two debaters share a score, the one with the narrower interval is
          listed first.
        </li>
        <li>
          <b>Raw</b> is the plain average speaker score with no judge adjustment, on the
          familiar 25-30 scale. Where a tournament uses a different one — NYPDL runs 23-30, one
          league 0-100 — scores are mapped onto 25-30 first so the column stays comparable.
          Either column can order the table; click its heading, and again to reverse.
        </li>
        <li>
          Open divisions only, per Article XXI.1.A. This is our own measure; the league
          publishes no speaker standings and gives speaker points no ranking weight.
        </li>
      </ol>
    </>
  );
}
