# Measurements and known facts

Everything here was verified against live data, not inferred from the rules
text alone. Numbers in **bold** are exact matches against the official sheet.

---

## 1. Data sources that work

### Tabroom bulk export (unauthenticated)

```
GET https://www.tabroom.com/api/download_data.mhtml?tourn_id=<N>
```

Returns a complete JSON tournament backup. **No login required** — a Tabroom
account is not needed for any part of this project.

Contains: `categories[].events[]` (one per division) → `rounds[]` →
`sections[]` → `ballots[]` with `entry`, `side`, `judge`, `judge_person`, and
`scores[]` tagged `winloss` / `point` / `rank`; plus `schools[].entries[]` with
`students[]` (stable student ids), `hybrid`, `dropped`; plus `result_sets[]`
(`Prelim Seeds`, `Speaker Awards`, `Bracket`, `Final Places`).

Downloaded the 2025-26 slate (97 tournaments, ~370 MB, cached in
`data/raw/tabroom/`; gitignored).
42 of the first 44 returned full data. Note the league's `Tournaments` tab
carries 97 tournaments including CHSSA league events and state qualifiers,
where circuit 179 lists only sanctioned invitationals. The two failures
(`37257` Jon Schamber, `37432` Rutgers) never published results at all — they
need manual entry, not authentication.

### Tournament discovery — the rankings sheet, not the circuit calendar

**The `Results` column of the rankings sheet's `Tournaments` tab.** It holds a
full Tabroom URL, written in as each tournament is scored, and `sheet.ts` reads
the id straight out of it. This is what produced the season: of 97 tournaments
loaded for 2025-26, **95 carry a Tabroom id and a payload**, and those 95 are
exactly the ids in that column. The other two published nothing to Tabroom and
were hand-entered.

**The circuit calendar cannot do this job, though it looks like it should.**

```
https://www.tabroom.com/index/circuit/calendar.mhtml?circuit_id=179&year=<start year>
```

Measured on 2025-26: the sheet gives 95, the calendar gives 44 rows of which a
parli filter would fetch 37, and **58 of the 95 are missing** — Jack Howe, Yale,
Sid Fox, La Costa Canyon, Ridge Debates, NPDL Fall, Peninsula. Circuit 179 lists
only tournaments that registered themselves with it, which most parli
tournaments never do even while publishing full results. It also offers three
the loader would ignore, including a middle-school invitational.

An earlier note here said the calendar was "better than the NPDL calendar sheet,
which is missing `tourn_id` for about half its rows". That was comparing against
the *calendar* sheet, which is a different document. Against the **rankings**
sheet the calendar loses badly, and building discovery on it would have silently
ingested 39% of a season.

The calendar is still worth reading as a **lookahead** — it names tournaments
before the league writes them up — and `npm run fetch` reports that at the end
without acting on it.

Approval status comes from the NPDL calendar sheet:
`docs.google.com/spreadsheets/d/1VNW2wNf_QD0hqaIhXwkXUvC1VyZH8Rsy06adijMCA0A/gviz/tq?tqx=out:csv`

### Official rankings sheet (public, machine-readable)

Sheet `1oz6E9Bxw7d__DmNWJykS3VcRvJivffX7y_Jqtw7YxcU` **for 2025-26**. A new
document each year, so the id is keyed by season in `SHEET_IDS` and an unknown
season throws rather than falling back — reading last season's sheet reports a
full slate of finished tournaments and nothing about the output looks wrong.

Fetch **all tabs in one request** via `export?format=zip` — named HTML per tab,
more robust than per-tab gids. Cached per season at
`data/raw/sheet/rankings-<season>.zip`; 2025-26 keeps the unsuffixed name its
cache was written under.

Two independent ground-truth sets:

- **`Entry`** (1,612 rows) — per-team, per-tournament: record, AFS, base points,
  and every adjustment column separately (`walkover_adjustment`,
  `prelim/break percentage adj`, `manual_adj`, `calc_points`).
- **`Tournaments`** (117 rows) — per-tournament: `Open Field`, `N/JV Field`,
  `AFS`, `Open Elim Field`, `Prelim #`, `Breaking Record`, `Prelim Adjustment`,
  `Break %`, `Break % Penalty`.

