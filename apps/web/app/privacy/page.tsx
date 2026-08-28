import Link from 'next/link';
import { CONTACT } from '@/lib/contact';

export const metadata = { title: 'Privacy — Parli Pulse' };

export default function PrivacyPage() {
  return (
    <main className="wrap prose">
      <h1>Privacy</h1>

      <p className="lede">
        Most people named on this site are minors. Nothing here goes beyond what the league
        and Tabroom already publish.
      </p>

      <h2>What is shown</h2>
      <p>
        Names, schools, tournament results, records and points. The league publishes its
        rankings and Tabroom publishes results and ballots. This site reorganises those
        figures and adds nothing to them.
      </p>

      <h2>What is never shown</h2>
      <ul>
        <li>
          Contact details. No email addresses, no phone numbers, and no affiliation beyond
          the school a debater competed for.
        </li>
        <li>
          Anything that singles out a debater for a low score. There is no lowest-speaks
          view, no ranking from the bottom, and no flag on an individual figure.
        </li>
        <li>Any judge named alongside a decision they made.</li>
      </ul>

      <h2>Messages you send</h2>
      <p>
        The feedback form saves your message and forwards it to one mailbox that only I
        read. Name and email are optional. To limit abuse the form counts recent
        submissions from the same network address, using a salted hash: the address is
        never stored, and the hash cannot be turned back into one. Messages are used for
        nothing else.
      </p>

      <h2>Analytics</h2>
      <p>
        None. The site sets no cookies, runs no tracking script, and collects nothing about
        who visits. If that changes it will be aggregate page counts with no cookies and no
        attempt to identify a visitor, and this page will say so before it ships.
      </p>

      <h2>Removal</h2>
      <p>
        A debater, or a parent or coach on their behalf, can ask to have their name removed.
        We do not ask for a reason. A removed name appears nowhere on the site, including as
        a partner or an opponent on somebody else&rsquo;s page, and cannot be found by
        search. Results still count toward school and partnership totals, which the rules
        require.
      </p>
      <p>
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>, or use the{' '}
        <Link href="/feedback">feedback form</Link>.
      </p>
    </main>
  );
}
