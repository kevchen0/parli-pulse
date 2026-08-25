import Link from 'next/link';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { dbReady, getRatingMethodFigures } from '@/lib/db';

export const revalidate = 300;

/**
 * How the rating is computed, for a reader who wants to check it rather than
 * take it on trust.
 *
 * Written to be read straight through by a coach with no statistics, with the
 * actual formulas present for anyone who wants them. The two audiences are not
 * served by two documents: a coach who is told "we shrink toward the mean"
 * without being shown the shrinking is being asked to trust a number that
 * disagrees with the league's, and a statistician who is shown only prose
 * cannot check it. Every figure on this page is read from the season being
 * displayed rather than typed in, so it cannot drift from what the pipeline
 * actually did.
 */
export default async function MethodPage() {
  const figures = dbReady() ? await getRatingMethodFigures() : null;

  return (
    <article className="method">
      <p className="lede" style={{ marginTop: '-1rem' }}>
        How the rating works, in three ideas and one formula. Everything here is
        our own measure &mdash; the league publishes nothing like it, and where the two
        disagree, <b>the league&rsquo;s ranking is the official one</b>.
      </p>

      <nav className="method-toc" aria-label="On this page">
        <a href="#problem">The problem</a>
        <a href="#glicko">1. Glicko-2</a>
        <a href="#side">2. Side and panels</a>
        <a href="#prior">3. The field prior</a>
        <a href="#isolation">&mdash; and its limits</a>
        <a href="#reading">Reading a rating</a>
        <a href="#checked">How we checked</a>
        <a href="#limits">What it cannot do</a>
      </nav>

      <section id="problem">
        <h2>The problem this solves</h2>
        <p>
          Article XXI points measure what a partnership <em>accumulated</em>. Enter more
          tournaments, win more rounds, collect more points. That is the right way to
          describe a season, and it is what qualifies teams for the TOC.
        </p>
        <p>
          It is not a description of how <em>good</em> a team is. Five wins against a
          small local field outscore four wins at Stanford, because the rules do not
          ask who you beat. A rating asks exactly that question and nothing else: given
          the opponents you actually faced, how strong do you look?
        </p>
        <p>
          The two will disagree, and they are supposed to. A team that entered six
          tournaments will out-point a better team that entered three.
        </p>
      </section>

      <section id="glicko">
        <h2>Idea one: beating a strong team should count more</h2>
        <p>
          The rating is <b>Glicko-2</b>, a standard system published by Mark Glickman
          and used by chess federations and online game ladders. It gives each
          partnership two numbers rather than one.
        </p>
        <dl className="defs">
          <div>
            <dt>Rating</dt>
            <dd>
              The estimate of strength. Everyone starts at <b>1500</b>. A gap of about
              100 points means the stronger side wins roughly two rounds in three.
            </dd>
          </div>
          <div>
            <dt>Deviation (the &plusmn; figure)</dt>
            <dd>
              How far the truth could reasonably sit from that estimate. It starts wide,
              narrows as a partnership debates, and widens again while they are away.
              A rating of 1800 &plusmn; 60 is a much stronger claim than 1800 &plusmn; 150.
            </dd>
          </div>
        </dl>
        <p>
          After each tournament every rating moves toward what the results implied. Two
          things decide how far:
        </p>
        <ul className="plain">
          <li>
            <b>Who you played.</b> Beating a 1900 partnership moves you further than
            beating a 1300 one. Losing to the 1300 costs you more than losing to the
            1900.
          </li>
          <li>
            <b>How settled each of you was.</b> An unsettled rating moves further than a
            confirmed one, and a result against an opponent nobody has measured teaches
            less than the same result against a known quantity.
          </li>
        </ul>
        <p className="aside">
          The chance that a partnership at rating <code>r</code> beats one at{' '}
          <code>r&prime;</code> is <code>1 / (1 + e^(&minus;g&middot;(r &minus; r&prime;)/173.7))</code>,
          where <code>g</code> shrinks toward zero as the opponent&rsquo;s deviation
          grows. That is what &ldquo;an unmeasured opponent teaches less&rdquo; means in
          arithmetic: the wider their deviation, the closer the predicted result is
          pulled to a coin flip, and the less any outcome moves either rating.
        </p>
        <p>
          A rating period is <b>one tournament</b>. Every round inside it is judged
          against the ratings everyone held before the tournament started, which is
          right &mdash; the teams who met in round one had not yet been changed by meeting.
        </p>
      </section>

      <section id="side">
        <h2>Idea two: two corrections the rounds themselves demand</h2>
        <h3>The opposition wins more</h3>
        <p>
          Across every decided open round this season, opposition took{' '}
          <b>{figures ? `${figures.oppWinPct.toFixed(1)}%` : 'about 52%'}</b>. That is
          not skill, it is the side. A rating that ignored it would quietly credit
          proposition teams with a handicap they did not earn, so the expected result of
          each round is computed against the debating side&rsquo;s rating <em>plus what
          their side is worth</em> &mdash; about{' '}
          <b>{figures ? Math.abs(Math.round(figures.sideAdvantage)) : 17} rating points</b>{' '}
          to opposition on this season, measured from the season rather than assumed.
        </p>
        <p>
          The adjustment enters the expectation only. It never lands in the stored
          rating, so nobody is rated higher for having drawn more opposition.
        </p>

        <h3>A 3&ndash;0 is stronger evidence than a 2&ndash;1</h3>
        <p>
          Tabroom records one ballot per judge, so a three-judge round appears as three
          results. A round is <b>one result</b>, won on a majority &mdash; counting the
          ballots as rounds would inflate everything.
        </p>
        <p>
          But a unanimous panel and a split panel are not the same evidence. A unanimous
          win scores a full win; a 2&ndash;1 scores <code>2/3</code>, part-way toward a
          draw. Single-judge rounds are unanimous by definition and are unaffected.
        </p>
        <p className="aside">
          <b>No bonus for elimination rounds.</b> It is tempting to weight them, and it
          would be double-counting. Elim opponents average 53% more season points than
          prelim opponents, so beating one is <em>already</em> worth more through the
          opponent adjustment above. Adding a multiplier would pay for the same fact
          twice. If elims should count extra for reasons beyond opponent quality &mdash;
          pressure, stakes &mdash; that is a values argument, and it should be made openly
          rather than buried in a parameter.
        </p>
      </section>

      <section id="prior">
        <h2>Idea three: how much of a rating to believe</h2>
        <p>
          Glicko on its own has a flaw that shows up badly in a league this size. Run
          plainly, it put a partnership with <b>twelve rounds</b> at the top of the
          board, rated 1963 &mdash; having never beaten anyone rated above 1725.
        </p>
        <p>
          Nothing went wrong in the arithmetic. A rating built on ten or twelve rounds
          is simply a <em>high-variance</em> estimate: run enough partnerships through a
          short season and a few will have their luck run one way, and their rating goes
          with it. Order the board on the raw rating and it reports whoever has been
          luckiest in the fewest rounds, which is not the question anyone is asking.
        </p>

        <h3>The fix</h3>
        <p>
          Every rating is pulled back toward the middle of the field, by an amount that
          depends on how little we know about it. A settled rating barely moves. A rating
          resting on a handful of rounds moves most of the way back.
        </p>

        <figure className="formula">
          <code>
            shown = 1500 + (rating &minus; 1500) &times;{' '}
            <span className="frac">
              <span>&tau;&sup2;</span>
              <span>&tau;&sup2; + RD&sup2;</span>
            </span>
          </code>
          <figcaption>
            <b>RD</b> is the partnership&rsquo;s own deviation. <b>&tau;</b> is how spread
            out true strengths are across the league. The fraction is the share of the
            rating we keep &mdash; it runs from nearly 1 when we know a lot to nearly 0
            when we know nothing.
          </figcaption>
        </figure>

        <p>
          Read it as a weighted average between a partnership&rsquo;s own result and the
          field&rsquo;s. It is the standard answer to &ldquo;how much of this number should
          I believe?&rdquo;, and it is the same idea the speaker points use when they shrink
          a judge with four ballots toward the field.
        </p>

        {figures && (
          <table className="worked">
            <caption>The same rule, applied to two real partnerships</caption>
            <thead>
              <tr>
                <th>Partnership</th>
                <th>Rounds</th>
                <th>Rating</th>
                <th>&plusmn;RD</th>
                <th>Kept</th>
                <th>Shown</th>
              </tr>
            </thead>
            <tbody>
              {figures.examples.map((e) => (
                <tr key={e.label}>
                  <td className="who">{e.label}</td>
                  <td>{e.rounds}</td>
                  <td>{Math.round(e.rating)}</td>
                  <td>{Math.round(e.deviation)}</td>
                  <td>{Math.round(e.kept * 100)}%</td>
                  <td><b>{Math.round(e.shrunk)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>Where &tau; comes from</h3>
        <p>
          It is measured, not chosen &mdash; there is no dial here to tune until the answer
          looks right. The spread of the ratings we <em>observe</em> is the spread of true
          strengths plus the noise in our own estimates. Subtracting the average squared
          deviation removes the noise and leaves the real spread:
        </p>
        <figure className="formula small">
          <code>&tau; = &radic;( variance of ratings &minus; average RD&sup2; )</code>
        </figure>
        <p>
          On this season that comes to{' '}
          <b>{figures ? `${figures.tau.toFixed(0)} rating points` : 'about 117 rating points'}</b>
          , computed across the{' '}
          {figures ? figures.measured.toLocaleString() : ''} partnerships with{' '}
          {MIN_RATED_ROUNDS} rounds or more.
        </p>

        <h3 id="isolation">What this does not fix</h3>
        <p className="aside">
          The partnership above had also spent <b>92% of its rounds against opponents from
          its own region</b>, and it is tempting to say the correction handles that too.
          It does not, and the distinction matters.
        </p>
        <p>
          A team that debates almost entirely inside one region is rated against opponents
          who are themselves rated on the same local evidence. Nothing anchors that pool to
          the rest of the country, so in principle the whole cluster could drift together
          &mdash; and the deviation would never notice, because it counts how many rounds a
          partnership has debated, not whether they connect to anything.
        </p>
        <p>
          The shrinkage above is <b>blind to this</b>. It discounts a rating for resting on
          few rounds, and the partnership at the top of the board was caught because it had
          twelve of them, not because of where they were. Checked directly: among
          partnerships with forty rounds or more, the shrinkage applied is flat across how
          much of their season was in-region &mdash; 44, 43, 48 and 44 points across the
          bands &mdash; and in-region share is uncorrelated with round count and with
          deviation alike. <b>A well-measured partnership inside an isolated pool keeps its
          rating, and nothing here warns you.</b>
        </p>
        <p>
          On this season no such case is visible: among well-measured partnerships, ratings
          do not rise with in-region share. That is not the same as knowing there is no
          problem &mdash; detecting one would need results the league does not generate.
          It is a real limitation and it is recorded rather than papered over.
        </p>
      </section>

      <section id="reading">
        <h2>Reading a rating: two numbers, two jobs</h2>
        <p>
          The table shows both figures, and they are not interchangeable. This is the one
          thing worth understanding before arguing with the board.
        </p>
        <div className="jobs">
          <div>
            <h3>Shown &mdash; for ranking</h3>
            <p>
              The shrunk figure. A partnership climbs it by being <em>confirmed</em> as
              well as by winning. A board must not reward being unmeasured, and ordering
              on the raw rating does exactly that: it hands the top to whoever has been
              luckiest in the fewest rounds.
            </p>
          </div>
          <div>
            <h3>Rating &mdash; for predicting</h3>
            <p>
              The raw estimate. For a forecast, the uncertainty belongs in the{' '}
              <em>width</em> of the answer, not in the number &mdash; the win probability
              already widens toward a coin flip when either side is unsettled. Shrinking
              first as well would count the same doubt twice, and it measurably predicts
              worse.
            </p>
          </div>
        </div>
        <p>
          Both come from a single run of a single system. The second column is a
          different reading of the same evidence, not a second rating.
        </p>
        <p>
          Partnerships below <b>{MIN_RATED_ROUNDS} rated rounds</b> still have a rating
          but are not ranked on one. Under ten rounds the deviation is doing most of the
          talking, and a place on a public list would overstate what is known.
        </p>
      </section>

      <section id="checked">
        <h2>How we checked it was worth publishing</h2>
        <p>
          The test set in advance was that the rating had to beat the league&rsquo;s own
          ranking at predicting results. If it could not, the honest finding would have
          been that season points already carry the information &mdash; and that is what
          we would have reported.
        </p>
        <p>The season was cut three ways, not two:</p>
        <ol className="split">
          <li><b>Through December</b> &mdash; fits every model&rsquo;s parameters.</li>
          <li><b>January</b> &mdash; chooses between rating variants.</li>
          <li>
            <b>February onward</b> &mdash; touched exactly once, at the end. Choosing the
            variant on the same rounds that report the result is how a tuning exercise
            gets mistaken for a validation.
          </li>
        </ol>
        <p>
          On {figures ? figures.testRounds.toLocaleString() : '2,209'} held-out rounds the
          rating predicted <b>63.4%</b> of results against <b>59.8%</b> for the
          league&rsquo;s ranking &mdash; a 3.6 point gap, 95% interval 1.2 to 6.0 on a paired
          bootstrap. It was better calibrated too, which matters more: when it says a team
          has a 70% chance, they win about 70% of the time.
        </p>
        <p className="aside">
          <b>Do not expect 80%.</b> Debate rounds are genuinely noisy. Of the pairs who met
          exactly twice this season, the same team won both times only <b>58%</b> of the
          time, and <b>56%</b> of three-judge rounds split 2&ndash;1 &mdash; judges watching
          the same round disagree more often than they agree. Both put the ceiling for any
          predictor near 70%. At 63% this rating is already close to the limit of what the
          rounds themselves allow.
        </p>
      </section>

      <section id="limits">
        <h2>What it cannot do</h2>
        <ul className="plain">
          <li>
            <b>It cannot rate a partnership whose results were never published.</b> Rounds
            with no recorded decision are left out rather than guessed at, which is why
            some partnerships with real season points have no rating at all.
          </li>
          <li>
            <b>It cannot see a partnership that never travelled.</b> The field prior stops
            an isolated pool from floating away, but it does this by admitting we do not
            know &mdash; not by discovering the answer. A strong team from a small circuit
            will be understated until they play someone outside it.
          </li>
          <li>
            <b>It cannot separate the two debaters.</b> The unit is the partnership. Rating
            people individually predicts better, and it was rejected deliberately: it can
            only do so by assuming strength adds up, which would rate a pairing that never
            debated a single round together.
          </li>
          <li>
            <b>It is not the league&rsquo;s ranking and must not be read as one.</b> It has
            no bearing on TOC qualification or on Article XXI standing.
          </li>
        </ul>
      </section>

      <p className="backlink">
        <Link href="/rankings/ratings">&larr; Back to the ratings table</Link>
      </p>
    </article>
  );
}