The `Tournaments` tab is the more useful of the two for development, because it
lets us validate field-size computation *separately* from points computation.
Getting the fields right is most of the battle.

Other tabs: `Team`, `Individual` + `individual_calc`, `School`, `TOC Qual`,
`SchoolList` (canonical school → short name → region), regional tabs, `RulesData`.

### Rules text and the Elim Points Table

Rules: `docs.google.com/document/d/1xv6klxK9PQPPyAaeJ9Gh9-CGL-nvikRjRAsDTiRYZtw/export?format=txt`

The Elim Points Table (XXI.2.B) is an **embedded image**, not text. Extract via
`export?format=zip` → `images/image1.png`. Transcribed into
`packages/rules/src/constants.ts` and saved at `docs/elim-points-table.png`.

---

## 2. Field sizes — the part that's easy to get wrong

Three separate corrections, each of which changes points:

### 2a. Forfeit exclusion is real (XXI.2.A)

"Teams that forfeited two or more prelims shall not count toward field size."
Detect as: prelim rounds in which the entry has no `winloss` score.

| Tournament | Raw entries | Forfeited 2+ | Adjusted | Sheet |
|---|---|---|---|---|
| Berkeley HS (Open) | 107 | 3 | 104 | **104** |
| Nueva (Open) | 42 | 2 | 40 | **40** |
| Cal (Open) | 67 | 9 | 58 | 59 (off by one) |

Cal's one-team discrepancy is unexplained and goes in the disagreement queue.

### 2b. The elim field must be bye-aware

A round's **section count is the bracket size, not the number of teams that
broke.** At Berkeley, round 6 had 16 sections — but 12 were single-team byes,
so only 20 teams actually broke, not 32.

| Tournament | Sections × 2 | Bye-aware count | Sheet |
|---|---|---|---|
| Berkeley HS | 32 | 20 | **20** |
| Nueva | 8 | 8 | **8** |
| Cal | 32 | 21 | **21** |

Count distinct entries appearing in any elim section instead. **3/3 exact.**

This matters because break % drives the XXI.2.D penalty, and the two methods
land in different penalty bands: 20/104 = 19.2% (−1) versus 32/107 = 29.9% (no
penalty).

### 2c. AFS = adjusted open + adjusted novice/JV

Berkeley: 104 open + (15 JV + 22 novice) = **141**, matching the sheet exactly.
Nueva's N/JV is recorded as 37 where the forfeit-adjusted figure is 34 — the
sheet appears to have used the raw number there. Inconsistent; queue it.

---

## 3. Rules verified by reimplementation

| Rule | Result | Verdict |
|---|---|---|
| School rankings, hybrids at **half** value (XXI.9.C) | **56/56 schools exact** | Confirmed |
| School rankings, hybrids at full value | 43/56 | Ruled out |
| Individual = weighted best-5 of a debater's own results across **all** partners (XXI.8.A) | **99.3%** (992/999) | Confirmed |

### Corrections to earlier assumptions

- **Hybrids count half to each school, not full.** Diamond Bar is the clean
  proof: all their points come from one hybrid with Portola. Half = 33, full =
  66, **official = 33**. This applies *only* to school rankings — team and
  individual rankings award hybrid teams full points. 35 hybrid rows in 2025-26.
- **Individual points are not averaged between partners.** A debater
  accumulates their own per-tournament results whoever they were partnered
  with; the best 5 then take the 1/.9/.6/.3/.1 weights.

### New rule found: the two-person test (XXI.1.G)

The sheet silently drops 41 rows flagged `Incorrect Team Size?` — mavericks and
three-person teams. Applying it lifts individual matching 99.0% → 99.3% and is
required for school totals to reach 56/56. Reproduces Princeton-Campos (drops a
9-pt row → **32.5**) and Dalton-Alexander (drops a 12-pt row → **16.2**)
exactly. Detect via `entries[].students[].length !== 2`.

### The residual 0.7% is entity resolution, not arithmetic

`El Cerrito-Mclean` and `El Cerrito-McLean` both exist in the sheet as separate
people — one debater split by surname capitalization. The sheet matches on
surname strings; **we key on Tabroom student ids**, which eliminates this class
of bug. A place where our numbers should be *better* than the sheet's.

