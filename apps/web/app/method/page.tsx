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
        Three kinds of number appear on this site. Article XXI points are the league&rsquo;s,
        recomputed here so they can be checked. The rating and the speaker figures are ours.
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
          of Article XXI. Nothing is copied from the league&rsquo;s spreadsheet except the
          six inputs listed under <a href="#supplied">what the sheet supplies</a>.
        </p>

        <h3>Order of evaluation</h3>
        <ol className="split">
          <li>
            <b>Tournament eligibility</b> (XXI.1). Open division, invitational or named in
            XXI.4, at least 5 schools, 10 teams and 3 preliminary rounds. June, July,
            August and 24 December to 2 January are excluded.
          </li>
          <li>
            <b>Field sizes</b> (XXI.2.A&ndash;B). The open field is the entries in the open
            division less those that forfeited. Adjusted field size is the open field{' '}
            <em>plus</em> novice and JV. The elimination field counts distinct entries
            appearing in any elimination section, not <E><V>sections</V><Op>×</Op><N>2</N></E>,
            because a bye is a one-team section.
          </li>
          <li>
            <b>Base points.</b> Breaking teams read the elimination points table at the row
            for their adjusted field size and the column for the highest elimination level
            reached, taken from the section count. Non-breaking teams read XXI.3.A by
            record.
          </li>
          <li>
            <b>The points floor</b> (XXI.3.B) lifts the <em>base</em>, not the total.
          </li>
          <li>
            <b>Adjustments</b> apply on top: preliminary count (XXI.2.E), break percentage
            (XXI.2.D), walkovers and closeouts (XXI.5.C).
          </li>
          <li>
            <b>Season total</b> (XXI.7). The best five tournaments, weighted:
          </li>
        </ol>

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
          The league publishes its own figures, and every one of ours is compared against
          them result by result. Three counts rather than one rate, because they fail for
          unrelated reasons: a <b>differing</b> figure is a rule read differently or a
          number the league entered by hand, while an <b>absent</b> one is a result we
          could not score at all.
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
          Rate is agree ÷ (agree + differ): agreement among the results we produced a figure
          for. Absent rows are counted separately rather than folded in, since they measure
          coverage rather than correctness.
        </p>

        <h3 id="supplied">What the sheet supplies</h3>
        <p>
          Six things, of which two are numbers. Which tournaments exist (the Results column
          of the Tournaments tab); which schools are league members; canonical school names
          and regions; each tournament&rsquo;s category, which selects the scoring schedule
          and the speaker scale; which school a result is credited to, where a team entered
          under a club registration; and the second school of a hybrid entry.
        </p>
        <p>
          The two numbers are state-qualifier placements, which XXI.4.C scores at 8 for a
          qualifier and 4 for an alternate and which appear nowhere in a payload, and a
          prelim-only fallback for tournaments that published no pairings. Together they
          are under 6% of scoring entries. Setting <code>SOURCE=sheet</code> restores the
          league&rsquo;s own field sizes and adjustments, which raises agreement by about
          two points and is what the backtests use to isolate the scoring rules.
        </p>
      </section>

      {/* ------------------------------------------------------------ rating */}
      <section id="rating">
        <h2>2. Rating</h2>
        <p>
          Glicko-2 over partnerships, one rating period per tournament, every round inside
          a period judged against the ratings held before it began. Ours, and unrelated to
          Article XXI.
        </p>

        <h3 id="why">Why Glicko-2</h3>
        <p>
          A partnership carries a rating <V>r</V> and a deviation <V>φ</V> measuring how
          well that rating is known. Two properties decide the choice.
        </p>
        <ul className="plain">
          <li>
            <b>The deviation widens with time away.</b> Between periods, with no result to
            learn from, the rating holds and only the deviation moves:
          </li>
        </ul>
        <div className="eqn">
          <E block>
            <Sup><V>φ</V><Op>∗</Op></Sup>
            <Op>=</Op>
            <Sqrt>
              <Sup><V>φ</V><N>2</N></Sup><Op>+</Op>
              <Sup><V>σ</V><N>2</N></Sup><Op>·</Op><V>t</V>
            </Sqrt>
          </E>
        </div>
        <p className="defn">
          <V>σ</V> is the volatility and <V>t</V> the elapsed time, carried as a fraction
          rather than a count of tournaments missed &mdash; three tournaments can share one
          weekend, and a partnership that has not competed since October is not the
          partnership last seen. A rating without a deviation cannot express this.
        </p>
        <ul className="plain">
          <li>
            <b>A result moves an uncertain rating further.</b> The update is inversely
            weighted by how well each side is already known, so beating a settled opponent
            with a thin rating of your own moves you a long way, and the reverse barely
            moves them.
          </li>
        </ul>

        <h3 id="update">The update</h3>
        <p>
          Ratings are converted to the Glicko-2 scale, updated, and converted back.
          With <Sub><V>μ</V><V>i</V></Sub> and <Sub><V>φ</V><V>i</V></Sub> the opponent&rsquo;s
          converted rating and deviation:
        </p>
        <div className="eqn">
          <E block>
            <V>μ</V><Op>=</Op><Frac><Row><V>r</V><Op>−</Op><N>1500</N></Row><N>173.7178</N></Frac>
            <Op>,</Op>
            <V>φ</V><Op>=</Op><Frac><V>RD</V><N>173.7178</N></Frac>
          </E>
          <E block>
            <V>g</V><Op>(</Op><V>φ</V><Op>)</Op><Op>=</Op>
            <Frac>
              <N>1</N>
              <Sqrt><N>1</N><Op>+</Op><Frac><Row><N>3</N><Sup><V>φ</V><N>2</N></Sup></Row><Sup><V>π</V><N>2</N></Sup></Frac></Sqrt>
            </Frac>
          </E>
          <E block>
            <V>E</V><Op>=</Op>
            <Frac>
              <N>1</N>
              <Row>
                <N>1</N><Op>+</Op><Text>exp</Text>
                <Op>(</Op><Op>−</Op><V>g</V><Op>(</Op><Sub><V>φ</V><V>i</V></Sub><Op>)</Op>
                <Op>(</Op><V>μ</V><Op>−</Op><Sub><V>μ</V><V>i</V></Sub><Op>+</Op><V>h</V><Op>)</Op><Op>)</Op>
              </Row>
            </Frac>
          </E>
        </div>
        <p className="defn">
          <V>g</V> discounts an opponent in proportion to their own uncertainty: beating a
          team nobody has measured says less than beating a team everyone has.{' '}
          <V>h</V> is the side correction below, applied inside <V>E</V> only, so drawing
          more opposition rounds cannot raise a rating.
        </p>
        <div className="eqn">
          <E block>
            <V>v</V><Op>=</Op>
            <Sup>
              <Row><Op>[</Op><Row><Sup><V>g</V><N>2</N></Sup><V>E</V><Op>(</Op><N>1</N><Op>−</Op><V>E</V><Op>)</Op></Row><Op>]</Op></Row>
              <Row><Op>−</Op><N>1</N></Row>
            </Sup>
            <Op>,</Op>
            <V>Δ</V><Op>=</Op><V>v</V><Row><V>g</V><Op>(</Op><Sub><V>s</V><V>i</V></Sub><Op>−</Op><V>E</V><Op>)</Op></Row>
          </E>
          <E block>
            <Sup><V>φ</V><Op>′</Op></Sup><Op>=</Op>
            <Sup>
              <Row><Op>(</Op><Frac><N>1</N><Sup><Row><Op>(</Op><Sup><V>φ</V><Op>∗</Op></Sup><Op>)</Op></Row><N>2</N></Sup></Frac><Op>+</Op><Frac><N>1</N><V>v</V></Frac><Op>)</Op></Row>
              <Row><Op>−</Op><N>1</N><Op>/</Op><N>2</N></Row>
            </Sup>
            <Op>,</Op>
            <Sup><V>μ</V><Op>′</Op></Sup><Op>=</Op><V>μ</V><Op>+</Op>
            <Sup><Row><Op>(</Op><Sup><V>φ</V><Op>′</Op></Sup><Op>)</Op></Row><N>2</N></Sup>
            <Row><Op>·</Op><Op>∑</Op><V>g</V><Op>(</Op><Sub><V>s</V><V>i</V></Sub><Op>−</Op><V>E</V><Op>)</Op></Row>
          </E>
        </div>
        <p className="defn">
          <V>v</V> is the variance of the rating estimate given this period&rsquo;s
          opponents, and <V>Δ</V> the improvement the results suggest. The volatility{' '}
          <V>σ</V> is solved by the Illinois iteration from Glickman&rsquo;s paper, with{' '}
          <V>τ</V> = 0.4. <V>τ</V> was swept and moves nothing at four decimal places: with
          periods one tournament long the volatility has no time to change.
        </p>

        <h3 id="score">What a round scores</h3>
        <p>
          <Sub><V>s</V><V>i</V></Sub> is graded by how the panel split rather than being
          1 or 0. With <V>w</V> ballots won of <V>n</V>:
        </p>
        <div className="eqn">
          <E block>
            <V>s</V><Op>=</Op><Frac><N>1</N><N>2</N></Frac><Op>+</Op>
            <Frac><Row><N>2</N><V>w</V><Op>−</Op><V>n</V></Row><Row><N>2</N><V>n</V></Row></Frac>
          </E>
        </div>
        <p className="defn">
          A 3&ndash;0 scores 1, a 2&ndash;1 scores 0.667, a single-judge round scores 1.
          Worth 0.0015 of log loss, measured on the January split.
        </p>

        <h3 id="side">Side</h3>
        <p>
          Opposition takes about 52% of decided open rounds. Left uncorrected that is
          credited to skill. With <V>p</V> the proposition win rate over decided rounds:
        </p>
        <div className="eqn">
          <E block>
            <V>h</V><Op>=</Op><N>173.7178</N><Op>·</Op><Text>ln</Text>
            <Op>(</Op><Frac><V>p</V><Row><N>1</N><Op>−</Op><V>p</V></Row></Frac><Op>)</Op>
          </E>
        </div>
        <p className="defn">
          About &minus;17 rating points to proposition on 2025-26. Estimated from the
          season rather than fixed, and re-estimated each run.
        </p>

        <h3 id="prior">A new partnership&rsquo;s prior</h3>
        <p>
          A new pairing starts from its debaters&rsquo; existing ratings rather than at
          1500, with the deviation widened for the fact that a pairing is a new thing.
          This is the single largest departure from stock Glicko-2, worth 0.008 of log
          loss, five times the other two adjustments together, and the only lever that
          addresses sparsity: nearly half of partnerships debate fewer than ten open rounds
          in a season.
        </p>
        <p className="defn">
          The deviation of the seeded pair is never narrower than that of the ratings it
          came from. Combining two independent estimates of one quantity would narrow it;
          a partnership is not the mean of its debaters, it only tends to be. Two debaters
          nobody has seen produce a partnership nobody has seen, at{' '}
          <V>RD</V> = 350.
        </p>

        <h3 id="shrink">Established: shrinking to the field</h3>
        <p>
          The board is ordered on the rating pulled toward the field average in proportion
          to its deviation. First the spread of true strengths, by method of moments &mdash;
          observed spread is true spread plus measurement noise:
        </p>
        <div className="eqn">
          <E block>
            <Sub><V>τ</V><V>F</V></Sub><Op>=</Op>
            <Sqrt>
              <Text>Var</Text><Op>(</Op><V>r</V><Op>)</Op><Op>−</Op>
              <Text>mean</Text><Op>(</Op><Sup><V>RD</V><N>2</N></Sup><Op>)</Op>
            </Sqrt>
          </E>
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
          small, near 0 when it is large. Nothing here is tuned &mdash;{' '}
          <Sub><V>τ</V><V>F</V></Sub> is measured from the field each run, and was about
          117 rating points on 2025-26. Floored at 5% of the observed variance, since a
          field with more noise than signal would otherwise ask for a negative variance.
        </p>
        <p>
          Ranking uses <Sub><V>r</V><Text>est</Text></Sub> and prediction uses <V>r</V>.
          Shrinking before predicting is worse than not shrinking at all, because the win
          probability already widens by both deviations and shrinking the estimate counts
          the same uncertainty twice.
        </p>
        <div className="eqn">
          <E block>
            <V>P</V><Op>(</Op><V>A</V><Op>)</Op><Op>=</Op>
            <Frac>
              <N>1</N>
              <Row>
                <N>1</N><Op>+</Op><Text>exp</Text><Op>(</Op><Op>−</Op>
                <V>g</V><Op>(</Op><Sqrt><Sup><Sub><V>φ</V><V>A</V></Sub><N>2</N></Sup><Op>+</Op><Sup><Sub><V>φ</V><V>B</V></Sub><N>2</N></Sup></Sqrt><Op>)</Op>
                <Op>(</Op><Sub><V>μ</V><V>A</V></Sub><Op>−</Op><Sub><V>μ</V><V>B</V></Sub><Op>)</Op><Op>)</Op>
              </Row>
            </Frac>
          </E>
        </div>

        <h3 id="validation">Does it earn its place</h3>
        <p>
          The commitment was to publish the comparison either way. The season is cut three
          ways: training through December fits parameters, January chooses between
          variants, and February onward is touched once. Every model walks forward &mdash;
          predict a tournament, then learn from it &mdash; and each baseline gets a fitted
          logistic on its own statistic, so the comparison is against the best version of
          each rather than a straw one.
        </p>
        <p className="defn">
          Held out: 2,209 rounds from 1 February 2026. Reproduce with{' '}
          <code>npm run validate:rating</code>.
        </p>
        <div className="tablewrap">
          <table className="agree">
            <thead>
              <tr>
                <th>Model</th>
                <th className="num">Accuracy</th>
                <th className="num">Log loss</th>
                <th className="num">Brier</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Coin flip</td><td className="num">50.0%</td><td className="num">0.6931</td><td className="num">0.2500</td></tr>
              <tr><td>Side only</td><td className="num">50.7%</td><td className="num">0.6915</td><td className="num">0.2492</td></tr>
              <tr><td>Article XXI points to date</td><td className="num">59.7%</td><td className="num">0.6686</td><td className="num">0.2370</td></tr>
              <tr><td>Season win rate to date</td><td className="num">60.0%</td><td className="num">0.6543</td><td className="num">0.2313</td></tr>
              <tr><td>Elo, K swept to 48</td><td className="num">60.6%</td><td className="num">0.6559</td><td className="num">0.2319</td></tr>
              <tr><td>Bradley-Terry on pairs</td><td className="num">61.2%</td><td className="num">0.6505</td><td className="num">0.2296</td></tr>
              <tr><td>Glicko-2, shrunk</td><td className="num">62.6%</td><td className="num">0.6638</td><td className="num">0.2356</td></tr>
              <tr className="pick"><td><b>Glicko-2</b></td><td className="num"><b>63.4%</b></td><td className="num"><b>0.6380</b></td><td className="num"><b>0.2235</b></td></tr>
              <tr><td>Bradley-Terry on people</td><td className="num">64.5%</td><td className="num">0.6290</td><td className="num">0.2198</td></tr>
            </tbody>
          </table>
        </div>
        <p className="defn">
          Accuracy gap over the league&rsquo;s ranking is 3.7 points, 95% interval 1.2 to
          6.1 on a paired bootstrap. The log loss gap of 0.031 is the surer finding and
          never reversed in two thousand resamples.
        </p>
        <p>
          Three results worth reading off the table. <b>Elo costs 2.8 points of accuracy</b>{' '}
          against Glicko-2, which is what the deviation buys: Elo cannot widen a rating for
          a partnership that has not competed since October, and moves a settled rating and
          a new one equally. <b>Season win rate nearly matches Article XXI points</b> and is
          better calibrated, so points buy their accuracy mostly by proxying for winning
          rather than by knowing who was beaten. <b>Bradley-Terry on people predicts
          best</b> and is not what ships: it scores a partnership as the sum of its two
          debaters, so it assumes strength is additive and will rate a pairing that never
          debated a round. For a board whose unit is the partnership, that is the wrong
          measure however well it fits.
        </p>
        <p>
          Partnerships below {MIN_RATED_ROUNDS} rated rounds keep a rating and a deviation
          and are not ranked. No elimination-round multiplier and no field-size weighting:
          elimination opponents average 53% more season points, so an opponent-adjusted
          rating already pays more for beating them, and a multiplier would count that
          twice.
        </p>
        <p className="defn">
          <b>A limitation, stated rather than papered over.</b> Shrinkage discounts thin
          evidence, not isolated evidence. Evidence is counted in rounds, not in
          connections, so a well-measured partnership inside a pool that never plays
          outside itself keeps its rating and nothing warns anyone. On 2025-26 no such
          effect is visible &mdash; among partnerships with forty rounds or more the
          shrinkage applied is flat across in-region share &mdash; but detecting one would
          need cross-pool results the league does not generate.
        </p>
      </section>

      {/* ------------------------------------------------------------ speaks */}
      <section id="speaks">
        <h2>3. Speaker points</h2>
        <p>
          A raw speaker score measures the judge as much as the debater: panels differ by
          two points and more, so a season average depends heavily on the draw. Each ballot
          is measured against the judge who awarded it.
        </p>

        <h3>Per ballot</h3>
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
          <V>x</V> is the raw score, <Sub><V>m</V><V>j</V></Sub> the centre of judge{' '}
          <V>j</V>&rsquo;s scores and <Sub><V>s</V><V>j</V></Sub> their spread. Centre is a{' '}
          <b>median</b> and spread a <b>winsorized standard deviation</b> rather than a mean
          and a plain SD. A sub-scale score is usually a conduct sanction under Article XIV;
          it is real and stays in the record, but one of them must not stretch a
          judge&rsquo;s spread and quietly compress everyone else that judge ranked. Spread
          is floored at 0.35 so a judge who gave nearly identical scores cannot divide by
          almost nothing.
        </p>

        <h3>Judges with few ballots</h3>
        <p>
          A median over four ballots is noise, so a judge&rsquo;s centre and spread are both
          shrunk toward the pool by sample size:
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
          <V>w</V> rises with the judge&rsquo;s ballot count. The fallback chain is
          judge-season, then judge-tournament, then the event pool.
        </p>

        <h3>Per debater</h3>
        <p>
          One <V>z</V> per ballot, then the mean of a debater&rsquo;s own:
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
          Averaging the z-scores rather than z-scoring the average is the point: each ballot
          is compared to the judge who gave it, so the season figure averages across many
          standards. The top figures rest on 19 to 71 distinct judges apiece. Debaters with
          fewer than {MIN_BALLOTS} ballots keep every score and are not ranked.
        </p>

        <h3>Scale</h3>
        <p>
          Scale comes from a configuration table per league, never inferred from the
          observed minimum. The convention is 25&ndash;30; NYPDL runs 23&ndash;30 and YFL 1
          runs 0&ndash;100. Inferring from the minimum misclassifies most events, because a
          lone punitive 24 is not a scale. Scores of exactly 0 are forfeit sentinels and are
          excluded; scores from 1 to 22 on a 25&ndash;30 scale go to review rather than into
          the arithmetic. The displayed figure is rescaled onto a 25&ndash;30 band centred at
          27.5; raw, <V>z</V> and display are stored separately and raw is never overwritten.
        </p>
        <p className="defn">
          There is no lowest-speaks view, no punitive flag and nothing that identifies who
          received a sanction. See <Link href="/privacy">Privacy</Link>.
        </p>
      </section>

      <p className="backlink">
        Found something wrong? <Link href="/feedback">Please say so</Link>.
      </p>
    </main>
  );
}
