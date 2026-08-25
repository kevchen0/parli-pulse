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
