import { CONTACT } from '@/lib/contact';

export const metadata = { title: 'Privacy — Parli Pulse' };

export default function PrivacyPage() {
  return (
    <main className="wrap prose">
      <h1>Privacy</h1>

      <p className="lede">
        Most of the people named on this site are minors. That shapes what appears here,
        what never will, and how to have something removed.
      </p>

      <h2>What is shown</h2>
      <p>
        Names, schools, tournament results, records and points. All of it is already
        public: the league publishes its rankings, and Tabroom publishes results and
        ballots. Nothing here is obtained privately, and nothing is added to what those
        sources already say.
      </p>

      <h2>What is never shown</h2>
      <ul>
        <li>
          Contact details of any kind. No email addresses, no phone numbers, no
          affiliations beyond the school a debater competed for.
        </li>
        <li>
          Anything that would single out a debater for a low score. There is no
          lowest-speaks view, no ranking from the bottom, and no flag on any individual
          figure.
        </li>
        <li>
          Judge-level detail that would name an individual judge alongside a decision, at
          least until judge pages exist and their design has been settled.
        </li>
      </ul>

      <h2>Messages you send</h2>
      <p>
        The feedback form stores your message so it is not lost if email delivery fails, and
        forwards it to one mailbox that only I read. Name and email are optional and blank
        unless you fill them in. To limit abuse the form counts recent submissions against a
        salted hash of your network address; the address itself is never stored and the hash
        cannot be turned back into one. Messages are not used for anything else.
      </p>

      <h2>Analytics</h2>
      <p>
        Aggregate page counts only, with no cookies, no cross-site tracking and no
        attempt to identify individual visitors. No advertising, and no data sold or
        shared with anyone.
      </p>

      <h2>Removal</h2>
      <p>
        A debater, or a parent or coach on their behalf, can ask to be excluded. There is
        a suppression flag in the data for exactly this, and honouring a request does not
        require a reason. Results will still count toward school and partnership figures
        where the rules require, but the name will not appear.
      </p>
      <p>
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> to make a request, or to raise
        anything on this page that does not sit right. Requests are handled without asking
        for a reason, and go to a mailbox only I read.
      </p>
    </main>
  );
}
