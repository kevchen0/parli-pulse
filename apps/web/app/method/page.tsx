import Link from 'next/link';

export const metadata = { title: 'Method — Parli Pulse' };

/**
 * A placeholder while the methodology is rewritten.
 *
 * The full version is on the `dev` branch. It is held back rather than shipped
 * because parts of it were unclear, and a methodology page that is hard to
 * follow is worse than one that says it is not ready: a reader who cannot
 * follow an explanation does not conclude the explanation is bad, they
 * conclude the numbers are.
 *
 * Every anchor other pages link to is kept here -- #points, #rating, #prior,
 * #shrink, #speaks -- so a footnote saying "The formula" still lands somewhere
 * deliberate instead of at the top of a page that does not mention it.
 */
export default function MethodPage() {
  return (
    <main className="wrap prose">
      <h1>Method</h1>

      <p className="lede">
        Being rewritten. This page will document how every figure on the site is produced.
      </p>

      <p>
        It covered the Article XXI implementation, the rating and the speaker normalisation,
        with the equations for each. That version was not clear enough to publish, so it is
        being rewritten rather than left up.
      </p>

      <p id="points">
        <b>Article XXI points</b> are computed from Tabroom round data through an
        implementation of{' '}
        <a href="https://docs.google.com/document/d/1xv6klxK9PQPPyAaeJ9Gh9-CGL-nvikRjRAsDTiRYZtw/view">
          the NPDL League Rules
        </a>
        , then compared against the league&rsquo;s{' '}
        <a href="https://www.parliamentarydebate.org/rankings">published figures</a> result
        by result. Where the two disagree, the league&rsquo;s figure is the official one.
      </p>

      <p id="rating">
        <b>The rating</b> is Glicko-2 over partnerships, one rating period per tournament,
        with four changes of our own: a round scores by how the panel split, side is priced
        inside the expectation, the deviation grows with elapsed time rather than periods
        missed, and a new partnership starts from its debaters&rsquo; ratings. The standard
        part is{' '}
        <a href="https://www.glicko.net/glicko/glicko2.pdf">Glickman&rsquo;s Glicko-2</a>.
      </p>

      <p id="prior">
        <span id="shrink" />
        <b>Established</b> is that rating moved toward the field average, further when the
        deviation is wider. The board sorts on it; predictions use the raw rating.
      </p>

      <p id="speaks">
        <b>Speaker points</b> are normalised per ballot against the judge who awarded it,
        using a median and a winsorized spread, and a debater&rsquo;s figure is the mean of
        their own ballots.
      </p>

      <p>
        Until the full version is up, the{' '}
        <a href="https://github.com/kevchen0/parli-pulse">source</a> is the complete answer:
        the engine is in <code>packages/rules</code>, the rating in{' '}
        <code>packages/rating</code>, and the speaker normalisation in{' '}
        <code>packages/speaks</code>. Questions are welcome on the{' '}
        <Link href="/feedback">feedback page</Link>.
      </p>
    </main>
  );
}
