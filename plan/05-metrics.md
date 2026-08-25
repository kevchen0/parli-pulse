# Metrics beyond Article XXI

## Which rating system — the evidence

Measured on the 2025-26 season, since these properties decide the choice:

| | |
|---|---|
| Partnerships with under 10 open rounds | **47%** (328 of 698, averaging 6) |
| Debaters with more than one partner | 20% (239 of 1,178) |
| Average opponent quality, prelim vs elim | 9.35 → **14.32** season points |
| Strong-vs-strong pairings | 5.5% prelim → **22.8% elim** |
| Side split, open divisions | 47.4% / **52.6%** |
| Elims as a share of ballots | 21% |

**Elim rounds need no special weighting.** Opponents in elims average 53% more
season points, and top-tier matchups are four times as common. Any
opponent-adjusted rating already pays more for an elim win, endogenously.
Adding a multiplier on top would count the same thing twice. A rating cannot
see *stress* — if elims should count extra for reasons beyond opponent quality,
that is a values choice and should be argued as one, not smuggled in as a
parameter.

**Sparsity is the binding constraint,** not partner churn. Nearly half of
partnerships have fewer than ten rounds, which no amount of modelling
manufactures evidence for. It argues for showing uncertainty rather than hiding
it, and for pooling a debater's rounds across their partnerships where possible
— a debater with three partners at six rounds each has eighteen rounds of
signal rather than three unratable fragments.

**Side bias is real.** A 5.2-point edge is large enough that a rating ignoring
it credits the difference to skill.

### The options

- **Article XXI points** measure accumulation, not strength. No opponent
  adjustment inside a tournament, so 5-0 at a small local can outscore 4-2 at
  Stanford. That is a fair description of a season, not of a team.
- **Glicko-2 on partnerships** measures strength, prices elims automatically,
  and states its own uncertainty. Interpretable and standard. Leaves half the
  field effectively unrated, which is honest but thin.
- **Individual-level (TrueSkill-shaped)** pools evidence across partners, which
  is the only thing that relieves sparsity, and answers the question people
  actually argue about. Harder to explain, and assumes team skill is additive.
- **Bradley-Terry with covariates** fits best and can model side bias and judge
  effects explicitly, but produces coefficients rather than a rating anyone can
  narrate.

### Recommendation

Build **Glicko-2 on partnerships** first as the interpretable baseline, ship it
with RD visible and a minimum-rounds gate, then evaluate an individual-level
rating against it on held-out late-season rounds. Correct for side in either
case. Do not add an elim multiplier.

The prediction, stated in advance so it can be wrong: individual-level should
win, because sparsity binds and pooling across partners is the only relief. If
Glicko cannot beat "higher Article XXI points wins", that is real information —
points correlate with strength precisely because strong teams break and
accumulate — and it should be reported rather than tuned away.

## Glicko-2 rating — built, validated, shipped

At `/rankings/ratings`. `npm run rate` computes it; `npm run validate:rating`
reruns every number below.

### The gate, and whether it was cleared

The commitment was that the rating beat "higher Article XXI points wins" or be
reported as a failure. It cleared it.

The season is cut three ways. Train through December fits parameters, January
chooses between variants, and February onward is touched once, at the end.
Every model walks forward — predict a tournament, then learn from it — and each
baseline gets a fitted logistic on its own statistic, so the comparison is with
the best version of the league's ranking rather than a straw one.

Held-out test, 2,209 rounds from February 2026 on:

| | accuracy | log loss | Brier |
|---|---|---|---|
| Coin flip | 50.0% | 0.6931 | 0.2500 |
| Side alone | 53.7% | 0.6909 | 0.2489 |
| Season win rate to date | 61.3% | 0.6539 | 0.2311 |
| **Article XXI points to date** | **61.2%** | **0.6654** | **0.2358** |
| **Glicko-2** | **63.4%** | **0.6378** | **0.2234** |

The accuracy gap is 2.2 points, 95% interval 0.0 to 4.3 on a paired bootstrap —
real but not comfortable. The log loss gap of 0.028 is the surer finding and
never reversed in two thousand resamples: the rating is better calibrated than
it is decisive, which is what a system carrying its own uncertainty should look
like.