---

## 4. End-to-end scoring, verified

Predicted from raw Tabroom data, then checked against the `Entry` tab:

| Tournament | AFS | Band | Base | Prelim adj | Break % | Penalty | Predicted | Actual |
|---|---|---|---|---|---|---|---|---|
| Berkeley HS | 141 | 130-154 | 32 | 0 | 19.2% | −1 | 31 | **31** |
| Cal | 59 | 55-64 | 27 | +1 (6 prelims) | 35.6% | 0 | 28 | **28** |
| Nueva | 77 | 65-77 | 28 | 0 | 20.0% | −1 | 27 | **27** |

Nueva's champion then lands at 25 after a **−2 walkover adjustment**.

### Walkovers are probably auto-detectable (revises an earlier assumption)

Both Nueva semifinals were same-school walkovers. The signature is visible:
Greenleaf & Singel (Menlo-Atherton) −2 and Panzer & Tse (Mountain View) −2 for
walking over teammates; Kassayan & Shivakumar (MA) +2 and Chen & Nalumasu (MV)
+2 for being walked over. Exactly XXI.5.C.

Detection heuristic to try: an elim section pairing two same-school entries
where no ballot carries a score. This may remove most of the manual entry the
plan previously assumed was unavoidable. Validate against
`walkover_adjustment` across all 1,612 rows before relying on it.

---

## 4b. Non-break points: XXI.3.A holds exactly

Tabulated every non-breaking row in the sheet by record. **All 774 match
XXI.3.A with zero exceptions**, so the literal table is correct for 2025-26:

| record | sheet | n | | record | sheet | n |
|---|---|---|---|---|---|---|
| 2-1 | 4 | 65 | | 4-0 | 11 | 66 |
| 3-0 | 8 | 13 | | 4-1 | 10 | 2 |
| 3-1 | 7 | 170 | | 5-0 | 14 | 1 |
| 3-2 | 4 | 457 | | | | |

An alternative table in circulation (3-1=4, 3-2=3, 4-0=9, 4-1=8, 5-0=12,
4-2=5, 5-1=11, 6-0=14) does **not** describe 2025-26. It may belong to another
season: NPDL revises the Board Code annually, and XXI.11 explicitly provides
for its own replacement each July. **The rules engine is therefore
season-versioned** (`rulesForSeason()` in `packages/rules/src/constants.ts`) so
a future table is a data change, not a rewrite. See
[07-open-questions.md](07-open-questions.md), "the alternative non-break
table".

The same query confirmed the **NPDL-TOC ballot schedule (XXI.4.A)**: records
there are ballot counts (`6-8`, `7-7`, `9-5`) and every one scores exactly
2 x ballots won.

## 4c. CHSSA and OSAA are prelim-only, on the ordinary table

The reduced XXI.4.B schedule (2-1=2, 3-0=5, 3-1=4, 4-0=9) is **not** what the
league applies. CHSSA rows use the ordinary XXI.3.A table -- a 3-1 there is
worth 7, not 4 -- and are prelim-only in practice. Implementing XXI.4.B
literally dropped CHSSA agreement from 44% to 0%.

State-qualifier results follow XXI.4.C exactly: `qual` = 8 (49 rows),
`alt` = 4 (31 rows). These are not derivable from Tabroom and currently come
from the sheet.

---

## 4d. NYPDL runs one shared pool with two break brackets

NYPDL holds a single preliminary pool -- no separate novice prelims. Teams at
4-1 or better break to the open elims; everyone below that line breaks into a
separate novice bracket of fixed size. Both brackets live inside one Tabroom
event with their rounds interleaved.

Verified across the 2025-26 slate. In 15 of 17 tournaments the open bracket
holds exactly the 5-0 and 4-1 teams and the parallel bracket exactly the 3-2s
and 2-3s:

| tournament | pool | open bracket | novice bracket |
|---|---|---|---|
| September OL | 54 | 5-0 x2, 4-1 x9 | 3-2 x2 |
| October OL | 89 | 5-0 x3, 4-1 x12 | 2-3 x8 |
| January | 87 | 5-0 x2, 4-1 x11 | 3-2 x8 |
| November California | 38 | 5-0 x1, 4-1 x7, **3-2 x8** | — |

