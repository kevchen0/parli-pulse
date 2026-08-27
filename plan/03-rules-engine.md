# Article XXI implementation spec

Constants live in `packages/rules/src/constants.ts`, sourced from the rules text
and the embedded Elim Points Table image. Everything below is stated in the
order the engine should evaluate it.

---

## Stage 1 — Tournament eligibility (XXI.1)

A tournament counts only if all hold:

- Open/varsity parli division only (XXI.1.A)
- Invitational, or named in XXI.4 (XXI.1.B-C)
- Open division has ≥5 schools, ≥10 teams, ≥3 prelims (XXI.1.D)
- Online only if Board-sanctioned (XXI.1.E, XXI.11)
- Date/location announced before Oct 1, or 30+ days ahead (XXI.1.F)
- Not in June, July, August, or Dec 24 – Jan 2 (XXI.1.H)
- Run by an eligible organization (XXI.1.I)

Approval status comes from the NPDL calendar sheet, not from Tabroom.

## Stage 2 — Field sizes

This is where most of the error lives. See
[02-findings.md](02-findings.md#2-field-sizes--the-part-thats-easy-to-get-wrong).

1. **Open field** = entries in the open division, minus those that forfeited
   ≥2 prelims (XXI.2.A). Forfeit = a prelim round with no `winloss` score.
2. **Novice/JV field** = same exclusion applied to novice and JV divisions.
3. **AFS** = open field + novice/JV field. If the tournament has multiple open
   divisions, each counts separately and novice/JV is *not* added (XXI.6.C).
4. **Elim field** = distinct entries appearing in any elim section.
   **Bye-aware** — never `sections × 2`, since a bye is a one-team section.
5. **Break %** = elim field ÷ open field.
6. **Prelim count** = rounds of type `prelim` or `highlow`.

## Stage 3 — Per-entry points

**Team size gate (XXI.1.G).** Entries whose `students[]` length ≠ 2 score
nothing and are excluded everywhere.

**Did they break?** Did the entry appear in any elim section.

### Breaking teams
1. Highest elim level reached, from **section count** (32→triple, 16→double,
   8→octo, 4→quarter, 2→semi, 1→final), never from `Final Places` labels.
2. Base points = `ELIM_POINTS_TABLE[afsBand][level]`. `null` means structurally
   unreachable — a bug, not a zero.
3. Apply prelim-count adjustment (XXI.2.E) and break-% penalty (XXI.2.D).
4. Apply walkover/closeout adjustments (XXI.5).
5. Apply the points floor (XXI.3.B): a breaking team with a winning prelim
   record gets at least what the *lowest-seeded breaking team with a winning
   record* would have earned on prelims alone. The `Tournaments` tab's
   `Breaking Record` column records exactly this — use it to validate.
6. Floor so no team loses points by attending (XXI.2.F).

### Non-breaking teams
Points from `PRELIM_POINTS` by record (XXI.3.A). Losing or even records earn
nothing unless XXI.2.C's one-third exception applies.

### Walkovers and closeouts (XXI.5)
Same-school only: being walked over +2, walking over −2, finals closeout −3.
Different-school walkovers count as forfeits.

**Derived from the bracket**, and validated at 1,535 of 1,541 against the
league's own column (`npm run check:walkovers`). The signature is a same-school
elim section that drew a **short panel** — fewer ballots than the same round
gave its other sections. Two things it deliberately is not:

- not *same school*, because teammates do sometimes debate: Harvard's octafinal
  between two Menlo-Atherton teams went 2-1 on a full panel and the league
  records no adjustment;
- not *no result entered*, because a walkover still carries a token ballot
  naming whoever went through. That test finds 4 of roughly 47.

Two further shapes leave no section to read, and are inferred from the bracket
around them: two same-school teams win the semifinals and no final is ever
published, which is a closeout at −3 each; and a whole round missing from the
middle of the bracket, applied only where the reconstruction is *forced*.

State qualifiers are excluded — XXI.4.C scores them on qual/alt, not a bracket.

## Stage 4 — Non-invitational tournaments (XXI.4)

Handled separately from the elim table.

- **NPDL-TOC** — 2/prelim ballot won, +2 break, 4/elim win, +2 championship;
  break-% penalties as for invitationals.
- **CHSSA member league** regular-season tournaments — first three only; all
  rounds count as prelims; only first four rounds score; own point table
  (2-1→2, 3-0→5, 3-1→4, 4-0→9).
- **CHSSA state qualifiers / OSAA districts** — alternate 4 (needs 20+ entries),
  qualifier 8 (needs 10+ entries). Excluded from TOC qualification; not added to
  rankings until March 2.

**These are effectively prelim-only formats** and do not use the elim table at
all. Additional scoring differences exist beyond what the rules text states —
to be captured from the league before Phase 3 finishes. See
[07-open-questions.md](07-open-questions.md).

## Stage 5 — Aggregation

- **Team** (XXI.7) — best 5 tournaments, weights 1.0 / 0.9 / 0.6 / 0.3 / 0.1.
- **Individual** (XXI.8) — same weights over the debater's *own* results across
  all partners. Verified 99.3%.
- **School** (XXI.9) — sum of unweighted points of all its teams. **Hybrids
  count half to each school.** Verified 56/56 exact. Member schools only.
- **TOC qualification** (XXII.1.A) — individual-based, 40 points on March 1,
  excluding post-March-1 qualifier points.

## Verification

- Unit tests per subsection, with fixtures at every band boundary (AFS
  9/10/11/12, 16/17, 32/33, 64/65, 218/219) and every break-% threshold.
- Golden files on three hand-verified tournaments: **Berkeley 31** (base 32,
  −1), **Cal 28** (base 27, +1), **Nueva 27** before walkover / **25** after.
- Two hand-verified team-size exclusions: Princeton-Campos → **32.5**,
  Dalton-Alexander → **16.2**.
- Formula regressions: school hybrids at half = **56/56**; individual
  aggregation ≥ **99.3%**.