Two results worth keeping:

- **Season win rate is nearly as good as Article XXI points**, and better
  calibrated. Points buy their accuracy mostly by being a proxy for winning, not
  by knowing anything about who was beaten.
- **The rating's margin is widest where evidence is thinnest.** On rounds where
  both teams had ten or more prior rounds it leads points by 2.0; on rounds
  where either had fewer, by 2.2. That is the seeding below doing its work.

### What it is made of

Rating the **partnership**, one rating period per tournament, every round inside
a period judged against the ratings held before it began.

Three departures from plain Glicko-2, each measured on the January split rather
than chosen:

1. **A new partnership starts where its debaters left off**, not at 1500, with
   its deviation widened for the fact that a pairing is a new thing. Worth 0.008
   of log loss — five times the other two together, and the single reason this
   is not stock Glicko-2. It is the only lever that touches sparsity.
2. **Split panels are graded.** A 3-0 scores a full win, a 2-1 scores 0.67.
   Worth 0.0015. Small, and free.
3. **A side correction**, read off the season rather than fixed: about −17
   rating points to proposition on 2025-26. Worth 0.0007.

`tau` was swept and moves nothing at four decimal places — with periods one
tournament long the volatility has no time to change — so it stays at
Glickman's default.

Deviation grows with time away rather than with tournaments missed, since three
tournaments can share one weekend.

### What was deliberately left out

- **No elim multiplier.** The evidence above is why: elim opponents average 53%
  more season points, so an opponent-adjusted rating already pays more for
  beating them. A multiplier would count the same fact twice. On the 225
  held-out elim rounds the rating and the points baseline tie exactly on
  accuracy at 61.8%, but the rating's log loss is 0.638 against 0.678 — the
  shape of a system that prices elims rather than flattering them.
- **No field-size weighting.** Same reasoning. A large field means more and
  better opponents, which the rating already sees.
- **No reduced loss multiplier for elim losses.** An earlier draft of this
  document called for one. It is the same double count wearing different
  clothes, and it contradicts the analysis above it; it was written before the
  measurements and is withdrawn.

### How it is ranked

The board sorts on the rating **less its deviation**, and shows both. A twelve
round partnership at 1963 ± 144 and a fifty-two round one at 1934 ± 67 are not
making the same claim, and ordering on the rating alone puts the twelve first —
which reports how little is known rather than who is better. Under the
subtraction a partnership rises by being confirmed as well as by winning.

Predictions still use the rating itself. For a prediction the uncertainty
belongs in the width of the answer, not in the estimate.

Partnerships below **ten rated rounds** keep a rating and a deviation but are
not ranked: 387 of 1,776 clear the line. That figure is much harsher than the
"47% under ten rounds" measured above, because that measurement counted only
partnerships the league scores; the rating sees every team in an open room,
including the many from outside NPDL who appear once.

### What is not rated, and why

Of 9,031 open-division sections in 2025-26, 7,699 became rated rounds. The rest
are left out rather than guessed at, per pattern F:

| | |
|---|---|
| No result entered anywhere in the section | 395 |
| Byes | 365 |
| A team we only half know | 413 |
| Even panel split down the middle | 159 |

The 413 are entries recovered from ballot labels carrying one debater record or
none. A partnership we know half of cannot be named, and the round is lost to
its opponent too — unfortunate, and better than attributing it to the wrong
pair.

Coverage against the league's own partnership list is complete in the only
sense available: all 740 of the 799 partnerships that have a decided open round
in Tabroom are rated, and every one of the 59 that are not has no decided open
round at all.

### Still to do

Test an **individual-level rating** against this one on the same held-out
rounds. The prediction stated in advance was that it should win, because
sparsity binds and pooling across partners is the only relief; the partnership
seeding above is a weak form of that pooling and it was by far the largest
single gain, which is evidence for the prediction rather than against it. The
comparison is a fair one to run now that the harness exists.

Seasons before 2025-26 stay archival — see [01-product.md](01-product.md).