November California broke 3-2s into the open bracket as well, so the engine
reads the break line from the data rather than assuming 4-1.

Two consequences for Article XXI. The whole shared pool is the open field --
the league records N/JV as 0 for NYPDL, which matches. And the novice bracket
must be excluded from the elim field, or break percentage lands in the wrong
XXI.2.D penalty band; this is what `partitionElimRounds` is for.

**The tournament says which bracket a round is in, in `round.label`.** NYPDL
writes `VO`/`VQ`/`VS`/`VF` for varsity and `NQ`/`NS`/`NF` for novice -- 15
events in 2025-26 carry both families. Partitioning on that gets the open elim
field exact for **15 of 17** NYPDL tournaments, and it is a statement rather
than an inference, so it is tried before the shared-team walk. The walk stays as
the fallback for everyone else, and for events whose labels are the ordinary
decorative "Octos"/"Finals" -- those are not bracket statements and their first
letters must not be read as one.

Both of the two misses were the same shape: a team that broke and appears in no
open elim section at all. **Recovered from the prelim seeds**, which takes the
open elim field to 78 of 80 tournaments. Three conditions, all necessary:

- **The bracket has an unused slot.** A full bracket has nothing missing. At
  Nueva the fourth seed withdrew and the ninth was pulled up from *below* the
  line to fill the eight slots, so its seed gap is not a team that broke.
  October OL held sixteen slots and fifteen teams.
- **The gap sits below a seed that did break.** Seeds are evidence only where
  the bracket reached past them.
- **The team's record is at least the worst that did break.** NYPDL November OL
  has a seed-10 gap at 2-3 against a bracket whose worst is 4-1.

Recovering from the break line alone was tried first and is much worse -- 74%
against 95% -- because ties at the line count teams that never broke. The seed
gap is what carries the information; the record only filters it.

---

## 5. Speaker points

Measured all 20,030 parli speaker scores. **A low minimum is usually a misnomer,
not a different scale.** The convention is 25-30; sub-25 scores are typically
punitive, given for bigotry-related conduct. Some leagues genuinely do use a
different scale and say so.

| Group | Events | Scores below 25 | Reading |
|---|---|---|---|
| **NYPDL** | 19 | **11.55%** | Genuine 23-30 scale, used systematically |
| Everyone else | 24 | **1.06%** | Punitive outliers on a 25-30 scale |

A 10× separation. **Never infer scale from the observed minimum** — doing so
misclassifies all 24 non-NYPDL events on the strength of a few punitive 24s.
Default to 25-30 and override per league from a config table.

- No 0-10 scale appears anywhere in 2025-26 data. Handle defensively.
- 15 scores of exactly 0.0 (0.07%) — forfeits, not scores. Filter as sentinels.
- ~50 scores (0.25%) outside 20-31, now traced to three events rather than
  scattered noise: **YFL 1 runs a 0-100 scale** (20 scores, 68-100), while Cal
  and DVC Vikings have a handful of genuinely low values (1-19) that look like
  data-entry errors. The 0-100 case confirms the scale must come from a config
  table per event, not from the convention.
- Some tournaments use tenths, others integers only.

---

## 6. Judge analytics

1,336 unique `judge_person` ids; 385 (29%) judged 2+ tournaments; busiest judged
11. 492 panel sections (3+ judges), **277 with a split decision (56%)**.

Design constraint: 277 dissent events across 1,336 judges is *sparse*. Most
judges never sit on a panel. Per-judge squirrel rates need heavy shrinkage and
visible uncertainty or they actively mislead.

---

## 7. Known data quirks

- **Elim level from section count, not place labels.** Tabroom's `Final Places`
  reports "Elim 2"/"Elim 3" at some tournaments rather than "Double
  Octafinals". Section counts are exact.
- **Entries can detach from their event.** At Stanford (`35262`) one event had
  rounds but zero linked entries — they'd moved to a sibling event. Resolve
  entries from ballots as a fallback.
- **Ids are inconsistently typed**, string or number depending on field and
  tournament. Normalize on read.
- **Some tournaments publish entries but no rounds** (El Cerrito, GGSA Debate 3,
  Karen Keefer). Points must fall back to `result_sets`.
