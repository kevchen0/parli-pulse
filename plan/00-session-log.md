# Session log

Running record of what changed and why, so any agent or person can pick this up
cold. Newest first. Keep entries short; put durable conclusions in
[02-findings.md](02-findings.md) and link them from here.

---

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

### Next
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
