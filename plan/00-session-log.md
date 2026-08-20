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

**Stage 2 — per-entry points** (vs `Entry` tab): **1273/1329 (96%)**

| tournament type | match |
|---|---|
| NYPDL | 411/412 (100%) |
| CHSSA (incl. XXI.4.C qualifiers) | 153/156 (98%) |
| Regular invitationals | 655/696 (94%) |
| NPDL-TOC (XXI.4.A) | 54/65 (83%) |
| OSAA | no rows in 2025-26 |

breaking teams 97% · prelims-only 95% · hybrids 100% · adjustments 100%

**Partnerships** (vs `team_calc`): **579/675 (86%) exact**, 90% within 2 points.
Restricted to teams whose every result we reproduce: **579/583 = 99%**.
Failure attribution: 53/96 a per-entry score disagrees, 39/96 missing a
tournament, **4/96 aggregation-only**.

**Remaining weak spots**: NPDL-TOC 83% (its prelims are 2-judge panels; we
undercount winning ballots for ~11 entries), 255 sheet rows unmatched by
surname pair, 155 partnerships with no Tabroom data at all.

### Key decisions made this session
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
- Close the `+1` NYPDL bucket (90 rows) — likely an AFS band edge.
- Close the `-4` bucket (43 rows) — non-breakers scoring 0.
- Improve entity matching to recover the 255 unmatched sheet rows.
- Then: Drizzle schema, sheet mirror UI.

### Blocked
- Neon + Vercel provisioning (needs your accounts).
- Q9 CHSSA/OSAA scoring specifics; Q18 which season starts the "live" era.
