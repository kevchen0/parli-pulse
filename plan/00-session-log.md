# Session log

Running record of what changed and why, so any agent or person can pick this up
cold. Newest first. Keep entries short; put durable conclusions in
[02-findings.md](02-findings.md) and link them from here.

---

## 2026-08-21 — Phases 0-3 complete, site live

**State:** rankings and diagnostic pages deployed, reading from Neon.
Per-entry **98%**, partnerships **87% exact** (top 100: **92%**, 95% within 2%).

### Commands
| | |
|---|---|
| `npm run load` | rebuild a season from cached payloads (`SEASON=` to pick) |
| `npm run rollup` | recompute standings and identity merging |
| `npm run diagnostics` | rebuild the reconciliation the site shows |
| `npm run backtest` | fields, per-entry, partnerships |
| `npm run compare` / `diagnose` | top-N accuracy and cause attribution |

Order matters: `load` → `rollup` → `diagnostics`.

### Where the remaining error lives
Catalogued in [09-data-quality.md](09-data-quality.md). Of the ~110
partnerships that differ or have no standing, most are structural:

- **~30** results at tournaments that published little or nothing to Tabroom
  (Ridge Debates, Randolph Fall Classic, CBSR 3, Ryan Rutledge). Manual entry
  is the only route.
- **14** at El Cerrito, where the league applied a −1 adjustment that 27 of 28
  comparable tournaments did not. Probably their error.
- **~8** where the league splits one partnership across two registrations and
  we merge them — a modelling difference, not a bug.
- **6** at UCLA, where Tabroom shows six prelims and the league counted five.
- **~5** human `manual_adj` overrides in the sheet.
- **3** league typos creating phantom teams.

### Phase 4 — speaker points (done)
`/rankings/speakers`, built by `npm run speaks`. **Open divisions only**, per
XXI.1.A — novice and JV are a different competition on a different curve, and
mixing them distorts a judge's baseline as well as filling the board with
debaters who never entered the division being ranked. A tournament running one
undifferentiated "Parli" division counts as open, which the classifier already
did. 27,013 scores normalized; 387 debaters clear the 20-ballot threshold.

**Why more debaters than the team table has**: 1,831 have open speaker scores
against 1,183 in team standings, because **the league records only results that
earned points** — its `Entry` tab has no zero-point rows at all, lowest is 3.
A debater with good speaks and a losing record appears on one and not the
other. That is correct, and the page says so.

Method in `packages/speaks`: scores map onto a canonical 25-30 scale from a
**config table** (never inferred from the observed minimum), then each judge's
baseline is a median and an interquartile spread — robust, so one punitive
score cannot shift everyone else that judge ranked. Both centre and spread are
shrunk toward the division pool by sample size, since a judge with three
ballots can show almost no spread by chance.

Pool: open n=27,013, centre 27.86, spread 1.11.

**The correction is large.** The biggest movers are all NYPDL-region schools —
Dalton, Horace Mann, Bard Queens, Princeton — rising 350-450 places, because
NYPDL's 23-30 scale makes their raw means look low. That is the whole point of
the exercise.

Threshold chosen from the data: the spread of season means is 0.75 sd among
debaters with ten ballots or fewer, 0.52 by twenty, 0.41 by thirty. Each row
also carries a 95% interval, so a 20-ballot debater reads +-0.34 against a
70-ballot debater's +-0.21 rather than looking equally certain.

**Two debater populations, both correct**: 1,185 have Article XXI points;
1,831 have open-division speaker ballots (935 in both). The league records
only point-earning results, so a losing record with good speaks appears on one
board and not the other. The pages label which is which.

**Membership**: XXI.9.A ranks member schools only. `SchoolList` names all 379
schools seen in the season, not members -- the league's own `School` tab is the
member list, 56 of them. School rankings now cover 47 rather than 156. Note
`schools` rows are not season-scoped and so must be **upserted**, not inserted
with `onConflictDoNothing`, or a corrected flag silently does nothing.

### Next
- **Phase 5, Glicko-2.** Needs no input.
- Manual-entry path for the tournaments in 09-data-quality, the only way past
  ~88% on standings.

## 2026-08-20 — Phase 0 + field-size backtest

**State:** Phase 0 essentially complete. Stage-1 (field size) backtest running
against the official sheet. Points engine not yet written.

### Done
- Monorepo scaffold: npm workspaces, TypeScript, Vitest. **Node 26 runs `.ts`
  files natively**, so scripts run with plain `node scripts/foo.ts` — no build
  step, no tsx. Imports use explicit `.ts` extensions so Node and Vitest agree.
- Installed Node via Homebrew (was absent).
- `packages/rules` — Article XXI constants incl. the full Elim Points Table,
  plus lookup helpers. **47 tests passing.**
- `packages/ingest` — Tabroom payload types, division classifier, normalizer
  with field-size computation, official-sheet reader (`fflate` for the zip).