## Localized clustering, and what does not fix it

The 2025-26 rating put Cleveland's Waldron & Bernardo top of the board on twelve
rounds, 92% of them against Oregon opposition, having never beaten anyone rated
above 1725 -- and rated 1963. La Costa Canyon's Reichuber & Sharp were ninth on
ten rounds with the same shape. Both readings are wrong, and the coach spotted
them from circuit knowledge before any of this was measured.

**The cause is connectivity, not sample size.** A partnership that debates almost
entirely inside one region is rated against opponents who are themselves rated on
the same thin local evidence. Nothing anchors the pool to the rest of the field,
so the whole cluster can drift upward together and each team's rating looks
well-supported from the inside. Deviation does not catch it: RD measures how many
rounds someone has debated, not whether those rounds connect to anything. Twelve
rounds inside Oregon and twelve rounds spread across three circuits earn the same
RD and are not the same evidence.

The diagnostic that makes it visible is the gap between a partnership's rating
and the best rating it has actually beaten. Earned ratings sit at or below that
line -- Georgatos & Miller rate 1881 having beaten 1933. Extrapolated ones sit far
above it: Waldron & Bernardo by 97 points, Megy & Chowdhury by 131 on rounds that
were 100% in-region.

### Two fixes that look right and are not

**Iterating the season makes it worse.** Glicko is a forward-only filter: an
October round inside Oregon is scored against opponents still sitting at the
default, and when those teams travel in March and lose, nothing carries that
back. Running the season again from the finished ratings should let late evidence
reach early rounds. It does the opposite -- three passes moved Waldron & Bernardo
from 1963 to **2238** and widened their extrapolation gap from 97 points to 180,
with the whole field inflating past 2000. The feedback is positive, not
corrective: a team rated higher on pass one raises its opponents on pass two,
which raises the team again on pass three, and inside an isolated pool there is
nothing to damp it. The anchor a smoother needs is an outside result, and a pool
that never leaves home does not have one.

**A virtual drawn round each period only rescales.** The Glicko analogue of an L2
penalty looks like a drawn round against a 1500-rated opponent added to every
rating period -- the one result whose opponent strength is known rather than
estimated. Swept from one to three virtual rounds at deviations from 120 to 300,
it compressed the whole scale and reordered nothing: Waldron & Bernardo stayed
first at every setting. Every partnership debates about six rounds a period, so
all of them get anchored in the same proportion. **The penalty has to scale with
a partnership's total evidence, not their evidence per weekend.**

### Shrinking by deviation does fix it

That is what deviation already measures, so the penalty is written in terms of it
-- the posterior mean under a normal prior on true strength:

    shrunk = 1500 + (rating - 1500) * tau^2 / (tau^2 + RD^2)

`tau` is the spread of *true* strengths, which is not the spread of the observed
ratings: observed spread is true spread plus measurement noise, and subtracting
the mean squared deviation recovers it. On 2025-26 it comes out at **117 rating
points**, estimated rather than tuned. `fieldSpread` and `shrinkToField` in
`packages/rating/src/season.ts`.

Singel & Greenleaf at RD 67 keep 75% of their distance from the field; twelve
rounds inside one region at RD 129 keep 45%. That difference reorders the board.
The top twelve becomes Singel & Greenleaf, Georgatos & Miller, Bomze & Chen,
Shivakumar & Kassayan, Wee & Savla -- round counts of 52, 92, 61, 48 and 72, with
the thin regional teams gone and the p95 extrapolation gap down from 65 points to
25.

**Rank on the shrunk figure; predict on the raw one.** Shrinking before
predicting is worse than not shrinking at all -- 62.7% and 0.6638 log loss
against 63.4% and 0.6378 -- because `winProbability` already widens by both
deviations, and shrinking the estimate as well counts the same uncertainty twice.
The two jobs want different numbers, and this is why: for a prediction the
uncertainty belongs in the width of the answer, and for a ranking it belongs in
the estimate, because a board must not reward being unmeasured.

This supersedes the `rating - RD` "established" column, which was reaching for the
same idea with a cruder instrument -- it still had Waldron & Bernardo second.

