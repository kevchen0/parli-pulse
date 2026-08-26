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

### Phase 6a — Site structure and identity
Seasons are routable, so `/2025-26/points` keeps its meaning when a new season
opens and `/rankings` forwards to whichever is current at request time.
Navigation splits on whose numbers they are: **Points** holds Teams, Debaters
and Schools; **Ratings** and **Speakers** sit outside it because they are ours.
About, Privacy, Method and Feedback exist, the last two of which the site had
been promising and not delivering.

Identity is ink and slate, on a flat masthead rather than floating cards, with
the unofficial notice present on every page and loud on none. Tables page at
fifty rows with search and a page-jump, and mark totals the league's sheet has
not settled — amber where it has no row yet, red where it has one and we differ.
Loading states appear on the page you clicked rather than the one you left.

Full plan, including what was deliberately not done, in [11-site.md](11-site.md).

### Phase 7 — Live season
`npm run fetch` refreshes from the league's sheet: the **Results** column of the
`Tournaments` tab decides what exists, payloads are pulled by the id written
into it, and the circuit calendar is reported as a lookahead rather than used
for discovery — it finds 44 tournaments where the sheet finds 95.

`npm run check:rules` compares the engine's point tables against the published
Board Code and runs first, so a July revision stops ingestion instead of
silently scoring a season under last year's rules.
`.github/workflows/ingest.yml` runs the chain at 09:10 UTC nightly and on
demand, under three scoped credentials: `parli_ingest` writes, `parli_web`
reads, and the owner role never leaves the maintainer's machine.

The first end-to-end run against an empty 2026-27 found four bugs, two of which
were quietly damaging the live season. They are in
[10-mistakes.md](10-mistakes.md) as 35-38; the pattern is that anything reading
a season must be given the season.

---

## Next

### Phase 6 — Profiles and depth
Debater, team, school and tournament pages. Head-to-head records. The highest
user value left: the rankings are a dead end with nothing to click into.

Partly unblocked — [08-risks-policy.md](08-risks-policy.md) and the public
Privacy page now state what may be shown — but a profile is a larger surface
than a table row and the scope is worth deciding rather than inheriting.

### Phase 8 — Historical archive
Static mirror of pre-2024 sheets, visually separated and never recomputed. See
[01-product.md](01-product.md) for why.

### Phase 9 — Judge scoring
Per-judge profiles: tournaments judged, panel rate, squirrel rate, speaker
generosity, side bias. Shrunk by sample size with visible confidence intervals,
launched aggregate-first. See [08-risks-policy.md](08-risks-policy.md).

### Smaller, ready when wanted
- **Analytics.** Held deliberately until the Privacy page existed. Aggregate,
  cookieless, described there before it ships.
- **A Seasons page.** The picker covers two; a third will want a list.
- **Gating the reconciliation view** to maintainers. Honest and public today.
- **Nine analysis scripts** still hardcode `rankings.zip`. Correct for the
  season they run against, wrong for any other.
