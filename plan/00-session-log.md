# Current state and handoff

Read this first. [10-mistakes.md](10-mistakes.md) second, before touching
scoring, identity, or anything that reads a season — several bugs there were
reintroduced after being fixed, in tooling written later, and the newest ones
are about *which season* a script silently read.

---

## Where things stand

Phases 0-7 complete, and Phase 6 has started: **debater profiles are in**, and
the rankings are no longer a dead end. Team, school and tournament pages and
head-to-head are what remain of it.

| | |
|---|---|
| Per-entry Article XXI agreement | **96%** (1532/1588) |
| Partnership season totals | **92% exact** (735/799) |
| The league's top 100 | **89% exact**, 95% within 2 points |
| Partnerships whose every result we reproduce | **99%** (707/712) |
| Rating against the league's own ranking | **63.4%** vs 59.8% on held-out rounds |

**Points are computed from Tabroom.** Field sizes, break percentage, prelim
count, the breaking record, XXI.5.C walkovers and **which teams exist** all come
from the payload. What the sheet still supplies is audited in
[07-open-questions.md](07-open-questions.md) — six things, of which only two are
numbers, and 5.7% of scoring entries take their points from it.
`SOURCE=sheet` scores the old way and reaches 98% per-entry, which measures what
independence costs rather than a better engine; the backtests take the same flag.

Loaded for 2025-26: 98 tournaments, 4,946 entries, 25,851 ballots, **3,302
scored results of which 1,587 are worth points** — a result worth nothing is
stored and never shown — 806 partnerships, 1,194 debaters with points, 47 member
schools, 387 ranked speakers of 1,831, 1,779 rated partnerships of which 387
clear the round gate, 830 reconciliation rows, 56 open disagreements. 167 tests.

2026-27 is open and empty: the sheet lists 110 tournaments and none has a
results link yet. That is the correct state until the league writes up Harvard
(Sept 5-6).

## What shipped recently

**Phase 6b — debater profiles.** `/<season>/debater/<id>`, linked from all four
tables. The three figures the site holds about a person, every tournament of
their season with the five Article XXI counts marked and adding to the total in
the foot, their partnerships' ratings, and every round with the opponent, the
panel split and their own speaks. Any of a debater's Tabroom ids resolves and
redirects to the canonical one, so a link survives an identity merge.

Naming opponents was a deliberate widening — a page about one minor is also a
page about everyone they debated — and it is what made the next item a
prerequisite rather than a nicety.

**The removal path exists now.** `debaters.suppressed` had been written by the
loader and read by nothing, so the Privacy page's "the name will not appear"
was true of no page on the site. It is now one SQL fragment and one component: a
withheld debater reads as "Name withheld" wherever they are named, including as
somebody else's partner or opponent, is not linked, is not findable by search,
and has no page. Their results still count toward school and partnership
totals, which is both what the rules require and what stops a removal request
being legible from the arithmetic. **Nobody has requested removal, so this has
been exercised against a flag that is false for all 3,933 debaters** — see
"Waiting on the user".

**Independence from the sheet, measured one input at a time.** The engine used
to take the league's field sizes, break percentage, prelim count, breaking
record and walkover adjustment wherever the sheet had them — a deliberate choice
for the *backtest*, where isolating the points rules means a mismatch can never
be a field-size mismatch in disguise, and the wrong default for a live pipeline
that has to score a tournament before the league writes it up. Both used one
function, so the backtest's choice was production's.

Each input now moves separately (`npm run compare:sources`), and all of them
have moved. The first run scored 76.2% and exposed a bug that had been invisible
for exactly the reason above: **our AFS was the open field alone** where XXI.2.B
is open *plus* novice/JV, so Berkeley read as 104 against the league's 141. Our
own AFS had never been the number under test.

Then the rules themselves, each measured rather than chosen:

- **The forfeit exclusion is "did they compete", not a count of missing rounds.**
  A threshold has to mean different things at a four-round tournament and a
  six-round one; `dropped` or nothing scored reproduces 94% of open fields
  against 89% for the three-or-more rule it replaced, and 78% for `dropped`
  alone. See [07-open-questions.md](07-open-questions.md).
- **NYPDL says which bracket a round is in** and we were inferring it.
  `round.label` carries `VO`/`VQ`/`VS`/`VF` and `NQ`/`NS`/`NF`; exact on 15 of
  17 NYPDL tournaments.
- **XXI.5.C is derived**, at 1,535 of 1,541 against the league's own column. A
  walkover is a same-school elim section that drew a *short panel* — not merely
  same-school, and not "no result entered", both of which were tried and
  measured.