### A penalised global fit also works

Bradley-Terry on partnerships, penalty 1, reaches much the same ordering by
fitting every round at once against a penalty that pulls unsupported strengths
toward the field. Its top ten round counts run 52, 92, 61, 48, 72, 70, 29, 68, 36
and 19. It costs prediction accuracy -- 61.2% against Glicko's 63.4% -- partly as
an artefact of the comparison, since walk-forward prediction penalises it for
having no way to seed a partnership appearing for the first time, where Glicko
starts it from its debaters. Kept in `packages/rating/src/bradley-terry.ts` as a
cross-check on the shrinkage above: two different methods reaching the same top
ten is worth more than either alone.

### Rating people fixes it too, and was rejected on other grounds

Bradley-Terry on individual debaters, with a partnership scored as the sum of its
two, beat everything measured: 64.4% accuracy and 0.6290 log loss against
Glicko's 63.4% and 0.6378, with the largest gain exactly where sparsity binds --
65.0% on rounds where a team had fewer than ten. It also cleared the clustering
problem. This was the outcome predicted in advance above, and pooling across
partners is why.

It is not what ships, by the coach's decision: **strength is not additive.** The
model has no way to say two debaters are better together than apart, and it will
rate a pairing that never debated a round by adding two numbers. For a board
whose unit is the partnership, a measure that cannot see the partnership is the
wrong measure however well it predicts. Recorded here because the numbers are
real and the reason for setting them aside is a judgement about what is being
measured, not a defect in the fit.

## Speaker points

1. **Filter sentinels.** 0.0 values are forfeits, not scores. Scores in the
   1-22 range go to a review queue, not into the math.
2. **Scale comes from a config table, never from the observed minimum.**
   Default 25-30; NYPDL 23-30. Inferring from the minimum misclassifies 24 of
   43 events, because a lone punitive 24 is not a scale.
3. **Z-score within judge**, using stable `judge_person` across the season.
   This is the core of it: it removes the judge's personal generosity.
4. **Robust center and spread** (median / winsorized SD) rather than raw mean
   and SD. A punitive score is genuine signal and stays in the record, but one
   24 must not stretch a judge's SD and quietly compress every other debater
   they ranked.
5. **Shrink toward the pool mean** by judge sample size. A judge with 4 ballots
   has a noisy center. Fallback chain: judge-season → judge-tournament → event pool.
6. **Rescale for display only**, onto a 25-30 band centered at 27.5, so the
   number reads familiarly. Store raw, z, and display separately; never
   overwrite raw.

**One z per ballot, not one per debater.** Each ballot is measured against the
judge who gave it; a debater's season figure is the mean of those. The top
figures rest on 19 to 71 distinct judges apiece, so they average across many
standards rather than comparing anyone to a single judge.

Each debater also carries the spread of their own ballots and a 95% confidence
interval on the mean -- `1.96 * sd / sqrt(n)`, converted from z units into
display points. Two debaters can share an average while one earned it
consistently over seventy ballots and the other from a wide scatter over
twenty.

Aggregate per debater (already per-debater) and per team.

### Punitive scores are handled, never surfaced

Sub-25 scores on a 25-30 scale are usually equity sanctions under Article XIV.
They stay in the data and inform normalization, but the site must not have a
"lowest speaks" view, a punitive flag, or anything that identifies who received
one. Publishing that would expose a student on the receiving end of a conduct
sanction to the entire league.

## Judge scoring (Phase 9)

Per-judge: tournaments judged, rounds, panel rate, **squirrel rate** (dissent
frequency on panels), speaker generosity (raw mean vs pool), side bias.
Weighted by tournaments judged.

**The sparsity is the design problem.** 277 dissent events across 1,336 judges
means most judges have no panel data at all. An unshrunk squirrel rate is noise
wearing a number's clothes. Heavy shrinkage and visible confidence intervals are
mandatory, and the launch should be aggregate-first — distributions, not a
"worst judges" leaderboard. See [08-risks-policy.md](08-risks-policy.md).
