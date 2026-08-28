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
        Report a wrong number, a website bug, or leave suggestions for features to add.
      </p>

      <h2>Send a message</h2>
      <p>
        Name the tournament, the partnership or debater, what the site shows, and what it
        should show. A link to the page helps. If the league&rsquo;s published figure
        differs from ours, say which one you are looking at.
      </p>

      <FeedbackForm />

      <h2>Removal requests</h2>
      <p>
        A debater, or a parent or coach on their behalf, can ask to have a name removed. I
        do not ask for a reason. Use the form above, or email{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. The{' '}
        <Link href="/privacy">Privacy page</Link> describes what removal changes.
      </p>

      <h2>Other ways to reach me</h2>
      <ul>
        <li>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>, if you prefer your own mail client.
        </li>
        <li>
          <a href={`${REPO}/issues/new`}>A GitHub issue</a>, for anything you are willing to
          discuss in public. Issues are visible to anyone, so do not use one for a removal
          request.
        </li>
        <li>
          <a href={REPO}>The repository</a> holds the engine, the rules implementation, and
          the list of known data problems.
        </li>
      </ul>
    </main>
  );
}
