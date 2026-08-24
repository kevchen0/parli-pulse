# Metrics beyond Article XXI

## Glicko-2 rating

Rate the **team pairing**. A new pairing starts at the average of its debaters'
priors rather than at the default, so a strong debater with a new partner isn't
reset to zero.

- Rating period = one tournament.
- Elim losses get a reduced loss multiplier — advancing past prelims shouldn't
  be punished.
- Larger fields carry more weight via reduced RD inflation.
- Ship the **RD** alongside the rating; gate the public leaderboard on a
  minimum round count so a 3-round team can't top the board.
- Season transitions **decay** (inflate RD) rather than reset.
- Panels count as **one result weighted by ballot margin** — a 3-0 is stronger
  evidence than a 2-1.

Validation: train through January, measure win prediction on Feb-April rounds.
Must beat a naive "higher points wins" baseline or the metric isn't earning its
place.

Applies to 2024-25 onward only. Earlier seasons stay archival — see
[01-product.md](01-product.md).

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
