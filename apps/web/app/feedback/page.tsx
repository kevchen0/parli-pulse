import Link from 'next/link';
import { CONTACT } from '@/lib/contact';
import FeedbackForm from './form';

export const metadata = { title: 'Feedback — Parli Pulse' };

const REPO = 'https://github.com/kevchen0/parli-pulse';

export default function FeedbackPage() {
  return (
    <main className="wrap prose">
      <h1>Feedback</h1>

      <p className="lede">
        A wrong number is worth reporting even when you are not certain it is wrong. Most
        errors found so far were found by someone who knew the circuit and thought a result
        looked odd.
      </p>

      <h2>Send a message</h2>
      <p>
        The most useful report names the tournament, the partnership or debater, what the
        site says, and what it should say. A link to the page helps. If the league&rsquo;s
        published figure differs from ours, say so: that points at a specific rule.
      </p>

      <FeedbackForm />

      <h2>Removal requests</h2>
      <p>
        A debater, or a parent or coach on their behalf, can ask to have a name removed.
        Requests are handled without asking for a reason. Use the form above or email{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. The{' '}
        <Link href="/privacy">Privacy page</Link> says what removal does and does not change.
      </p>

      <h2>Other ways to reach me</h2>
      <ul>
        <li>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>, if you would rather use your own mail.
        </li>
        <li>
          <a href={`${REPO}/issues/new`}>A GitHub issue</a>, for anything you are happy to
          discuss in public. Issues are visible to anyone, so removal requests should not go
          here.
        </li>
        <li>
          <a href={REPO}>The repository</a> holds the engine, the rules implementation and
          every known data problem, if you would rather read the code than describe the bug.
        </li>
      </ul>
    </main>
  );
}
