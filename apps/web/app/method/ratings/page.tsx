import Link from 'next/link';
import { MIN_RATED_ROUNDS } from '@parli-pulse/rating';
import { seasonHref, seasonLabel } from '@/lib/season';
import { dbReady, getRatingMethodFigures, latestRatedSeason } from '@/lib/db';

export const metadata = { title: 'How the rating works — Parli Pulse' };

export const revalidate = 300;

const n0 = (x: number) => Math.round(x).toLocaleString();

/**
 * The rating specification.
 *
 * Written for a reader who wants to check the method, not be reassured about
 * it: every transformation between a ballot and a ranked number is here, with
 * the equation that performs it. Parameters are read from the data rather than
 * typed into the prose, so the spec cannot drift from the pipeline.
 *
 * Not under a season, because the method is not a season's. It sat at
 * /<season>/method/ratings and read as though 2025-26 had a rating scheme of
 * its own. The measured parameters still have to come from somewhere, so they
 * come from the most recent season that has been rated and the page says which
 * one that is.
 */
export default async function RatingMethodPage() {
  const season = dbReady() ? await latestRatedSeason() : null;
  const f = season ? await getRatingMethodFigures(season) : null;

  return (
    <main className="wrap method">
      <h1>How the rating works</h1>
      <p className="lede">
        Specification for the partnership rating. This is our own measure, not the
        league&rsquo;s; Article XXI points are the official standing. The method does not
        change from year to year;{' '}
        {season
          ? `the measured figures below come from ${seasonLabel(season)}.`
          : 'the measured figures below appear once a season has been rated.'}
      </p>

      <nav className="method-toc" aria-label="On this page">
        <a href="#scope">1. Scope</a>
        <a href="#rounds">2. Rounds</a>
        <a href="#glicko">3. Glicko-2</a>
        <a href="#side">4. Side</a>
        <a href="#priors">5. Priors</a>
        <a href="#shrink">6. Shrinkage</a>
        <a href="#validation">7. Validation</a>
        <a href="#limits">8. Limitations</a>
      </nav>

      <section id="scope">
        <h2>1. Scope</h2>
        <p>
          The unit is the partnership: an unordered pair of debater identities,
          resolved through the same merge the season standings use. Open divisions only.
        </p>
        <p>
          Article XXI points measure accumulation. Enter more tournaments and score more,
          regardless of who you beat. This measures strength conditional on opponents
          faced. The two are expected to disagree.
        </p>
        {f && (
          <p className="stats">
            <span><b>{n0(f.rounds)}</b> rated rounds</span>
            <span><b>{n0(f.periods)}</b> rating periods</span>
            <span><b>{n0(f.partnerships)}</b> partnerships</span>
            <span><b>{n0(f.measured)}</b> ranked</span>
          </p>
        )}
      </section>

      <section id="rounds">
        <h2>2. From ballots to a result</h2>
        <p>
          Tabroom stores one ballot per judge per entry. A round is one observation, not one per ballot. For a panel of <code>n</code> judges returning a decision, of
          which <code>w</code> favour the side in question:
        </p>
        <div className="eqn">
          <div><code>m = (2w &minus; n) / n</code><span>ballot margin, &minus;1 to 1</span></div>
          <div><code>s = (1 + m) / 2</code><span>score contributed</span></div>
        </div>
        <p>
          So 3&ndash;0 scores 1, 2&ndash;1 scores <sup>2</sup>&frasl;<sub>3</sub>, and a
          single-judge round scores 1 or 0. A split panel is weaker evidence than a
          sweep and is scored as such.
        </p>
        <p>Four cases are excluded rather than imputed:</p>
        <ul className="plain tight">
          <li>byes, where no opponent was beaten;</li>
          <li>sections with no decision recorded;</li>
          <li>even panels split evenly, which are a missing ballot rather than a draw;</li>
          <li>entries resolving to fewer than two known debaters.</li>
        </ul>
      </section>

      <section id="glicko">
        <h2>3. Glicko-2</h2>
        <p>
          Each partnership carries a rating <code>r</code>, a deviation <code>RD</code>,
          and a volatility <code>&sigma;</code>. Ratings start at 1500, RD at 350,
          &sigma; at 0.06. A rating period is one tournament: every round inside it
          is evaluated against ratings held before the tournament began.
        </p>
        <p>Working on Glickman&rsquo;s internal scale:</p>
        <div className="eqn">
          <div><code>&mu; = (r &minus; 1500) / 173.7178</code><span></span></div>
          <div><code>&phi; = RD / 173.7178</code><span></span></div>
        </div>
        <p>For each opponent <code>j</code> met in the period:</p>
        <div className="eqn">
          <div>
            <code>g(&phi;) = 1 / &radic;(1 + 3&phi;&sup2;/&pi;&sup2;)</code>
            <span>discount for an unsettled opponent</span>
          </div>
          <div>
            <code>E<sub>j</sub> = 1 / (1 + exp(&minus;g(&phi;<sub>j</sub>)(&mu; + h &minus; &mu;<sub>j</sub>)))</code>
            <span>expected score, <code>h</code> from &sect;4</span>
          </div>
        </div>
        <p>Accumulate over the period, then update:</p>
        <div className="eqn">
          <div><code>v = [ &Sigma;<sub>j</sub> g(&phi;<sub>j</sub>)&sup2; E<sub>j</sub>(1 &minus; E<sub>j</sub>) ]<sup>&minus;1</sup></code><span>estimate variance</span></div>
          <div><code>&Delta; = v &middot; &Sigma;<sub>j</sub> g(&phi;<sub>j</sub>)(s<sub>j</sub> &minus; E<sub>j</sub>)</code><span>implied change</span></div>
          <div><code>&phi;* = &radic;(&phi;&sup2; + &sigma;&prime;&sup2;)</code><span></span></div>
          <div><code>&phi;&prime; = 1 / &radic;(1/&phi;*&sup2; + 1/v)</code><span>new deviation</span></div>
          <div><code>&mu;&prime; = &mu; + &phi;&prime;&sup2; &middot; &Sigma;<sub>j</sub> g(&phi;<sub>j</sub>)(s<sub>j</sub> &minus; E<sub>j</sub>)</code><span>new rating</span></div>
        </div>
        <p>
          The new volatility <code>&sigma;&prime;</code> solves <code>f(x) = 0</code> by
          Illinois-variant regula falsi, with <code>&sigma;&prime; = e<sup>x/2</sup></code>:
        </p>
        <div className="eqn">
          <div>
            <code>
              f(x) = e<sup>x</sup>(&Delta;&sup2; &minus; &phi;&sup2; &minus; v &minus; e<sup>x</sup>)
              / 2(&phi;&sup2; + v + e<sup>x</sup>)&sup2; &minus; (x &minus; ln &sigma;&sup2;)/&tau;<sub>sys</sub>&sup2;
            </code>
            <span></span>
          </div>
        </div>
        <p>
          <code>&tau;<sub>sys</sub></code> is the system constant constraining volatility
          change, set to <b>0.4</b>. It was swept and moves results by under 10<sup>&minus;4</sup>
          of log loss: with periods this short, volatility has little room to move.
        </p>
        <p>
          Between periods, an inactive partnership holds its rating and widens its
          deviation by elapsed weeks <code>t</code>, capped at 350:
        </p>
        <div className="eqn">
          <div><code>&phi; &larr; &radic;(&phi;&sup2; + &sigma;&sup2;t)</code><span></span></div>
        </div>
        <p className="aside">
          No elimination-round multiplier. Elim opponents average 53% more season
          points, so a stronger opponent is already priced by <code>&mu;<sub>j</sub></code>.
          A multiplier would count it twice. Weighting elims for stakes rather than
          opponent quality is a values choice and is not made here.
        </p>
      </section>

      <section id="side">
        <h2>4. Side advantage</h2>
        <p>
          Opposition wins{' '}
          <b>{f ? `${f.oppWinPct.toFixed(1)}%` : '~52%'}</b> of decided open rounds. Left
          uncorrected, this is credited to skill. Let <code>p</code> be the proposition
          win rate over decided rounds:
        </p>
        <div className="eqn">
          <div><code>h = 173.7178 &middot; ln(p / (1 &minus; p))</code><span>proposition advantage</span></div>
        </div>
        <p>
          On {season ? seasonLabel(season) : 'a rated season'} <code>h</code> ={' '}
          <b>{f ? f.sideAdvantage.toFixed(1) : '−17'}</b> rating points, applied with
          sign by side. Sides are assigned by tab, so both draw the same opponent
          distribution and the raw rate needs no further adjustment.
        </p>
        <p>
          <code>h</code> enters <code>E<sub>j</sub></code> only. It never enters the stored
          rating, so drawing more opposition cannot raise anyone&rsquo;s rating.
        </p>
      </section>

      <section id="priors">
        <h2>5. Priors for a new partnership</h2>
        <p>
          Starting every new pairing at 1500 discards what its debaters have already
          shown. Each debater carries a working estimate, precision-weighted across the
          partnerships they have competed in (<code>w<sub>p</sub> = 1/RD<sub>p</sub>&sup2;</code>):
        </p>
        <div className="eqn">
          <div><code>r<sub>d</sub> = &Sigma; w<sub>p</sub>r<sub>p</sub> / &Sigma; w<sub>p</sub></code><span>repeated measurement of one debater</span></div>
          <div><code>RD<sub>d</sub> = &radic;(1 / &Sigma; w<sub>p</sub>)</code><span></span></div>
        </div>
        <p>
          A new pairing is seeded from its two debaters. This is an average of two
          skills, not two readings of one quantity, so the deviation is that of a mean
          and cannot come out narrower than its inputs:
        </p>
        <div className="eqn">
          <div><code>r<sub>0</sub> = (r<sub>1</sub> + r<sub>2</sub>) / 2</code><span></span></div>
          <div><code>RD<sub>0</sub> = min(350, &radic;( (RD<sub>1</sub>&sup2; + RD<sub>2</sub>&sup2;)/4 + c&sup2; ))</code><span>c = 180</span></div>
        </div>
        <p>
          <code>c</code> is added variance for whatever a pairing is beyond the two
          people in it. Without it a new team would inherit its members&rsquo; certainty
          along with their rating. Swept over 60&ndash;250 on held-out data; the curve is
          flat from 90 to 250.
        </p>
        <p>
          The debater estimates exist only to seed pairings. They are not a debater
          rating and are not published as one.
        </p>
      </section>

      <section id="shrink">
        <h2>6. Shrinkage, and the two columns</h2>
        <p>
          A rating over ten or twelve rounds is a high-variance estimate. Some run hot.
          Ordering a board on the raw rating ranks by luck as much as by strength, so the
          displayed figure is the posterior mean under a normal prior on true strength:
        </p>
        <div className="eqn wide">
          <div>
            <code>
              r&#770; = 1500 + (r &minus; 1500) &middot; &tau;<sub>F</sub>&sup2; / (&tau;<sub>F</sub>&sup2; + RD&sup2;)
            </code>
            <span>displayed rating</span>
          </div>
        </div>
        <p>
          <code>&tau;<sub>F</sub></code> is the spread of true strengths across the field,
          distinct from Glicko&rsquo;s <code>&tau;<sub>sys</sub></code>. It is estimated,
          not chosen. Observed rating variance is true variance plus estimation noise, so
          by method of moments:
        </p>
        <div className="eqn wide">
          <div>
            <code>&tau;<sub>F</sub> = &radic;( Var(r) &minus; mean(RD&sup2;) )</code>
            <span>floored at 0.05&middot;Var(r)</span>
          </div>
        </div>
        <p>
          On {season ? seasonLabel(season) : 'a rated season'} <code>&tau;<sub>F</sub></code> ={' '}
          <b>{f ? f.tau.toFixed(0) : '117'}</b> rating points, over the{' '}
          {f ? n0(f.measured) : ''} partnerships clearing the round gate. The shrinkage
          factor is the share of a rating retained: near 1 when <code>RD</code> is small,
          near 0 when it is large.
        </p>

        <h3>Which column to use</h3>
        <div className="jobs">
          <div>
            <h3>Established &mdash; ranking</h3>
            <p>
              <code>r&#770;</code>. Uncertainty belongs in the estimate. A board must not
              rank a partnership highly for being unmeasured.
            </p>
          </div>
          <div>
            <h3>Rating &mdash; prediction</h3>
            <p>
              <code>r</code>. Uncertainty belongs in the width of the answer. The win
              probability already widens by both deviations.
            </p>
          </div>
        </div>
        <p>
          Shrinking before predicting is measurably worse: 62.7% accuracy and 0.6638 log
          loss, against 63.4% and 0.6378 unshrunk. Both columns come from one run of one
          model. Head-to-head probability is:
        </p>
        <div className="eqn wide">
          <div>
            <code>
              P(a beats b) = 1 / (1 + exp(&minus;g(&radic;(RD<sub>a</sub>&sup2; + RD<sub>b</sub>&sup2;)/173.7178)
              &middot; (r<sub>a</sub> + h<sub>a</sub> &minus; r<sub>b</sub>)/173.7178))
            </code>
            <span></span>
          </div>
        </div>
        <p>
          Partnerships under <b>{MIN_RATED_ROUNDS} rated rounds</b> are rated but not
          ranked.
        </p>
      </section>

      <section id="validation">
        <h2>7. Validation</h2>
        <p>The season is split three ways. Every model walks forward, predicting a period then observing it.</p>
        <ol className="split">
          <li><b>Train</b>, through December &mdash; fits parameters.</li>
          <li><b>Dev</b>, January &mdash; selects among variants.</li>
          <li><b>Test</b>, February onward &mdash; scored once.</li>
        </ol>
        <p>
          Baselines receive fitted logistic curves on their own statistics, with features
          computed as they stood before each round. The Article XXI baseline uses season
          points to date under the XXI.7.A weighting.
        </p>
        <div className="scroller">
          <table className="worked">
            <caption>Held-out test, 2,209 rounds from February 2026</caption>
            <thead>
              <tr><th>Model</th><th>Accuracy</th><th>Log loss</th><th>Brier</th></tr>
            </thead>
            <tbody>
              <tr><td className="who">Coin flip</td><td>50.0%</td><td>0.6931</td><td>0.2500</td></tr>
              <tr><td className="who">Side only</td><td>50.7%</td><td>0.6915</td><td>0.2492</td></tr>
              <tr><td className="who">Season win rate</td><td>59.9%</td><td>0.6543</td><td>0.2313</td></tr>
              <tr><td className="who">Article XXI points</td><td>59.8%</td><td>0.6667</td><td>0.2362</td></tr>
              <tr className="pick"><td className="who">This rating</td><td><b>63.4%</b></td><td><b>0.6378</b></td><td><b>0.2234</b></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Accuracy gap over the league ranking is 3.6 points, 95% interval 1.2 to 6.0 on a
          paired bootstrap over rounds. The log loss gap did not reverse in 2,000
          resamples. Calibration holds across confidence bands: rounds stated at 70&ndash;80%
          resolve at 73%, at 80&ndash;90% resolve at 82%.
        </p>
        <p className="aside">
          Of partnerships meeting exactly twice, the same side won both
          times 58% of the time. Of three-judge rounds, 56% split 2&ndash;1. Both imply a
          limit near 70% for any predictor. The residual is round-level noise, not model
          error.
        </p>
      </section>

      <section id="limits">
        <h2>8. Limitations</h2>
        <ul className="plain">
          <li>
            <b>Shrinkage is blind to graph structure.</b> It discounts a rating for
            resting on few rounds, not for resting on few distinct parts of the field.
            In-region share correlates with round count at &minus;0.02 and with deviation
            at 0.03; among partnerships with 40+ rounds the shrinkage applied is flat
            across in-region bands (44, 43, 48, 44 points). A well-measured partnership
            inside an isolated pool keeps its rating and nothing here flags it.
          </li>
          <li>
            <b>No isolation effect is detectable this season.</b> The comparison graph has
            one component of 1,765 partnerships plus two islands of 6 and 5, neither of
            which clears the round gate. Effective standard errors from the fitted
            information matrix range 40&ndash;78 and track round count, not region. This is
            absence of evidence at circuit scale, not a guarantee.
          </li>
          <li>
            <b>Unpublished results are dropped, not estimated.</b> Rounds with no recorded
            decision are excluded, so some partnerships with real season points have no
            rating.
          </li>
          <li>
            <b>The partnership is atomic.</b> Rating debaters individually and summing
            predicts better (64.4% / 0.6290) but assumes strength is additive, which
            would rate pairings that never debated. Rejected deliberately.
          </li>
          <li>
            <b>Not a league standing.</b> No bearing on Article XXI or TOC qualification.
          </li>
        </ul>
      </section>

      <p className="backlink">
        {season ? (
          <Link href={seasonHref(season, '/ratings')}>&larr; Ratings table</Link>
        ) : (
          <Link href="/method">&larr; Method</Link>
        )}
      </p>
    </main>
  );
}
