# Current state and handoff

Read this first. [10-mistakes.md](10-mistakes.md) second, before touching
scoring, identity, or anything that reads a season — several bugs there were
reintroduced after being fixed, in tooling written later, and two of the newest
were only reachable once a *completed* season sat beside a live one.

---

## Where things stand

The site is public at [parli-pulse.vercel.app](https://parli-pulse.vercel.app),
indexed except for debater profiles, ingesting nightly. Phases 0-7 complete,
Phase 6 half done.

| | |
|---|---|
| Per-entry Article XXI agreement | **96%** (1532/1588) |
| Partnership season totals | **92% exact** (735/799) |
| The league's top 100 | **89% exact**, 95% within 2 points |
| Rating against the league's own ranking | **64.0%** vs 59.7% on held-out rounds |
| Rating against plain Elo | 64.0% vs **61.1%** |

Loaded for 2025-26: 98 tournaments, 4,946 entries, 25,851 ballots, 3,302 scored
results of which 1,587 are worth points, 806 partnerships, 1,194 debaters with
points, 47 member schools with points of 55 members, 387 ranked speakers of
1,831, 1,779 rated partnerships of which 387 clear the round gate, 830
reconciliation rows. 186 tests.

2026-27 is open and empty: the sheet is registered, lists 110 tournaments and
**0 with a results link**, and the circuit calendar shows Harvard as `40344` on
2026-09-05. That is the correct state.

## Branches, and how work ships

**This is how everything gets done now.**

| Branch | Holds | Preview |
|---|---|---|
| `main` | what is live | parli-pulse.vercel.app |
| `dev` | day-to-day edits; identical to `main` between merges | `…-git-dev-kevchen01.vercel.app` |
| `method-rewrite` | the full methodology page while it is rewritten | `…-git-method-rewrite-kevchen01.vercel.app` |

Nothing is committed to `main` directly. Work happens on `dev` and reaches
production through a **squash-merged pull request**, so `main`'s history is a
list of releases rather than a list of edits. `dev` is reset to `main` after
each merge, because squashing leaves the two diverged even though the content
matches.

`method-rewrite` is separate because it holds an unfinished page: if the rewrite
lived on `dev`, every footnote edit shipped from `dev` would drag it into
production. Merging `main` into it conflicts only on
`apps/web/app/method/page.tsx`, and the resolution is always `--ours`.

**Merge notes are one line.** The squash commit gets a title saying what
shipped and an empty description, so `main` reads as a scannable list of
releases. The reasoning lives in the `dev` commits the pull request preserves,
and in this directory. Full workflow in
[../docs/deploying.md](../docs/deploying.md).

**Branches do not isolate the database.** `drizzle-kit migrate` and every
pipeline script read `DATABASE_URL`, which is production on every branch and
from the maintainer's laptop. A migration or a `load` is a deploy in itself.

## What shipped this session

**The boards were dead in production, and had been for some time.** Sorting,
paging and search all did nothing on the live site: a click landed and React
made no change to the page. Every Suspense boundary on the site was stuck.
React 19.2 marks a streamed boundary `$~`, queued for reveal, and on
`next 15.5.23` with `react-dom 19.2.8` the reveal never completes — the rows
arrive in a `<template>`, the fallback stays on screen, and nothing inside the
boundary ever hydrates. It looks correct for a moment, because the server HTML
paints before React takes it away again, which is why a screenshot check missed
it.

Checking out `baa80c7` and building it proved this **predates this session's
work**: the Teams board never left its skeleton and the ratings sort was already
inert. Every boundary is now gone, including the route-level `loading.tsx`
files. That is not a fix for the framework bug, it is declining to depend on it.
Cost: no cold-load shell, and a cold load waits for its data.

**Every board filters as you type.** The three points boards searched through
the server — a `?q=`, a Search button, a fresh render per query. They now filter
in state like ratings and speakers always did, on a field that is a ruled line
rather than a box, with `?q=` kept shareable through `replaceState`. Paging
arithmetic moved to `apps/web/lib/paging.ts` with tests.

**The debater profile is one list.** Season and Round-by-round listed the same
tournaments twice; the rounds now open inside the season table. The rating card
and the partnerships table both carry the figure the board is ordered on.

**`Established` and `Rating` became `Rating` and `Raw estimate`.** The old pair
put the plain, confident name on the number the board deliberately does not rank
by. Renamed across the board, the profile and the footnotes, and on
`method-rewrite` so the vocabulary cannot disagree with itself in production.
Two footnote links pointed at `/method#prior`, which has never existed.

**A tied panel is no longer a defeat.** Three tournaments ran two-judge prelims
and 318 rounds across 133 entries came back 1-1. The ingest asks
`won * 2 > total` and has no third case, so every deadlock was published as a
loss — Georgatos read 3-4 at the TOC on a card that also said Octafinalist. The
record is now counted off the rounds the page already holds and reads 3-1-3.
**Scoring is untouched:** `prelimPoints(wins, losses)` still sees those 318
rounds as losses. See Next.

**A tournament is two rating periods now, prelims then elims.** A period means
"these rounds happened at once, judge them against a common prior", which is
false across the two phases: an elimination round is contested by exactly the
teams that just won their prelims. Grouped as one weekend, a season's first
tournament pays the same for beating the eventual champion as for beating an
0-5 team, because every opponent is still at 1500, and Glicko never revisits it.

Measured on the February held-out set: 63.4% to 64.0%, log loss 0.6380 to
0.6364, and the gain sits only where either team had fewer than ten prior
rounds. Measured on an early-season window instead -- train August-September,
test November -- it is roughly twice that, and **elimination rounds go 54.6% to
64.9%**, which is the failure this was aimed at: without the split the model
predicted early elims at barely better than a coin flip. Elo and Bradley-Terry
gain on the same rounds, so it is the information ordering rather than anything
about Glicko.

Both configurations were run twice and diffed before the numbers were quoted,
because mistake 30 is a validation that disagreed with itself by exactly
63.4 against 64.0. They are byte-identical run to run.

The board's top 50 keeps 47 of its 50 teams; the three that change sit at ranks
39 to 50, and 35 of the 47 move by a place or several. The top 15 is unmoved.

**Repository shape.** `scripts/` split into `pipeline/`, `measure/` and
`probe/` — nine of the twenty-six were in no npm script at all. The README is
now a public-facing document; the runbook moved to
[../docs/pipeline.md](../docs/pipeline.md).

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
| `npm run validate:rating` | the held-out comparison, now including Elo |
| `npm run backtest` | fields, per-entry, partnerships |
| `npm test` | 186 tests |
| `npm run dev --workspace @parli-pulse/web` | the site locally |

**Order matters:** `fetch` → `load` → `rollup` → `speaks` → `rate` →
`diagnostics` → `mark-ingest`.

`SOURCE=sheet` on `load`, the backtests or `diagnose` restores the league's own
inputs, which is what a backtest wants.

## Things that will bite you

Everything in the previous handoff still applies —
[04-architecture.md](04-architecture.md) has the full list — plus:

- **Do not run `next build` while the dev server is running.** They share
  `.next`, and the result is `Cannot find module './vendor-chunks/…'` on every
  page. Stop the server, `rm -rf apps/web/.next`, rebuild. Cost about twenty
  minutes this session before it was recognised as cache damage rather than a
  code fault.
- **Do not add a Suspense boundary** until the framework pin is resolved. Every
  one of them strands its contents unhydrated on the current versions, and the
  page looks right long enough to pass a screenshot check. See "What shipped".
- **`.next` does not switch with the branch.** After changing branches a running
  dev server can serve the old branch's pages. Stop it, `rm -rf apps/web/.next`,
  restart, in that order. Deleting it while the server runs breaks the server,
  which happened twice this session.
- **A page's freshness line is a claim about a pipeline that is still expected
  to run.** It is rendered only for a season that is not `final`. See mistake 45.
- **Footnote ids must be numeric.** `FootnoteRef` renders its note as both the
  anchor suffix and the visible label. See mistake 44.
- **Reading a property that does not exist on that layer returns `undefined`,
  not an error.** Two figures were reported wrong this session from field names
  belonging to a different layer of the same pipeline.

## Next

1. **Rewrite the methodology page** on `method-rewrite`. It is the only page the
   public site does not have. **Its validation table is now stale**: it carries
   63.4%, 0.6380, a 3.7-point gap and a 1.2-to-6.1 interval, all measured before
   two-period rating. The current figures are 64.0%, 0.6364, 4.3 points and 1.9
   to 6.7. Regenerate them from a run rather than hand-editing, and the same
   goes for the Elo gap and the shrink-before-predicting comparison.
2. **Watch the first real tournament.** Harvard is Sept 5-6, and a season
   holding exactly one tournament has still never run. The site does not update
   when the tournament ends — it updates when the league writes a results link
   into the sheet's `Tournaments` tab, which is days to weeks later.
3. **Finish Phase 6.** Team, school and tournament pages, and head-to-head.
4. **Three dead mechanisms.** `manual_overrides` has no reader or writer;
   `official_tournament_stats` is written every load and read by nothing;
   `Approval` is parsed and never consulted, so XXI.1.E/F is unenforced.
5. **Smaller:** a Seasons page; the analysis scripts that hardcode
   `rankings.zip`; `/rankings` and the masthead's Rankings link both resolve to
   the calendar's current season, which is empty until Harvard is scored.
6. **Decide what a tie is worth under XXI.3.A.** 318 prelim rounds across 133
   entries are shown as ties and scored as losses. The rules table is keyed on
   wins and losses and does not contemplate one. Recovering the real result from
   Tabroom's published record is the honest answer — these were not really ties,
   a two-judge deadlock got resolved somehow and Tabroom knows how — and it
   needs an ingest change and a reload, so snapshot first.
7. **Pin `next` and `react-dom`.** `package.json` asks for `^15.1.3` and
   `^19.0.0`; the carets resolved to 15.5.23 and 19.2.8, where streaming is
   broken. Pinning to a working pair would let the loading states come back; the
   code for them is in git history at the parent of `85082ce`.
8. **Make the site findable.** It is not indexed at all: searching the exact
   string `"parli-pulse"` on 2026-08-31 returned the league's own pages and
   nothing of ours. The earlier note here assumed it would be found on its own
   within weeks. That was wrong, and four separate things are in the way.

   The setup itself is sound -- `robots.txt` allows everything but profiles, the
   sitemap serves 15 valid URLs, and production carries no stray
   `X-Robots-Tag`. What is missing is everything around it.

   1. **Nobody has told Google it exists.** Verify the property in Search
      Console, submit the sitemap, request indexing on the homepage. Google
      finds a new site by following a link to it, and no link to this one
      exists, so there is no path by which it would be crawled at all.
   2. **Nothing links to it.** The console gets it crawled; links are what get
      it ranked. This needs the league, a coach, or a post somewhere debate
      people read, and it is the slowest of the four.
   3. **Twelve of the fifteen sitemap URLs share one title.** Every board
      inherits `parli-pulse — NPDL rankings` and the layout's description; only
      `/about`, `/method` and `/privacy` set their own. Google reads a dozen
      near-duplicates and indexes one. **This is the code fix**, and the pattern
      to copy is the debater route's `generateMetadata`: `Ratings — 2025–26 —
      Parli Pulse`, with a description naming the season and the board.
   4. **`*.vercel.app` is a shared host on the Public Suffix List**, which
      Google deprioritises. A custom domain is the largest structural
      improvement available and is already an open question below.

   One structural note: `/` is a 307 to the current season's points board, so
   there is no indexable homepage -- the sitemap's priority 1.0 URL is a
   signpost. The 307 is *correct* and must stay temporary, for the reason
   `/rankings` gives: the destination changes every August and a permanent
   redirect would be cached long past the point it is true. The cost is that
   nothing on the site is built to answer a search for its own name.

## Waiting on the user

- **`packages/ingest/src/manual-results.ts` holds data that is in no public
  source.** 28 of its 41 entries are `source: 'reported'` — the Ridge Debates
  field, supplied by the league — and the file's own
  `INCOMPLETE_TOURNAMENTS` note says "the rest exist in no public source". That
  is 56 minors' surnames with school and placement, committed to a public MIT
  repo. The other 13 entries are `speechwire` and are fine. Two problems: it
  fails the stated bar of publishing only what Tabroom or SpeechWire already
  carry, and a removal request cannot reach it, because suppression is a column
  in the database and this is a file. Moving the reported rows to a gitignored
  file under `data/` matches how the raw payloads are already handled, but it
  makes a clone score the season differently, and it does not erase git history.
- **The four unlisted results** — Blair & Ray Chaudhuri, Patil & Malik, Squires
  & Luft, Hu & Qiu. Real Tabroom results the league's `Entry` tab omits. Two are
  at NYPDL October OL, which suggests one cause rather than four. A question for
  the Reporting Director.
- **NYPDL February OL's breaking record**, the one genuinely open item among the
  25 scoring disagreements.
- Whether a partnership follows the people or the registration. Both the
  standings and the rating follow the people.
- A custom domain, and whether `parli-pulse` is the public name.
