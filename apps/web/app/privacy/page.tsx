import Link from 'next/link';
import { CONTACT } from '@/lib/contact';

export const metadata = { title: 'Privacy — Parli Pulse' };

export default function PrivacyPage() {
  return (
    <main className="wrap prose">
      <h1>Privacy</h1>

      <p className="lede">
        All results posted on this site were calculated from publicly available data.
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
          A lowest-ranked view for individual debater tabs, such as debater points and
          speaker points.
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
        The site counts page views through Vercel Web Analytics, so I can see which pages
        are used. It sets no cookies and does not follow anyone across other sites. Visitors
        are counted using a hash of the request that Vercel rotates daily, so the same
        person on two days is two counts and there is no identifier that persists.
      </p>
      <p>
        What is recorded is the page, the referrer, and coarse details such as country,
        browser and whether the device is a phone. No accounts, no advertising, and nothing
        sold or shared.
      </p>

      <h2>Removal</h2>
      <p>
        A debater, or a parent or coach on their behalf, can ask to have their name removed.
        We do not ask for a reason.
      </p>
      <p>
        The name is then replaced with &ldquo;Name withheld&rdquo; everywhere it would
        appear, including as a partner or as an opponent on somebody else&rsquo;s page. It
        cannot be found by search, and the debater&rsquo;s own page returns not found.
      </p>
      <p>
        The results stay. Points still count toward school and partnership totals, which the
        rules require, so a row remains showing the school, the partner and the figures.
        Somebody who compares that row against the league&rsquo;s own published standings
        can often work out whose it is. Removing the row instead would move a school&rsquo;s
        total, which would make the request visible in the arithmetic. If that trade does
        not work for you, say so when you write and we will talk about it.
      </p>
      <p>
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>, or use the{' '}
        <Link href="/feedback">feedback form</Link>.
      </p>
    </main>
  );
}
