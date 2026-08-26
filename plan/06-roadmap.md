# Roadmap

**Status:** phases 0-5 are complete. Phase 6 is next.

The 2026-27 season's first points-eligible tournament is Harvard, Sept 5-6
(August tournaments are excluded by XXI.1.H). Before then, run the seasonal
checklist in [09-data-quality.md](09-data-quality.md).

---

## Done

### Phase 0 — Foundation
Monorepo, TypeScript, Vitest. Article XXI constants encoded as typed data,
including the Elim Points Table the league publishes only as an image. Drizzle
schema, Neon Postgres, Vercel.

### Phase 1 — Rankings site
Team, debater and school standings at `/rankings`, served from Postgres, plus
a `/rankings/diagnostic` tab reconciling every partnership against the
league's published standings result by result.

### Phase 2 — Tabroom ingestion
Circuit-179 discovery, a cached `download_data` client, normalization, and
entity resolution. 96 tournaments, 4,872 entries, 3,127 debaters, 26,146
ballots, 32,267 speaker scores.

### Phase 3 — Article XXI engine and backtest
The full engine per [03-rules-engine.md](03-rules-engine.md), validated in
three stages: field sizes against the `Tournaments` tab, per-entry points
against `Entry` with each adjustment diffed separately, and season totals
against `team_calc`.

| | |
|---|---|
| Per-entry | **98%** (1529/1564) |
| NPDL-TOC, NYPDL | **100%** each |
| CHSSA | 99% |
| Regular invitationals | 96% |
| Partnerships, all 835 | **87% exact** |
| Top 100 | **92% exact**, 95% within 2% |

The gate was never 100% — `manual_adj` bakes human judgement into the league's
own figures. It was that every mismatch be explained, and they are, in
[09-data-quality.md](09-data-quality.md). Most are not ours to fix.

### Phase 4 — Speaker points
Judge-normalized speaker standings at `/rankings/speakers`, sortable by z-score
or raw average, with a 95% interval on each figure.

27,013 open-division ballots normalized; 387 debaters clear the 20-ballot
threshold, holding 15,410 ballots between them. Method in `packages/speaks`:
scales from a config table rather than inferred, judge baselines from a median
and interquartile spread so one punitive ballot cannot move everyone else, and
both centre and spread shrunk toward the field by sample size.

---

### Phase 5 — Glicko-2 with a field prior
Partnership ratings at `/rankings/ratings`, ordered on the rating shrunk toward
the field by its deviation, gated at ten rated rounds. Method written for a
reader at `/rankings/ratings/method`.

The gate was that it beat "higher Article XXI points wins" on held-out rounds
or be reported as a failure. On 2,209 rounds from February 2026 onward it
predicted 63.4% against the league ranking's 59.8%, at a log loss of 0.638
against 0.665 — a 3.6 point gap, 95% interval 1.2 to 6.0 on a paired bootstrap.
The log loss gap is the surer of the two.

The board is ordered on the shrunk figure and predictions use the raw one.
Glicko alone put a twelve-round partnership at the top on 92% in-region rounds;
deviation counts how many rounds a team has debated, not whether they connect to
anything. Shrinking by deviation fixes that ordering, and shrinking *before*
predicting makes prediction worse, because the win probability already widens by
both deviations. Two dead ends are recorded in [05-metrics.md](05-metrics.md) so
they are not retried.

7,699 rated rounds over 78 tournaments and 1,776 partnerships, of which 387
clear the round gate. Method and the full comparison in
[05-metrics.md](05-metrics.md); `npm run validate:rating` reruns it.

No elim multiplier and no field-size weighting, both for the same reason:
opponent quality already prices them.

Rating individual debaters predicts better still — 64.4% — and was set aside
deliberately: it can only pool evidence across partners by assuming strength is
additive, which cannot see the partnership the board is about.

---

## Next

### Phase 6a — Site structure and identity
Navigation that encodes what is the league's and what is ours, a real season
control, an About/Privacy/Method/Feedback set, and an identity that is chosen
rather than defaulted. Planned in [11-site.md](11-site.md).

### Phase 6 — Profiles and depth
Debater, team, school and tournament pages. Head-to-head records.

### Phase 7 — Live season
`npm run fetch` refreshes the season from the league's sheet: the `Results`
column decides which tournaments exist, payloads are pulled by the id in it, and
the circuit calendar is reported as a lookahead rather than used for discovery.
`npm run check:rules` guards the point tables against a July revision, and
`.github/workflows/ingest.yml` runs the chain nightly.

**Still needed before the opener:** the 2026-27 sheet id in `SHEET_IDS`, the
`DATABASE_URL` secret and `CURRENT_SEASON` variable set on the repository, and
one full end-to-end run against 2026-27 so the first live tournament is not the
first test. Then "updated N hours ago", new-result diffing, and the disagreement
queue as an ops dashboard.

### Phase 8 — Historical archive
Static mirror of pre-2024 sheets, visually separated and never recomputed. See
[01-product.md](01-product.md) for why.

### Phase 9 — Judge scoring
Per-judge profiles: tournaments judged, panel rate, squirrel rate, speaker
generosity, side bias. Shrunk by sample size with visible confidence intervals,
launched aggregate-first. See [08-risks-policy.md](08-risks-policy.md).
