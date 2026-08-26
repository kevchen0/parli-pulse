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
| Per-entry Article XXI agreement | **98%** (1529/1564) |
| Partnership season totals | **87.1% exact** (727/835) |
| The league's top 100 | **92% exact**, 95% within 2% |
| Rating against the league's own ranking | **63.4%** vs 59.8% on held-out rounds |

Loaded for 2025-26: 97 tournaments, 4,907 entries, 25,795 ballots, 799
partnerships, 1,183 debaters with points, 47 member schools, 387 ranked
speakers, 1,776 rated partnerships of which 387 clear the round gate, 830
reconciliation rows, 35 open disagreements. 140 tests.

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
| `npm run load` | rebuild a season from cached payloads (`SEASON=` to pick) |
| `npm run rollup` | identity merging, then team/debater/school standings |
| `npm run speaks` | judge-normalized speaker points |
| `npm run rate` | Glicko-2 partnership ratings with the field prior |
| `npm run diagnostics` | the reconciliation the site displays |
| `npm run mark-ingest` | records that the pipeline finished; the site reads it |
| `npm run validate:rating` | the held-out comparison against the league ranking |
| `npm run backtest` | fields, per-entry, partnerships |
| `npm run compare` / `npm run diagnose` | top-N accuracy, cause attribution |
| `npm test` | 124 tests: rules, matcher, speaks, rating, Tabroom client |
| `npm run dev --workspace @parli-pulse/web` | the site locally |

**Order matters:** `fetch` → `load` → `rollup` → `speaks` → `rate` →
`diagnostics` → `mark-ingest`. `rollup` decides who is one person and who is two, and
everything after it groups by the identities it settles.

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
  `scripts/lib/identity.ts` or `packages/ingest/src/matching.ts`.** Never write
  a new match key.
- **Raw payloads are gitignored** (~800MB). A fresh clone cannot run the
  backtests until `npm run fetch` has re-fetched them.

## Where the remaining error lives

Catalogued in [09-data-quality.md](09-data-quality.md). Most of it is not ours:
~30 results at tournaments that published little or nothing to Tabroom, 14 at El
Cerrito where the league applied an adjustment 27 of 28 comparable tournaments
did not, ~8 where the league splits one partnership across two registrations,
6 at UCLA, ~5 human `manual_adj` overrides, and 3 league typos creating phantom
teams. The realistic ceiling without manual entry is about 88-89%.

## Next

1. **Finish Phase 6.** Team, school and tournament pages, and head-to-head.
   The debater page is the template: identity resolved above the streaming
   boundary so it can answer with a real status, names through `DebaterLink`,
   and any figure a reader can add up derived from the same function the stored
   total is.
2. **Watch the first real tournament.** Everything has been exercised against an
   empty season or a complete one. A season with exactly one tournament is a
   third case, and the dry run that found four bugs suggests untested cases here
   contain things.
3. **Analytics.** Deliberately held until the Privacy page existed, which it now
   does. Aggregate and cookieless, described on that page before it ships.
4. **Smaller:** a Seasons page; gating the reconciliation view to maintainers;
   the nine analysis scripts that still hardcode `rankings.zip`.

## Waiting on the user

None of it blocking:

- **Verifying suppression against a real flag.** The removal path is built and
  reviewed but has only ever run with `suppressed = false` on every row, because
  setting it true means writing to the live database the deployed site reads.
  Worth doing once, deliberately: flag one debater, check they read as withheld
  on the four tables and as an opponent on somebody else's page, that their own
  page 404s, and that school and partnership totals do not move. Then set it
  back.
- Whether a partnership follows the people or the registration. Both the
  standings and the rating currently follow the people.
- Manual entry for Ridge Debates, worth −54 to Ridge's school total.
- A custom domain, and whether `parli-pulse` is the public name.
