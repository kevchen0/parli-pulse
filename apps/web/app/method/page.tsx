import Link from 'next/link';
import { MIN_BALLOTS } from '@parli-pulse/speaks';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { currentSeason, seasonLabel } from '@/lib/season';
import { dbReady, getAgreement } from '@/lib/db';
import { E, Frac, Sub, Sup, Sqrt, Row, Op, N, V, Text } from '@/app/math';

export const metadata = { title: 'Method — Parli Pulse' };

export const revalidate = 300;

/**
 * How every number on the site is computed.
 *
 * Written for someone who wants to check the arithmetic rather than be
 * reassured about it. Symbols are defined where they first appear, constants
 * are the ones the pipeline actually uses, and the validation figures come
 * from a run that is reproducible with the commands named here.
 *
 * Not season-scoped: the methods do not change from year to year. The one
 * table that does is the agreement table, which reads the live season.
 */
export default async function MethodPage() {
  const season = currentSeason();
  const agreement = dbReady() ? await getAgreement(season) : [];
  const scored = agreement.some((r) => r.agree + r.differ + r.absent > 0);

  return (
    <main className="wrap method">
      <h1>Method</h1>
      <p className="lede">
        Methodology for recomputing the league&rsquo;s Article XXI points and our ratings
        and speaker figures.
      </p>

      <nav className="method-toc" aria-label="On this page">
        <a href="#points">1. Article XXI points</a>
        <a href="#rating">2. Rating</a>
        <a href="#speaks">3. Speaker points</a>
      </nav>

      {/* ------------------------------------------------------------ points */}
      <section id="points">
        <h2>1. Article XXI points</h2>

        <p>
          Every figure is derived from Tabroom&rsquo;s round data through an implementation
          of Article XXI of the NPDL League Rules, found{' '}
          <a href="https://docs.google.com/document/d/1xv6klxK9PQPPyAaeJ9Gh9-CGL-nvikRjRAsDTiRYZtw/view">here</a>.
        </p>

        <h3>Season total</h3>
        <p>
          A partnership&rsquo;s season total (XXI.7) is its best five tournaments, weighted:
        </p>

        <div className="eqn">
          <E block>
            <Sub><V>T</V><Text>season</Text></Sub>
            <Op>=</Op>
            <Row>
              <Sub><V>w</V><V>i</V></Sub><Sub><V>p</V><Row><Op>(</Op><V>i</V><Op>)</Op></Row></Sub>
            </Row>
            <Op>,</Op>
            <Row>
              <V>w</V><Op>=</Op><Op>(</Op><N>1.0</N><Op>,</Op><N>0.9</N><Op>,</Op>
              <N>0.6</N><Op>,</Op><N>0.3</N><Op>,</Op><N>0.1</N><Op>)</Op>
            </Row>
          </E>
        </div>
        <p className="defn">
          <Sub><V>p</V><Row><Op>(</Op><V>i</V><Op>)</Op></Row></Sub> is the{' '}
          <V>i</V>-th largest single-tournament score. Individual totals (XXI.8) use the
          same weights over a debater&rsquo;s own results across every partner. School
          totals (XXI.9) sum unweighted team points, with a hybrid partnership counting
          half to each school.
        </p>

        <h3>Agreement with the league&rsquo;s sheet</h3>
        <p>
          The league publishes its own official points figures{' '}
          <a href="https://www.parliamentarydebate.org/rankings">here</a>. Due to Tabroom tournaments not publishing results,
          differing interpretations of rules, and figures the league enters by hand, our
          points often disagree with the league&rsquo;s sheet. Our agreement rates on
          per-entry results, partnership season totals and the league&rsquo;s top 100 are
          shown below.
        </p>

        {scored ? (
          <div className="tablewrap">
            <table className="agree">
              <thead>
                <tr>
                  <th>Comparison</th>
                  <th className="num">Agree</th>
                  <th className="num">Differ</th>
                  <th className="num">Absent</th>
                  <th className="num">Rate</th>
                </tr>
              </thead>
              <tbody>
                {agreement.map((r) => {
                  const scoredRows = r.agree + r.differ;
                  return (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{r.agree.toLocaleString()}</td>
                      <td className="num">{r.differ.toLocaleString()}</td>
                      <td className="num">{r.absent.toLocaleString()}</td>
                      <td className="num pts">
                        {scoredRows > 0 ? `${((100 * r.agree) / scoredRows).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            Nothing to compare yet for {seasonLabel(season)}. The table fills once the
            league scores its first tournament of the season and publishes the sheet
            against which these figures are checked.
          </p>
        )}

        <p className="defn">
          Rate is agree ÷ (agree + differ). Absent rows in our ranking are counted
          separately.
        </p>

        <h3 id="supplied">What still comes from the sheet</h3>
        <p>
          Two figures are taken from the league rather than computed, because Tabroom does
          not carry them. <b>State-qualifier placements</b>, which XXI.4.C scores at 8 for a
          qualifier and 4 for an alternate: a placement is not a bracket position and
          appears nowhere in a payload. And a <b>prelim-only fallback</b> for tournaments
          that published no pairings, scored from the league&rsquo;s own recorded result.
          Together they are under 6% of scoring entries.
        </p>
      </section>

      {/* ------------------------------------------------------------ rating */}
      <section id="rating">
        <h2>2. Rating</h2>
        <p>
          Our rating uses Glicko-2 over partnerships, with one rating period per tournament.
          Each round within a period is rated against the ratings from the start of it.
        </p>

        <h3 id="why">Why Glicko-2</h3>
        <p>
          A partnership has a rating <V>r</V> and a deviation <V>RD</V> that estimates how
          tight <V>r</V> is. This deviation solves two problems other rating systems have.
        </p>
        <ul className="plain">
          <li>
            <b>It widens while a partnership is inactive.</b> Every week that a team does
            not attend a tournament, ratings hold but deviation grows. This prevents camping
            with a few good tournaments early in the season.
          </li>
          <li>
            <b>It controls how much a result affects the rating.</b> Each change is
            proportional to the uncertainty of each team. For example, a victory over a
            consistent opponent while your deviation is high improves you vastly while
            barely affecting the other.
          </li>
        </ul>
        <p>
          Both of these factors are relevant since nearly half of all partnerships debate
          under ten open rounds. A system that does not measure deviation therefore loses
          accuracy: Elo loses 2.8 points of it, in{' '}
          <a href="#validation">the comparison below</a>.
        </p>
        <p className="defn" id="standard">
          Mark Glickman,{' '}
          <a href="https://www.glicko.net/glicko/glicko2.pdf">
            Example of the Glicko-2 system
          </a>{' '}
          (PDF). We use the paper&rsquo;s default constants, except <V>τ</V> = 0.4, which
          the paper leaves to the implementer and recommends between 0.3 and 1.2. Deviation
          is capped at a maximum of 350.
        </p>

        <h3 id="departures">Our edits for Glicko-2</h3>
        <p>
          We made 4 edits to the Glicko-2 system so it can be better implemented.
        </p>

        <h4>1. A round scores by how the panel split</h4>
        <p>
          Glicko-2 takes a score in {'{'}0, ½, 1{'}'}. Since split panels indicate a
          different level of confidence than a round win, score <V>s</V> is calculated with{' '}
          <V>w</V> ballots won of <V>n</V> in:
        </p>
        <div className="eqn">
          <E block>
            <V>s</V><Op>=</Op><Frac><N>1</N><N>2</N></Frac><Op>+</Op>
            <Frac><Row><N>2</N><V>w</V><Op>−</Op><V>n</V></Row><Row><N>2</N><V>n</V></Row></Frac>
          </E>
        </div>
        <p className="defn">
          A 3&ndash;0 scores 1, a 2&ndash;1 scores 0.667, and a single-judge win scores 1.
        </p>

        <h4>2. Side skew is accounted for in the expectation</h4>
        <p>
          Wins are skewed ~52% opposition in open rounds. With <V>p</V>, the proposition
          win rate:
        </p>
        <div className="eqn">
          <E block>
            <V>h</V><Op>=</Op><N>173.7178</N><Op>·</Op><Text>ln</Text>
            <Op>(</Op><Frac><V>p</V><Row><N>1</N><Op>−</Op><V>p</V></Row></Frac><Op>)</Op>
          </E>
        </div>
        <p className="defn">
          About &minus;17 rating points to proposition for 2025-26, estimated from the
          season each run. It is only counted in the expectation and never in the stored
          rating.
        </p>

        <h4>3. The deviation grows with elapsed time, not periods missed</h4>
        <div className="eqn">
          <E block>
            <Sup><V>φ</V><Op>∗</Op></Sup>
            <Op>=</Op>
            <Sqrt>
              <Sup><V>φ</V><N>2</N></Sup><Op>+</Op>
              <Sup><V>σ</V><N>2</N></Sup><V>t</V>
            </Sqrt>
          </E>
        </div>
        <p className="defn">
          We define <V>t</V> here as the gap in periods as a fraction, because three
          tournaments can happen on one weekend, which would count a team attending one of
          these tournaments as missing two periods.
        </p>

        <h4>4. A new partnership&rsquo;s rating depends on its debaters</h4>
        <p>
          A new pairing is seeded from the ratings its two debaters already have rather than
          at 1500, with the deviation widened to 180 for the fact that it is a new
          partnership.
        </p>

        <h3 id="shrink">Established: shrinking to the field</h3>
        <p>
          Ranking and prediction need different numbers. The board is ordered on the rating
          pulled toward the field average in proportion to its deviation, so a rating built
          on few rounds sits closer to the middle of the field than one built on many.
        </p>
        <p>
          We first estimate the spread of true strengths. Observed spread is true spread
          plus measurement noise, so subtracting the mean squared deviation recovers it:
        </p>
        <div className="eqn">
          <E block>
            <Sub><V>τ</V><V>F</V></Sub><Op>=</Op>
            <Sqrt>
              <Text>Var</Text><Op>(</Op><V>r</V><Op>)</Op><Op>−</Op>
              <Text>mean</Text><Op>(</Op><Sup><V>RD</V><N>2</N></Sup><Op>)</Op>
            </Sqrt>
          </E>
        </div>
        <p>
          Each rating is then pulled toward 1500 by the share of it that is measured:
        </p>
        <div className="eqn">
          <E block>
            <Sub><V>r</V><Text>est</Text></Sub><Op>=</Op><N>1500</N><Op>+</Op>
            <Op>(</Op><V>r</V><Op>−</Op><N>1500</N><Op>)</Op><Op>·</Op>
            <Frac>
              <Sup><Sub><V>τ</V><V>F</V></Sub><N>2</N></Sup>
              <Row><Sup><Sub><V>τ</V><V>F</V></Sub><N>2</N></Sup><Op>+</Op><Sup><V>RD</V><N>2</N></Sup></Row>
            </Frac>
          </E>
        </div>
        <p className="defn">
          The second factor is the share of a rating retained: near 1 when <V>RD</V> is
          small, near 0 when it is large. <Sub><V>τ</V><V>F</V></Sub> is measured from the
          field each run and was about 117 rating points for 2025-26. It is floored at 5% of
          the observed variance, since a field with more noise than signal would return a
          negative variance.
        </p>
        <p>
          Predictions use <V>r</V> rather than <Sub><V>r</V><Text>est</Text></Sub>:
        </p>
        <div className="eqn">
          <E block>
            <V>P</V><Op>(</Op><V>A</V><Op>)</Op><Op>=</Op>
            <Frac>
              <N>1</N>
              <Row>
                <N>1</N><Op>+</Op><Text>exp</Text><Op>(</Op><Op>−</Op>
                <V>g</V><Op>(</Op><Sqrt><Sup><Sub><V>φ</V><V>A</V></Sub><N>2</N></Sup><Op>+</Op><Sup><Sub><V>φ</V><V>B</V></Sub><N>2</N></Sup></Sqrt><Op>)</Op>
                <Op>(</Op><Sub><V>μ</V><V>A</V></Sub><Op>−</Op><Sub><V>μ</V><V>B</V></Sub><Op>+</Op><V>h</V><Op>)</Op><Op>)</Op>
              </Row>
            </Frac>
          </E>
        </div>
        <p className="defn">
          Both deviations widen the result toward 0.5. Shrinking before predicting scores
          worse than not shrinking at all, 62.6% against 63.4%, because the win probability
          already accounts for both deviations and shrinking the estimate counts them twice.
        </p>

        <h3 id="validation">Validation</h3>
        <p>
          We split the season by date into three parts, and each part does one job.
        </p>
        <ul className="plain">
          <li>
            <b>Through December</b> fits parameters. Every constant each model needs is
            estimated on these tournaments and on no others.
          </li>
          <li>
            <b>January</b> selects between variants. Where a choice existed, such as how
            much a split panel counts or how wide a new partnership starts, it was made on
            these rounds.
          </li>
          <li>
            <b>February onward</b> measures the result, and is used once, after every
            parameter and every choice is fixed.
          </li>
        </ul>
        <p>
          January exists because selecting a variant on the same rounds that report the
          result would report a tuning exercise as a validation.
        </p>
        <p>
          Every model walks forward through the season: it predicts a tournament, observes
          it, then predicts the next. Each baseline is given a fitted logistic on its own
          statistic, so each is compared at its best rather than at a convenient setting.
        </p>
        <p className="defn">
          Held out: 2,209 rounds from 1 February 2026.
        </p>
        <div className="tablewrap">
          <table className="agree">
            <thead>
              <tr>
                <th>Model</th>
                <th className="num">Accuracy</th>
                <th className="num">Log loss</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Coin flip</td><td className="num">50.0%</td><td className="num">0.6931</td></tr>
              <tr><td>Side only</td><td className="num">50.7%</td><td className="num">0.6915</td></tr>
              <tr><td>Article XXI points to date</td><td className="num">59.7%</td><td className="num">0.6686</td></tr>
              <tr><td>Season win rate to date</td><td className="num">60.0%</td><td className="num">0.6543</td></tr>
              <tr><td>Elo</td><td className="num">60.6%</td><td className="num">0.6559</td></tr>
              <tr><td>Bradley-Terry on pairs</td><td className="num">61.2%</td><td className="num">0.6505</td></tr>
              <tr className="pick"><td><b>Glicko-2</b></td><td className="num"><b>63.4%</b></td><td className="num"><b>0.6380</b></td></tr>
              <tr><td>Bradley-Terry on people</td><td className="num">64.5%</td><td className="num">0.6290</td></tr>
            </tbody>
          </table>
        </div>
        <p className="defn">
          Accuracy over the league&rsquo;s ranking is 3.7 points higher, 95% interval 1.2 to
          6.1 on a paired bootstrap. The log loss gap of 0.031 is the more reliable figure
          and did not reverse in two thousand resamples.
        </p>
        <p>
          Elo differs from Glicko-2 only in carrying no deviation, and scores 2.8 points
          lower. Season win rate scores close to Article XXI points at a lower log loss, so
          points measure strength largely by proxying for wins rather than by accounting for
          opponents.
        </p>
        <p>
          Bradley-Terry on people scores highest and is not what we use. It rates individual
          debaters and scores a partnership as the sum of its two, which assumes strength is
          additive: it would assign a rating to a pairing that has never debated together,
          and it cannot represent two debaters who are better together than apart. For a
          board whose unit is the partnership, we accept the lower figure.
        </p>
        <p>
          Partnerships below {MIN_RATED_ROUNDS} rated rounds keep a rating and a deviation
          but are not ranked. We apply no elimination-round multiplier and no field-size
          weighting: elimination opponents average 53% more season points, so an
          opponent-adjusted rating already awards more for beating them.
        </p>

        <h3 id="limits">Known limitation</h3>
        <p>
          A rating is only comparable across teams that results connect. Deviation measures
          how many rounds a partnership has debated, not how many opponents link it to the
          rest of the field, so a partnership that debates often inside one region is
          treated as well measured even when it has rarely met teams outside it. If that
          region&rsquo;s overall strength differs from the league&rsquo;s, its ratings are
          shifted with it, and nothing in the system detects this.
        </p>
        <p>
          For 2025-26 we measure no such effect: among partnerships with forty rounds or
          more, the shrinkage applied is flat across in-region share. That is not evidence
          the problem is absent, only that this season does not show it. Measuring it
          properly would require more cross-region results than the league currently
          produces.
        </p>
      </section>

      {/* ------------------------------------------------------------ speaks */}
      <section id="speaks">
        <h2>3. Speaker points</h2>
        <p>
          Judges differ in how generously they score, and panels differ by two points and
          more, so a raw season average depends heavily on which judges a debater drew. We
          normalize each ballot against the judge who awarded it.
        </p>

        <h3>Per ballot</h3>
        <p>
          With <V>x</V> the raw score, <Sub><V>m</V><V>j</V></Sub> the centre of judge{' '}
          <V>j</V>&rsquo;s scores and <Sub><V>s</V><V>j</V></Sub> their spread:
        </p>
        <div className="eqn">
          <E block>
            <V>z</V><Op>=</Op>
            <Frac>
              <Row><V>x</V><Op>−</Op><Sub><V>m</V><V>j</V></Sub></Row>
              <Sub><V>s</V><V>j</V></Sub>
            </Frac>
          </E>
        </div>
        <p className="defn">
          The centre is a median and the spread is a winsorized standard deviation. Both are
          robust to outliers: a mean with a plain standard deviation would let one unusually
          low score widen a judge&rsquo;s spread and compress every other debater that judge
          scored. The spread is floored at 0.35, so a judge who gave nearly identical scores
          does not divide by close to zero.
        </p>

        <h3>Judges with few ballots</h3>
        <p>
          A median over four ballots carries little information, so we shrink both the
          centre and the spread toward the pool by the judge&rsquo;s sample size:
        </p>
        <div className="eqn">
          <E block>
            <Sub><V>s</V><V>j</V></Sub><Op>=</Op>
            <Text>max</Text><Op>(</Op><N>0.35</N><Op>,</Op>
            <V>w</V><Sub><V>s</V><Text>judge</Text></Sub><Op>+</Op>
            <Op>(</Op><N>1</N><Op>−</Op><V>w</V><Op>)</Op><Sub><V>s</V><Text>pool</Text></Sub><Op>)</Op>
          </E>
        </div>
        <p className="defn">
          <V>w</V> rises with the judge&rsquo;s ballot count. Where a judge has too few
          ballots across the season we fall back to their ballots at that tournament, and
          then to the event pool.
        </p>

        <h3>Per debater</h3>
        <p>
          We compute one <V>z</V> per ballot and take the mean of a debater&rsquo;s own:
        </p>
        <div className="eqn">
          <E block>
            <Sub><V>z</V><Text>debater</Text></Sub><Op>=</Op>
            <Frac><N>1</N><V>n</V></Frac>
            <Row><Op>∑</Op><Sub><V>z</V><V>k</V></Sub></Row>
            <Op>,</Op>
            <Text>CI</Text><Op>=</Op><N>1.96</N>
            <Frac><V>s</V><Sqrt><V>n</V></Sqrt></Frac>
          </E>
        </div>
        <p className="defn">
          Each ballot is compared to the judge who gave it, so a season figure averages
          across many standards rather than one. Ranked figures rest on 19 to 71 distinct
          judges each. <Text>CI</Text> is the 95% confidence interval on the mean, and is
          the ± shown beside every figure. Debaters with fewer than {MIN_BALLOTS} ballots
          keep every score and are not ranked.
        </p>

        <h3>Scale</h3>
        <p>
          Each league&rsquo;s scale is stored in a configuration table rather than inferred
          from its scores. Most events run 25&ndash;30, NYPDL runs 23&ndash;30, and YFL 1
          runs 0&ndash;100. Inferring a scale from the lowest observed score misclassifies
          most events, since a single unusually low score on a 25&ndash;30 scale would read
          as a wider scale.
        </p>
        <p>
          Scores of exactly 0 are forfeit records and are excluded. Scores from 1 to 22 on a
          25&ndash;30 scale are held for review rather than normalized. The displayed figure
          is rescaled onto a 25&ndash;30 band centred at 27.5. Raw, <V>z</V> and display
          values are stored separately, and the raw value is never overwritten.
        </p>
        <p className="defn">
          No view on this site ranks debaters from the bottom. See{' '}
          <Link href="/privacy">Privacy</Link>.
        </p>
      </section>

      <p className="backlink">
        Found something wrong? <Link href="/feedback">Please say so</Link>.
      </p>
    </main>
  );
}