- **A team that broke and debated nothing is recovered from the seeds.**
  Invisible in the round data and still counted by the league; one such team
  moves NYPDL October OL's break from 20.0% to 18.8%, across a XXI.2.D
  threshold.
- **Entries come from Tabroom.** Every open-division entry clearing XXI.1.D is
  scored, listed or not, and results worth nothing are stored and never shown.
  Verified partnership by partnership: 835 of 835 keep every result and the same
  total. Four gained one the league does not list.

96% per-entry against 98% under the sheet's inputs — 1.6 points traded for the
check and the thing being checked no longer sharing a source.

**Phase 5 — Glicko-2 with a field prior.** Partnership ratings at
`/<season>/ratings`, with the specification at `/<season>/method/ratings`. The
board is ordered on the rating shrunk toward the field by its deviation;
predictions use the raw rating, because the win probability already widens by
both deviations and shrinking as well counts the same uncertainty twice. Two
plausible fixes that failed are recorded in [05-metrics.md](05-metrics.md), as
is the retraction of an isolation claim that turned out to be a correlation.

**Phase 6a — the site.** Seasons are routable, so a link keeps its meaning.
Navigation splits on whose numbers they are: Points holds Teams, Debaters and
Schools; Ratings and Speakers sit outside it because they are ours. About,
Privacy, Method and Feedback exist. Identity is ink and slate. Tables page at
fifty with search, and mark totals the league's sheet has not settled.

**Phase 7 — the live season.** `npm run fetch` refreshes from the league's
sheet and the nightly workflow runs the whole chain. See below.

## Commands

| | |
|---|---|
| `npm run fetch` | refresh cached payloads from the sheet's Results column |
| `npm run check:rules` | engine point tables against the published Board Code |
| `npm run check:walkovers` | XXI.5.C derived from Tabroom against the league's column |
| `npm run compare:sources` | what the sheet's inputs are worth, one input at a time |
| `npm run compare:entries` | scoring every Tabroom entry vs only the league's list |
| `npm run load` | rebuild a season from cached payloads (`SEASON=` to pick) |
| `npm run rollup` | identity merging, then team/debater/school standings |
| `npm run speaks` | judge-normalized speaker points |
| `npm run rate` | Glicko-2 partnership ratings with the field prior |
| `npm run diagnostics` | the reconciliation the site displays |
| `npm run mark-ingest` | records that the pipeline finished; the site reads it |
| `npm run validate:rating` | the held-out comparison against the league ranking |
| `npm run backtest` | fields, per-entry, partnerships |
| `npm run compare` / `npm run diagnose` | top-N accuracy, cause attribution |
| `npm test` | 167 tests: rules, matcher, divisions, brackets, speaks, rating, site labels |
| `npm run dev --workspace @parli-pulse/web` | the site locally |

**Order matters:** `fetch` → `load` → `rollup` → `speaks` → `rate` →
`diagnostics` → `mark-ingest`. `rollup` decides who is one person and who is two, and
everything after it groups by the identities it settles.

`SOURCE=sheet` on any of `load`, the backtests or `diagnose` restores the
league's own inputs, which is what a backtest wants: it isolates the points
rules so a mismatch cannot be a field-size mismatch in disguise.

## How the live season works

The **`Results` column** of the rankings sheet's `Tournaments` tab decides what
exists. The league writes a Tabroom URL into it as each tournament is scored;
`fetch` reads the id out of it and pulls that payload; `load` accepts nothing
else. A tournament appears on the site once the league has written it up, which
is a lag rather than a bug.

The circuit calendar is **not** used for discovery — it finds 44 tournaments
where the sheet finds 95. It is reported as a lookahead only. See
[02-findings.md](02-findings.md).

`.github/workflows/ingest.yml` runs the chain at 09:10 UTC nightly, and by hand
from the Actions tab. The last step records the run, and the site shows how
fresh its data is — quietly when the ingest is working, and with a warning past
36 hours, which is the only place a failed run is visible: nothing else changes,
so stale figures otherwise look current. Three credentials, each scoped to its job: `parli_ingest`
(GitHub secret, read/write), `parli_web` (Vercel, read-only), and the owner role,
which stays on the maintainer's laptop because only it can run migrations.

## Things that will bite you

- **Node runs `.ts` directly.** No build step, no tsx. Imports use explicit
  `.ts` extensions. Node's type stripping rejects parameter properties, which
  `tsc` accepts.
- **`npm run typecheck` covers `packages`, `scripts` and `apps/web`.** It did
  not always; two undefined identifiers reached running scripts because of it.
  A passing typecheck is still not proof a script runs — run the script.