- `data/raw/tabroom/` — **95 tournament payloads cached** (~370MB, gitignored).
  Note: circuit 179 lists only sanctioned invitationals (44); the sheet's
  `Tournaments` tab has 95 including CHSSA league events and state qualifiers.
- `scripts/backtest-fields.ts`, `diag-fields.ts`, `calibrate-forfeits.ts`,
  `inspect-forfeits.ts`.

### Current backtest — run `npm run backtest`; output in `docs/backtest-report.txt`

**Stage 1 — field sizes** (vs `Tournaments` tab, published cells only)

| metric | match |
|---|---|
| open field | 72/80 (90%) |
| n/jv field | 81/92 (88%) |
| AFS | 63/80 (79%) |
| elim field | 75/79 (95%) |
| prelim # | 70/79 (89%) |

**Stage 2 — per-entry points** (vs `Entry` tab): **1484/1535 (97%)**

| tournament type | match |
|---|---|
| NYPDL | 459/460 (100%) |
| CHSSA (incl. XXI.4.C qualifiers) | 298/302 (99%) |
| Regular invitationals | 666/707 (94%) |
| NPDL-TOC (XXI.4.A) | 61/66 (92%) |
| OSAA | no rows in 2025-26 |

breaking teams 97% · prelims-only 96% · hybrids 100% · adjustments 100%

By match tier: exact-initials 97%, exact-surnames 97%, maverick 100%,
fuzzy-surname 100%.

**Partnerships** (vs `team_calc`): **701/775 (90%) exact**, 94% within 2 points.
Restricted to teams whose every result we reproduce: **701/706 = 99%**.
Failure attribution: 48/74 a per-entry score disagrees, 21/74 missing a
tournament, 5/74 aggregation-only.

**Aggregates**: individual 93%, school 65%.

**Coverage**: 47 unmatched sheet rows (was 255), 2 ambiguous, 55 partnerships
with no Tabroom data (was 155). What remains is mostly Ridge Debates, which
published almost nothing, and three tournaments with no payload at all.

### Key decisions made this session
-1. **Entity matching rebuilt** (`packages/ingest/src/matching.ts`).
   Surname-pair keys silently collided -- CFL 3 contains two different
   `He & Zhang` partnerships, and one was overwriting the other. Matching is
   now tiered and one-to-one, disambiguates on first initials (the sheet writes
   `Ma. Qiu` / `Me. Qiu` for siblings), allows a Damerau near-miss only when
   the school agrees, and **reports ambiguity rather than guessing**. Entries
   known only from ballots recover names from the entry label. Unmatched rows
   255 -> 47.
0. **Rule-order and data-shape fixes found by backtesting** (81% -> 91%):
   - **The XXI.3.B points floor lifts the *base*, then adjustments apply on
     top** — it is not a floor on the final total. NYPDL 88% -> 98%. Settles
     open question Q4.
   - **XXI.4.A's break penalty applies to non-breaking TOC teams too** (their
     totals are odd numbers, impossible from a 2-per-ballot schedule).
   - **A prelim round is won on a majority of ballots, not per ballot** —
     panelled prelims otherwise produce a 6-0 record in a 4-round tournament.
   - **A prelim bye is a win**, not an unplayed round.
   - **`Final Places` decides the championship round.** Round data cannot
     distinguish a closeout (everyone champion) from an unentered final
     (nobody champion), and they differ by 6 points in every band. This is the
     only judgement place-labels are trusted with.
1. **Elim data comes from `rounds[]`/`sections[]`, never from `Bracket` result
   sets or place labels.** A survey found 41+ label spellings for 7 levels
   (`Octos`/`Octofina`/`Octafina`/`Octas`/`Octo`/`Octs`/`OCT`/`VO`...), some
   truncated to 8 chars. Section count is exact.
2. **Consolation brackets must be split off.** NYPDL runs a main and a novice
   bracket inside one `PARLI` event with interleaved rounds. Implemented
   `partitionElimRounds()` — walk back from the championship keeping rounds
   that share teams. Elim-field match went 53% → 95%.
3. **Forfeit exclusion (XXI.2.A) is `dropped` OR ≥3 missing prelims**, not the
   literal "≥2 unscored". Calibrated across 84 tournaments: literal reading 62%,
   chosen rule 88%. Unscored ballots are usually un-entered results.
   **Flagged for the Reporting Director** — see 07 Q26.
4. **`highhigh` is a prelim pairing type.** Missing it cost the whole CHSSA
   slate; prelim-# match 58% → 74%.
5. **Phantom events** (0 entries, 0 ballots) are excluded. Stanford lists an
   unused `Parli - Open` beside the real `Parli - TOC`.
6. **Middle school counts toward N/JV.**

### Corrections to earlier claims
Three "verified" champion scores in the first plan draft were wrong — I had
counted raw entries and bracket slots instead of adjusted fields and actual
breaks. Corrected and re-verified against the `Entry` tab: **Berkeley 31**
(was 32), **Cal 28** (was 29), **Nueva 27** before walkover / 25 after (was 29).

