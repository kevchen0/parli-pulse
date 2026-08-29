# Current state and handoff

Read this first. [10-mistakes.md](10-mistakes.md) second, before touching
scoring, identity, or anything that reads a season — several bugs there were
reintroduced after being fixed, in tooling written later, and two of the newest
were only reachable once a *completed* season sat beside a live one.

---

## Where things stand

The site is public and demo-ready at
[parli-pulse.vercel.app](https://parli-pulse.vercel.app). Phases 0-7 complete,
Phase 6 half done. This session took it from "correct" to "front-facing":
closed to crawlers, given a working removal path and a contact form, and
rewritten throughout.

| | |
|---|---|
| Per-entry Article XXI agreement | **96%** (1532/1588) |
| Partnership season totals | **92% exact** (735/799) |
| The league's top 100 | **89% exact**, 95% within 2 points |
| Rating against the league's own ranking | **63.4%** vs 59.8% on held-out rounds |
| Rating against plain Elo | 63.4% vs **60.6%** — what the deviation buys |

Loaded for 2025-26: 98 tournaments, 4,946 entries, 25,851 ballots, 3,302 scored
results of which 1,587 are worth points, 806 partnerships, 1,194 debaters with
points, 47 member schools with points of 55 members, 387 ranked speakers of
1,831, 1,779 rated partnerships of which 387 clear the round gate, 830
reconciliation rows. 167 tests.

2026-27 is open and empty. Verified live this session: the sheet is registered,
lists 110 tournaments and **0 with a results link**, and the circuit calendar
already shows Harvard as `40344` on 2026-09-05. That is the correct state.

## Branches, and how work ships

**This is new, and it changes how everything below gets done.**

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

Full workflow, including where the merge note is written, in
[../docs/deploying.md](../docs/deploying.md).

**Branches do not isolate the database.** `drizzle-kit migrate` and every
pipeline script read `DATABASE_URL`, which is production on every branch and
from the maintainer's laptop. A migration or a `load` is a deploy in itself.

## What shipped this session

**Closed to crawlers.** `robots.txt` disallows everything and the root layout
sends `noindex, nofollow`. Both, because they do different jobs: robots.txt asks
a crawler not to fetch, and the header stops a page indexed from an inbound
link. The pages name minors, and a search result is a different exposure from a
page someone navigated to.

**The reconciliation view is unlisted**, at `/<season>/internal/reconciliation`,
with its six public links removed. It enumerates by name every place the
league's own spreadsheet and this engine disagree, which is a maintainer's tool.

**A removal path that reaches somebody.** `parlipulse@gmail.com`, in
`apps/web/lib/contact.ts` rather than typed into two pages. Before this the
Privacy page said "get in touch" and there was no `mailto:` anywhere in the app
— mistake 39's shape, a promise with nothing behind it.

**A feedback form.** `/api/feedback` stores the message in Postgres and then
emails it through Resend. Storing first means delivery is not what decides
whether a message survives. The same table rate-limits the form — 3 an hour and
10 a day per sender, counted from a salted SHA-256 of the client address, which
needs no infrastructure beyond the database already here. `parli_web` gained
INSERT and SELECT on that one table and stays SELECT-only everywhere else.

**Vercel Web Analytics**, with the Privacy page updated in the same commit
because it had committed to saying so before any shipped.

**Suppression exercised for real, for the first time.** The flag had only ever
run false on every row. Set true on one debater and checked: name replaced on
all four tables and as a partner on somebody else's profile, no link emitted,
profile 404, unfindable by search, and **every figure byte-identical** — school
total, both partnerships, debater row, speaker row. Set back; 0 suppressed rows
now. Search was then changed so a withheld name never matches, since filtering
on the displayed string made "withheld" list exactly the people who asked not to
be listed.

**Elo added to the rating comparison.** Glicko-2 was measured against the
league's points, a win rate and Bradley-Terry, but not against the obvious
simpler rating, so the choice rested on an argument rather than a number. Elo
with K swept to 48 scores 60.6% and 0.6559 against Glicko-2's 63.4% and 0.6380.

**The speaker floor moved to 10 and back to 20.** Ten fills the board earlier;
twenty is where extra ballots stop buying precision. The threshold is now
`MIN_BALLOTS` in `packages/speaks`, beside `MIN_SPREAD`, rather than a literal
in the script and a second literal in the page's prose.

**The whole site rewritten**, against a new style guide at
[../docs/writing-style.md](../docs/writing-style.md): what the register is, the
fifteen patterns cut from the copy with the examples they were cut from, and the
JSX mechanics that break a page.

**The methodology page is held back.** It was rebuilt this session — three
sections, MathML equations, a live agreement table — and then replaced on `main`
with "Coming soon!" because parts of it were not clear enough to publish. The
full version is on `method-rewrite`.

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
| `npm test` | 167 tests |
| `npm run dev --workspace @parli-pulse/web` | the site locally |

**Order matters:** `fetch` → `load` → `rollup` → `speaks` → `rate` →
`diagnostics` → `mark-ingest`.

`SOURCE=sheet` on `load`, the backtests or `diagnose` restores the league's own
inputs, which is what a backtest wants.

## Things that will bite you

Everything in the previous handoff still applies —
[04-architecture.md](04-architecture.md) has the full list — plus:

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
   public site does not have.
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

## Waiting on the user

- **The four unlisted results** — Blair & Ray Chaudhuri, Patil & Malik, Squires
  & Luft, Hu & Qiu. Real Tabroom results the league's `Entry` tab omits. Two are
  at NYPDL October OL, which suggests one cause rather than four. A question for
  the Reporting Director.
- **NYPDL February OL's breaking record**, the one genuinely open item among the
  25 scoring disagreements.
- Whether a partnership follows the people or the registration. Both the
  standings and the rating follow the people.
- A custom domain, and whether `parli-pulse` is the public name.