- **`.env` lives at the repo root**, and `apps/web/.env` is a symlink to it.
  Scripts use `--env-file-if-exists`, so they also run on CI where there is no
  such file.
- **Never run `next build` while the dev server is up**, and clear
  `apps/web/.next` if the dev server starts serving stale modules.
- **`schools` and `debaters` are not season-scoped**, so they are never
  cleared and must be *upserted*.
- **Anything that reads a season must take the season.** A workbook, a cache
  path, a clearing `UPDATE`: each has silently used the wrong season at least
  once, and each time the output looked entirely normal.
- **All comparison and aggregation goes through `scripts/lib/standings.ts`,
  `scripts/lib/identity.ts`, `packages/ingest/src/matching.ts` or
  `buildSchoolIndex`.** Never write a new match key. Comparing normalized school
  strings directly — Tabroom writes "Menlo-Atherton High School" where the league
  writes "Menlo-Atherton" — silently dropped 784 scoring entries and put
  agreement at 9.5%.
- **A zero-point result is stored and never aggregated.** `rollup` filters on
  `points > 0`, so a team that competed and earned nothing is a fact the data
  holds and the tables do not show. 3,302 stored, 1,587 worth points.
- **An entry the league does not list is not a disagreement.** It has no
  official figure, so the reconciliation queue and both backtests exclude the
  `unlisted` cases rather than counting them as mismatches against a number
  nobody published.
- **Raw payloads are gitignored** (~800MB). A fresh clone cannot run the
  backtests until `npm run fetch` has re-fetched them.
- **`load` deletes a season's tournaments to rebuild it**, and every table
  referencing `tournaments` must cascade. `ratings` did not, so `load` failed
  outright on any season that had ever been rated — invisible until a season was
  reloaded for the first time in months.

## Where the remaining error lives

Catalogued in [09-data-quality.md](09-data-quality.md), and it is now small
enough to enumerate. Of the 25 entries where scoring from Tabroom disagrees with
the league, **16 are settled or absent rather than open**:

| | n | |
|---|---|---|
| UCLA | 10 | six prelims are in the payload, the league recorded five. **Ours stands.** |
| Ridge Debates | 4 | published four of twenty-eight teams; all 28 hand-entered |
| Cal Parli | 4 | three one-ballot same-school elims, unresolvable either way |
| Clackamas | 2 | a different-school closeout XXI.5.C does not provide for |
| NYPDL February OL | 5 | the breaking record — **the one genuinely open item** |

Separately, **four partnerships now hold a result the league does not list** —
Blair & Ray Chaudhuri, Patil & Malik, Squires & Luft, Hu & Qiu. Real Tabroom
results at tournaments the league scores. Whether it missed them or excluded
them deliberately is a question for the Reporting Director.

## Next

1. **Finish Phase 6.** Team, school and tournament pages, and head-to-head.
   The debater page is the template: identity resolved above the streaming
   boundary so it can answer with a real status, names through `DebaterLink`,
   and any figure a reader can add up derived from the same function the stored
   total is.
2. **Watch the first real tournament.** Everything has been exercised against an
   empty season or a complete one. A season with exactly one tournament is a
   third case, and the dry run that found four bugs suggests untested cases here
   contain things. The ratings cascade (mistake 42) would have broken the first
   2026-27 ingest that had a rating; assume there are others.
3. **Three dead mechanisms.** `manual_overrides` is declared with no reader or
   writer; `official_tournament_stats` is written every load and read by
   nothing; `Approval` is parsed, stored, and never consulted, so XXI.1.E/F is
   not enforced at all. Each is either a feature to finish or a table to delete,
   and a schema that promises something it does not do is worse than one that
   promises nothing.
4. **Analytics.** Deliberately held until the Privacy page existed, which it now
   does. Aggregate and cookieless, described on that page before it ships.
5. **Smaller:** a Seasons page; gating the reconciliation view to maintainers;
   the analysis scripts that still hardcode `rankings.zip`.

## Waiting on the user

None of it blocking:

- **Verifying suppression against a real flag.** The removal path is built and
  reviewed but has only ever run with `suppressed = false` on every row, because
  setting it true means writing to the live database the deployed site reads.
  Worth doing once, deliberately: flag one debater, check they read as withheld
  on the four tables and as an opponent on somebody else's page, that their own
  page 404s, and that school and partnership totals do not move. Then set it
  back.
- **The four unlisted results above** — are they the league's oversight or its
  judgement? Two are at NYPDL October OL, which suggests one cause rather than
  four.
- Whether a partnership follows the people or the registration. Both the
  standings and the rating currently follow the people.
- A custom domain, and whether `parli-pulse` is the public name.
