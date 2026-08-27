import { CONTACT } from '@/lib/contact';

export const metadata = { title: 'Feedback — Parli Pulse' };

const REPO = 'https://github.com/kevchen0/parli-pulse';

export default function FeedbackPage() {
  return (
    <main className="wrap prose">
      <h1>Feedback</h1>

      <p className="lede">
        Wrong numbers are worth reporting even when you are not certain they are wrong.
        Most errors found so far were found by someone who knew the circuit and thought a
        result looked odd.
      </p>

      <h2>Reporting a wrong figure</h2>
      <p>
        The most useful report names the tournament, the partnership or debater, what the
        site says, and what it should say. A link to the page helps. If the league&rsquo;s
        published figure differs from ours, say so — that is the most valuable kind of
        report, because it points at a specific rule.
      </p>

      <h2>How to get in touch</h2>
      <ul>
        <li>
          <a href={`${REPO}/issues/new`}>Open an issue on GitHub</a> — best for anything
          you are happy to discuss publicly.
        </li>
        <li>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> — best for anything you would rather
          not put on a public issue tracker, and the address for removal requests.
        </li>
        <li>
          <a href={`${REPO}`}>The repository</a> holds the engine, the rules
          implementation and every known data problem, if you would rather read the code
          than describe the bug.
        </li>
      </ul>

      <h2>Removal requests</h2>
      <p>
        A debater, or a parent or coach on their behalf, can ask to have a name removed.
        Requests are handled without asking for a reason. GitHub issues are public, so
        send these to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> rather than opening one.
        The <a href="/privacy">Privacy page</a> says what removal does and does not
        change.
      </p>
    </main>
  );
}
