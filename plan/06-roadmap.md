# Roadmap

**Status:** phases 0-7 complete and deployed, Phase 6 half done — debater
profiles are live, team/school/tournament pages are not. The season ingests
itself nightly, and its points are computed from Tabroom rather than mirrored
from the league.

**The site is public** at [parli-pulse.vercel.app](https://parli-pulse.vercel.app),
indexed by search engines except for debater profiles, with a working removal
path, a contact form, an MIT licence and link previews that render the ratings
board. Work now
happens on `dev` and reaches production through a squash-merged pull request;
see [../docs/deploying.md](../docs/deploying.md).

**The methodology page reads "Coming soon!"** on `main`. It was rebuilt this
session and held back for a rewrite, which lives on `method-rewrite` and is the
next substantial piece of work.

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
Team, debater and school standings, served from Postgres, plus a
reconciliation tab comparing every partnership against the
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
| Per-entry | **96%** (1532/1588) |
| NPDL-TOC, NYPDL | **100%** each |
| CHSSA | 99% |
| Regular invitationals | 96% |
| Partnerships, all 835 | **87% exact** |
| Top 100 | **89% exact**, 95% within 2 points |

The gate was never 100% — `manual_adj` bakes human judgement into the league's
own figures. It was that every mismatch be explained, and they are, in
[09-data-quality.md](09-data-quality.md). Most are not ours to fix.

### Phase 4 — Speaker points
Judge-normalized speaker standings at `/<season>/speakers`, sortable by z-score
or raw average, with a 95% interval on each figure.

27,013 open-division ballots normalized; 387 debaters clear the 20-ballot
threshold, holding 15,410 ballots between them. Method in `packages/speaks`:
scales from a config table rather than inferred, judge baselines from a median
and interquartile spread so one punitive ballot cannot move everyone else, and
both centre and spread shrunk toward the field by sample size.

---

### Phase 5 — Glicko-2 with a field prior
Partnership ratings at `/<season>/ratings`, ordered on the rating shrunk toward
the field by its deviation, gated at ten rated rounds. Method written for a
reader at `/method#rating`, now behind the placeholder.

The gate was that it beat "higher Article XXI points wins" on held-out rounds
or be reported as a failure. On 2,209 rounds from February 2026 onward it
predicted 64.0% against the league ranking's 59.7%, at a log loss of 0.636
against 0.667 — a 3.6 point gap, 95% interval 1.2 to 6.0 on a paired bootstrap.
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

### Phase 7b — Computing rather than mirroring

The engine took the league's field sizes, break percentage, prelim count,
breaking record and walkover adjustment wherever the sheet had them, and walked
its `Entry` tab to decide which teams existed. Every one of those now comes from
the payload.

Each input was moved separately and measured, because switching all of them at
once says the accuracy changed and not which input changed it
(`npm run compare:sources`). The first run scored **76.2%** and exposed a bug
invisible for the same reason the default existed: our AFS was the open field
alone where XXI.2.B is open *plus* novice/JV, so Berkeley read as 104 against
the league's 141. Our own AFS had never been the number under test.

Then the rules, each measured against the league's own figures rather than
chosen:

| | |
|---|---|
| Forfeit exclusion | `dropped` **or never competed** — 94% of open fields, against 89% for a three-round threshold and 78% for `dropped` alone |
| Bracket partition | NYPDL's `VO`/`NQ` round labels — exact on 15 of 17 |
| XXI.5.C walkovers | a same-school **short panel** — 1,535 of 1,541 |
| Absent breakers | recovered from prelim seeds — elim field 95% → 97% |
| Entries | every Tabroom entry clearing XXI.1.D — 835 of 835 partnerships identical |

The trade is **96% per-entry against 98%**, taken deliberately: a check that
reads its inputs from the thing it is checking is not a check. What the sheet
still supplies is audited in [07-open-questions.md](07-open-questions.md) — six
things, of which two are numbers.

---

## Next

### Phase 6 — Profiles and depth

**Debater profiles are in.** `/<season>/debater/<id>` carries the three figures
the site holds about a person, every tournament of their season with the five
Article XXI counts marked and adding to the total in the foot, their
partnerships' ratings, and every round with the opponent, the panel split and
their own judge-normalized speaks. All four tables link into it. Any of a
debater's Tabroom ids resolves and redirects to the canonical one, so a link
survives an identity merge.

The scope question in [07-open-questions.md](07-open-questions.md) was settled
in favour of naming opponents. It is a real widening -- a page about one minor
is now also a page about everyone they debated -- and it is bounded by the
suppression work below, which is what makes a removal request reach the places
a person is named on somebody else's page.

**The removal path now exists.** `debaters.suppressed` had been written by the
loader and read by nothing, so the Privacy page's "the name will not appear"
was true of no page on the site. Names now resolve through one SQL fragment and
one component: a withheld debater reads as "Name withheld" wherever they would
be named, including as somebody else's partner or opponent, is not linked,
cannot be found by search, and has no page. Their results still count toward
school and partnership totals, as the rules require and as the Privacy page
says.

Still to come: team, school and tournament pages, and head-to-head.

### Phase 8 — Historical archive
Static mirror of pre-2024 sheets, visually separated and never recomputed. See
[01-product.md](01-product.md) for why.

### Phase 9 — Judge scoring
Per-judge profiles: tournaments judged, panel rate, squirrel rate, speaker
generosity, side bias. Shrunk by sample size with visible confidence intervals,
launched aggregate-first. See [08-risks-policy.md](08-risks-policy.md).

### Smaller, ready when wanted
- ~~**Analytics**~~ — done. Vercel Web Analytics, cookieless, disclosed on the
  Privacy page in the same commit that shipped it.
- **A Seasons page.** The picker covers two; a third will want a list.
- **Gating the reconciliation view** to maintainers. Honest and public today.
- **Analysis scripts that hardcode `rankings.zip`.** Correct for the season
  they run against, wrong for any other.
- **Three dead mechanisms.** `manual_overrides` has no reader or writer;
  `official_tournament_stats` is written every load and read by nothing;
  `Approval` is parsed and never consulted, so XXI.1.E/F is unenforced. Each is
  a feature to finish or a table to delete.
