# Current state and handoff

Read this first. [10-mistakes.md](10-mistakes.md) second, before touching
scoring or identity — several bugs there were reintroduced after being fixed,
in tooling written later.

---

## Where things stand

Phases 0-5 complete. **Phase 6 (profiles) is next**, and it is the one that
needs a decision from the user first — see below.

| | |
|---|---|
| Per-entry Article XXI agreement | **98%** (1529/1564) |
| NPDL-TOC, NYPDL | **100%** each |
| CHSSA | 99% |
| Regular invitationals | 96% |
| Partnership season totals, all 835 | **87% exact** |
| The league's top 100 | **92% exact**, 95% within 2% |

Loaded for 2025-26: 97 tournaments, 4,907 entries, 25,795 ballots, 799
partnerships, 1,183 debaters with points, 47 member schools, 387 ranked
speakers, 35 open disagreements.

Live at `/rankings`: teams, debaters, schools, speakers, ratings, and a
diagnostic tab reconciling every partnership against the league result by
result.

**Phase 5 shipped.** Glicko-2 on partnerships with a field prior, at
`/rankings/ratings`, explained for a reader at `/rankings/ratings/method`. The
gate was that it beat "higher Article XXI points wins" on held-out rounds or be
reported as a failure; on 2,209 rounds from February 2026 it predicted 63.4%
against the league ranking's 59.8%, at a log loss of 0.638 against 0.665 — a 3.6
point gap, 95% interval 1.2 to 6.0 on a paired bootstrap.

**The board is ordered on the shrunk rating; predictions use the raw one.**
Glicko alone handed the top of the board to a twelve-round partnership who had
spent 92% of those rounds inside their own region — deviation counts rounds
debated, not whether they connect to anything. Shrinking each rating toward the
field by its deviation fixes the ordering; shrinking before *predicting* makes
prediction worse, because the win probability already widens by both deviations.
Two plausible fixes that failed are recorded in [05-metrics.md](05-metrics.md)
so they are not tried again.

| | |
|---|---|
| Rated rounds | 7,699 over 78 tournaments |
| Partnerships rated | 1,776, of which **387** clear the ten-round gate |
| Coverage of league partnerships | 740 of 799 — the other 59 have no decided open round in Tabroom at all |

## Commands

| | |
|---|---|
| `npm run load` | rebuild a season from cached payloads (`SEASON=` to pick) |
| `npm run rollup` | identity merging, then team/debater/school standings |
| `npm run speaks` | judge-normalized speaker points |
| `npm run rate` | Glicko-2 partnership ratings, with the field prior |
| `npm run validate:rating` | the held-out comparison against the league ranking |
| `npm run diagnostics` | the reconciliation the site displays |
| `npm run backtest` | fields, per-entry, partnerships |
| `npm run compare` / `npm run diagnose` | top-N accuracy, cause attribution |
| `npm test` | 104 tests: the rules engine, the matcher, speaks, and the rating |

**Order matters:** `load` → `rollup` → `speaks` → `rate` → `diagnostics`.
`rate` must follow `rollup`: identity merging is what decides who is one person
and who is two, and a rating computed before it splits a partnership's season
across two ratings too thin to publish.

## Things that will bite you

- **Node runs `.ts` directly.** No build step, no tsx. Imports use explicit
  `.ts` extensions so Node and Vitest agree.
- **`.env` lives at the repo root**, and `apps/web/.env` is a symlink to it —
  Next reads env from the app directory, not the root. Vercel uses its own
  dashboard variables.
- **Never run `next build` while the dev server is up.** It clobbers the dev
  cache and the page dies with a webpack error. Stop the server, `rm -rf
  apps/web/.next`, restart. This cost two debugging cycles.
- **`schools` and `debaters` are not season-scoped**, so they are never
  cleared. They must be *upserted*. Inserting with `onConflictDoNothing` leaves
  stale rows and a correction silently does nothing — this has bitten three
  times, most visibly when a fixed membership flag changed no rows.
- **All comparison and aggregation goes through `scripts/lib/standings.ts`,
  `scripts/lib/identity.ts`, or `packages/ingest/src/matching.ts`.** Never write
  a new match key. Surnames alone collapse "Egleson & S. Goyal" into
  "Egleson & N. Goyal", two real Menlo teams 73 points apart, and it will invent
  data problems that do not exist.
- **A partnership is not just its pair of canonical debater ids.** It is that
  pair after the school-and-surnames collapse in `scripts/lib/identity.ts`,
  which `rollup` and `rate` both call. Keying on the raw pair rates one team as
  two on half the evidence each.
- **A panel is one round, and its size is the ballots on _one_ side of a
  section.** Tabroom writes a ballot per judge per entry, so a section's total
  is double the panel. Getting this wrong reads every single-judge round as a
  tie; it has now been the same mistake three times, in three different files.
- **Node's type stripping rejects parameter properties.** `constructor(private
  readonly x: T) {}` typechecks and then fails at runtime. Declare the field.
- **A new workspace package needs `npm install`** before Next can resolve
  `@parli-pulse/<name>`. Scripts import by relative path and never notice.
- **Raw payloads are gitignored** (~370MB in `data/raw/`). A fresh clone cannot
  run the backtests until they are re-fetched from Tabroom.

## Where the remaining error lives

Catalogued in [09-data-quality.md](09-data-quality.md). Most of it is not ours:

- **~30 results** at tournaments that published little or nothing to Tabroom
  (Ridge Debates published 4 of 28 teams; Randolph Fall Classic, CBSR 3, Ryan
  Rutledge). Manual entry is the only route.
- **14 at El Cerrito**, where the league applied a −1 adjustment that 27 of 28
  comparable tournaments did not. Probably their error.
- **~8** where the league splits one partnership across two registrations and
  we merge them. A modelling difference.
- **6 at UCLA**, where Tabroom shows six prelims and the league counted five.
- **~5** human `manual_adj` overrides, and **3** league typos creating phantom
  teams.

Realistic ceiling without manual entry is about 88-89%.

## Next

1. **Phase 6, profiles.** The highest user value left — the rankings are still a
   dead end with nothing to click into, and there are now five measures per team
   with nowhere to show them together. Gated on the minors-privacy decision in
   [07-open-questions.md](07-open-questions.md), which is the one thing actually
   waiting on the user.
2. **The individual-level rating.** Predicted in advance to beat the partnership
   one, and still untested. The harness for it exists —
   `scripts/validate-rating.ts` takes a new model as one class with `predict`
   and `observe`, and the three-way split means the answer would be honest. The
   partnership seeding is a weak form of the same pooling and was by far the
   largest single gain, which is a reason to expect the full version to win.
3. **Phase 7, live season**, before the 2026-27 opener (Harvard, Sept 5-6).

## Waiting on the user

None of it blocking:

- Whether a partnership follows the people or the registration. This now
  affects the rating as well as the standings; both currently follow the people.
- Manual entry for Ridge Debates, worth −54 to Ridge's school total.
- Which season the alternative non-break point table belongs to, before
  2026-27 opens.
- What may be shown on a debater profile page.