### Also done this session
- `packages/rules/src/score.ts` — XXI.2/3/5 scoring, XXI.4.A TOC ballot
  schedule, XXI.4.C qualifier points, weighted totals. **Season-versioned**
  (`rulesForSeason`) because NPDL revises the Board Code each July.
- `scripts/backtest-points.ts` — Stage 2 + Stage 3, sliced by category, result
  type, special population, and rule component.
- Entity matching by normalized surname pair (255 sheet rows still unmatched).

### Standings accuracy (top 100, vs `team_calc` / `School`)
teams **76% exact**, 81% within 2%; schools **43% exact**, 55% within 2%.
Run `npm run compare` and `npm run diagnose`.

Two bugs found by diagnosing this, both in the load path rather than the
engine, and both invisible to the per-entry backtest:
1. Entries known only from ballots got no debater rows at all, so their points
   scored correctly and then vanished from every rollup (9.6% of scored
   results, concentrated in the CHSSA slate).
2. Those same entries have no student records, and the XXI.1.G two-person test
   read that as a zero-person team, excluding genuine results.

**Beware:** comparison tooling must use `scripts/lib/standings.ts`, not a
surname key. Surnames alone collapse "Egleson & S. Goyal" into
"Egleson & N. Goyal" -- two real Menlo teams 73 points apart -- and invent
data problems that do not exist.

### Diagnostic page
`/rankings/diagnostic` reconciles all 835 partnerships against the league's
standings, result by result. **86.2% exact.** Built by
`npm run diagnostics` into `standing_diagnostics`; the per-tournament
breakdown is read from the database, not recomputed, so it always sums to the
total the site displays.

It exposed the opposite of what I first assumed. The problem was **under**-merging:
one partnership existing as several team rows because their registrations
produced debater records that never unified. Diamond Bar's Liu & Zhu appeared
at 37.5, 17.3 and 9.0; they now read 47.5, matching the league exactly.

Identity now unions over two keys — full name across schools, and
school-plus-surname for label-recovered records with no first name — guarded
by two distinctness signals: different first names (allowing abbreviations,
since Tabroom writes "M" for "Melina") and different partners at one
tournament.

### Next
- 44 partnerships still have no standing; a long tail, mostly school-key
  mismatches where the canonical name carries a qualifier.
- Tournament and profile pages; search/filter on the ranking tables.
- Glicko-2 (Phase 5) and speaker normalization (Phase 4).
- Speaker normalization (Phase 4): scale config per event — **YFL 1 uses 0-100**,
  NYPDL 23-30, everything else 25-30.
- Smaller: `Regular invitationals` at 94% is the weakest large category.

### Identity resolution (two problems, both solved)
1. **Tabroom student ids are stable per chapter, not per person.** A debater
   who also enters under a club or independent registration gets a second id,
   splitting their season. Stuyvesant's top team competed as both "Stuyvesant"
   and "Rodda's Disciples", and their 83 points were splitting in two.
   Merged by name, but only where partners corroborate: two same-named ids at
   one tournament with *different* partners are different people (there really
   are two Jessica Lius), while the same partner twice is one person entered
   twice. 150 records merged; Georgatos & Miller now read 83.0, matching the
   sheet exactly.
2. **Clubs and academies need an affiliation index**
   (`packages/ingest/src/school-aliases.ts`) — "Lucent Debate Academy" is
   Campolindo, "Rodda's Disciples" is Stuyvesant. Seeded by
   `scripts/discover-aliases.ts`, which compares Tabroom's school against the
   league-credited one, **excluding hybrids** (they look identical to aliases
   but are not). 26 confident entries; the file is meant to be hand-edited.

### Infrastructure (live)
Neon Postgres provisioned, 23 tables migrated, Vercel deploying from
`apps/web`. `npm run load` rebuilds a season from the cached payloads; it
deletes and reinserts rather than merging, so a reload always reflects the
current engine. `SEASON=2024-25 npm run load` is how a backfill would run once
those payloads are cached — the schema and loader are season-keyed throughout.

Rankings pages live at `/rankings` (teams, debaters, schools), rendered from
Postgres. `npm run load` then `npm run rollup` refreshes them.

**Local builds need `apps/web/.env`** — Next reads env from the app directory,
not the repo root. It is a symlink to the root `.env`; Vercel uses its own
dashboard variables instead.

Loaded for 2025-26: 96 tournaments, 150 events, 4,872 entries, 3,127 debaters,
2,967 judges, 26,146 ballots, 32,267 speaker scores, 1,535 scored results,
51 open disagreements.

### Schema notes
`packages/db/src/schema.ts` holds the Drizzle schema; `npm run db:generate`
regenerates migrations. Two deliberate choices: official figures are mirrored
into separate `official*` tables and never merged with ours, and every Article
XXI adjustment gets its own column so a disagreement names the rule that
diverged rather than an opaque total.

### Blocked
- Neon + Vercel provisioning (needs your accounts).
- Q9 CHSSA/OSAA scoring specifics; Q18 which season starts the "live" era.
