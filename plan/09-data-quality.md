# Data quality register

Every known gap, anomaly, and hand-entered result, with what to do about each.
Kept current — an unlisted gap will be mistaken for an ingestion bug and
re-debugged from scratch.

Current standing accuracy against the league's published figures: per-entry
**96%** (1532/1588), the league's top 100 teams **89% exact** and 95% within two
points, schools 50% exact.

Points are computed from Tabroom, not read from the league. `SOURCE=sheet`
scores the old way and reaches 98% per-entry — the measure of what independence
costs, not of a better engine. What the sheet still supplies is audited in
[07-open-questions.md](07-open-questions.md).

---

## 1. Tournaments that do not use Tabroom

Results are entered by hand in `packages/ingest/src/manual-results.ts` with
`source` recorded — **41 results across three tournaments**. Each is a claim we
cannot verify against a source we control, so keep the list short and prefer
fixing ingestion wherever a result exists somewhere. **These need updating every
season.**

| Tournament | Why | Status |
|---|---|---|
| Phillipsburg Fall Spooktacular | runs on SpeechWire | 6 results entered for 2025-26 |
| Hap Hingston | runs on SpeechWire | 6 results entered for 2025-26 |
| Ridge Debates | published 4 of 28 teams | all 28 entered for 2025-26 |

Neither has a `tourn_id` in the league calendar, so the ingest cannot discover
them. **Before each season, check SpeechWire for these and any new ones.**

Longer term: a SpeechWire reader would remove the hand entry. Their results
are public; nobody has written the parser.

## 2. Tournaments with unusable Tabroom data

Listed in `INCOMPLETE_TOURNAMENTS`, flagged so the gap reads as a known
condition rather than a bug.

| Tournament | Problem | Effect |
|---|---|---|
| Ridge Debates | Published 4 of 28 teams | **Resolved 2026-08-26** — all 28 hand-entered |

`INCOMPLETE_TOURNAMENTS` is no longer decorative: a tournament listed there is
scored as though it had no payload at all, so every row comes from the hand
entry. Partial data is worse than none — Ridge's four visible teams gave an AFS
of 4, so they scored zero while the other twenty-four scored nothing, and the
four looked scoreable the whole time.

The rounds still load, so the rating and speaker figures keep whatever evidence
the payload holds; only the points are hand-entered.

**A surname-only entry cannot always name a person.** Brooklyn Tech's
"Korneeva & Zhang" is one of two Zhangs at that school and nothing in the data
says which, so the record stays unattached rather than being attributed on a
tiebreak. The school total is right; no debater's page claims the result.

## 3. Tournaments sharing one Tabroom id

One Tabroom tournament can host several competitions the league scores
separately. Handled by `EVENT_OVERRIDES` in
`packages/ingest/src/event-selection.ts`.

| Tabroom tournament | League tournaments | Event each owns |
|---|---|---|
| NPDL Nationals and Round Robin | NPDL Nationals, NPDL Round Robin | `Open Parli`, `Round Robin` |

The Round Robin's event is not identifiable as parliamentary debate from its
name, so it needs the override to be seen at all. **Watch for this pattern
whenever two league rows share a `tourn_id`.**

## 4. Alternate registrations

Clubs, academies, and independent entries the league credits to a school, in
`packages/ingest/src/school-aliases.ts` (26 entries). Examples: `Lucent Debate
Academy` → Campolindo, `Rodda's Disciples` → Stuyvesant, `Papaya Valley` →
Evergreen Valley.

Regenerate candidates with `node scripts/discover-aliases.ts`. It only sees
affiliations that appeared in a scored result, so **new academies must be
added by hand**. Two cases remain unresolved and are recorded in
`SCHOOL_ALIASES_UNRESOLVED`.

## 5. Speaker-point scales

Never infer the scale from the observed minimum — a punitive 24 is not a
scale. Scale belongs in a config table per event.

| League | Scale | Evidence |
|---|---|---|
| Most | 25-30 | 1.06% of scores below 25 |
| NYPDL | 23-30 | 11.55% below 25, systematic |
| YFL 1 | **0-100** | 20 scores in the 68-100 range |

Sub-25 scores on a 25-30 scale are usually Article XIV equity sanctions. They
inform normalization but must never be surfaced — see
[08-risks-policy.md](08-risks-policy.md).

## 6. Where the league's sheet and Article XXI disagree

Our figure follows the rules; theirs is authoritative for display. These are
the standing divergences.

**Manual overrides in the sheet.** Recorded in its own `manual_adj` column, so
they are human decisions rather than derivable rules:

| Tournament | Working | Ours |
|---|---|---|
| Berkeley HS, double-octofinalists (×2) | base 10, adj −1, **manual +1** → 10 | 9 |
| Apollo Invitational, semifinalist | base 16, adj −9, **manual +1** → 8 | 7 |

**Probable sheet error.** El Cerrito applies a −1 adjustment to non-breaking
teams. 28 tournaments in 2025-26 had a 0% break and a −6 tournament-level
penalty; **27 of them applied 0** to their entries. El Cerrito alone applied
−1. Our 11 follows XXI.3.A; their 10 looks like a slip. *(A 0% break does not
itself trigger a penalty — that hypothesis was tested and rejected.)*

**Prelim count disagreements — UCLA, and we keep our number.** UCLA published
**six** preliminary rounds to Tabroom (rounds 1-6, twelve sections each); the
league recorded five. Teams we read as 3-3 the league records as 3-2, which is
the difference between nothing and four points. **Decided 2026-08-26: ours
stands.** Six rounds are in the payload with twelve sections each; there is no
reading of the data that makes them five. This is an accepted divergence rather
than a gap to close, and it accounts for 10 of the entries where scoring from
Tabroom alone disagrees with the sheet. Still worth raising with the Reporting
Director, because a dropped round or a hidden elim (XXI.6.A) would explain it.

**Cal Parli's three one-ballot same-school elims — unresolvable.** Three
same-school sections in its octafinals were each decided on a single ballot
where the round's other sections had three. That is the walkover signature, and
the league recorded no adjustment for any of them. Nothing in the payload
separates the two readings: the round published no speaker points at all, so the
test that works elsewhere -- a walkover section being the only one in its round
without speaks -- says nothing here. Either the tab director assigned one judge
to rounds that were genuinely debated, or the league's hand-entered walkover
columns missed three. Four entries, left as a disagreement.

**Finals closeouts between different schools.** Clackamas Holiday Edge has an
unplayed final between West Linn and Beaverton, and the league recorded -3 for
both. XXI.5.C provides for closeouts *within* a school only, so the derivation
does not reproduce this and the two entries sit in the disagreement queue. Read
literally the league applied a same-school adjustment to two different schools;
the alternative reading is that an unplayed final is treated as a shared title
however it arose, which the rules text does not say.

**Tournaments publishing no rounds at all.** Ryan Rutledge has zero rounds in
its payload. Records come from tab's own summary, so prelim results are right,
but **elim placement is unrecoverable** — teams the league records as reaching
finals or semifinals score only their prelim points here. Four results. Same
class as Ridge Debates, and only manual entry fixes it.

**Walkover adjustments are derived now, not ingested.** They were once read
from the sheet's `walkover_adjustment` column and written to the database as
zeros — the points were right, because `scoreEntry` applied the value, but the
per-rule audit trail the table exists for held nothing. Both are fixed:
`computeEntryPerformances` derives XXI.5.C from the bracket, and `load` persists
each adjustment in its own column. 67 walkover adjustments, 211 prelim-count
adjustments and 1,541 floor decisions where all three were previously 0.

**Still unexplained.** One result:

| Tournament | Official | Ours | Note |
|---|---|---|---|
| TCFL Spring, 3-1 | 7 | 0 | we read no record for this team |

## 6b. Partnerships with no standing of ours (23)

Down from 44: hand-entering Ridge Debates closed most of it. What is left is
not one problem.

| Cause | n | Fixable |
|---|---|---|
| Tournament published nothing usable | 10 | No — YFL 4, CBSR 3, Randolph Fall Classic |
| UCLA's prelim-count disagreement | 6 | No — we read 3-3 where the league reads 3-2, and ours is the defensible number |
| Names the matcher will not resolve | 4 | Partly — see below |
| The league splits one partnership across two registrations | ~3 | No — see below |

Three of the four naming cases are instructive. **Franklin's Singer & St.
Martin** and **Blind Brook's Mohapatra & Segura** we now score from Tabroom
without a sheet row to match against, so they appear in our standings and not in
the comparison. **Harriton's "Bigdeli & Pedram"** is one person entered as two:
Pedram Bigdeli, first and last name split across the partner columns. **Francis
Parker's Blair & Chaudhuri** is our "Ray Chaudhuri" — a surname the sheet
truncates.

**The league keys a team by school *and* debaters, so one partnership competing
under two registrations becomes two rows with the points split between them:**

| | |
|---|---|
| Stuyvesant Schrank & Schwartz | 9.0 |
| Independent Schrank & Schwartz | 7.6 |
| NEST Moore & Powell | 4.0 |
| Independent Moore & Powell | 7.6 |

We merge those into one partnership, which is arguably the more useful model —
it is the same two people — but it means our single row cannot reconcile
against either of theirs. Changing this would mean adopting a model we think is
worse; it is recorded rather than "fixed".

**Typos in the sheet create phantom teams.** Brooklyn Tech appears as both
`Tsujimoto & Yarmy` (12.6) and `Tsujimonto & Yarmy` (4.0) — one team, two rows,
one of them misspelled. Also `Menlo Egleson & Goyan` (Goyal) and
`Palo Alto Chen & Yang` (Yan). Our matcher deliberately will not resolve these,
because one-to-one matching has already given the real spelling to the real
team.

## 7. Provenance

Every scored result carries where its figure came from, because they are not
equally trustworthy:

- **`tabroom`** — computed from round data. The real check.
- **`sheet-record`** — scored from the league's own recorded result at a
  prelim-only tournament, where no bracket is needed. Weaker: the input comes
  from the thing being checked.
- **`manual`** — hand-entered from another platform. Unverifiable against any
  source we control.

Keep `manual` rare. Prefer fixing ingestion whenever a result exists somewhere.

## 7b. Event names that defeated the classifier

Field sizes decide which row of the elim points table a tournament reads, so an
event read as the wrong division is not a rounding error. Three found by
running the season without the sheet's figures, all fixed in
`packages/ingest/src/divisions.ts` and `event-selection.ts`:

| Tournament | Event | Was | Should be |
|---|---|---|---|
| Singletary | `Novice Parlimentary Debate` | not parli at all | novice, 9 teams |
| Stanford | `Parli - Middle School + Novice Combined` | middle | novice, 30 teams |
| NPDL Round Robin | field read from `Round Robin` | 12 teams | Nationals' 37 |

**Watch for these each season.** A misspelling, a combined division, and a
tournament running inside another's field are all things a tab director does
without thinking about it. `npm run compare:sources` surfaces them: an event
misread as the wrong division shows up as a whole tournament's entries moving
at once.

## 8. Seasonal checklist

Before a season opens:

1. **Confirm the rules have not changed.** `npm run check:rules` compares the
   engine's tables against the published Board Code and runs first in the chain,
   so a July revision stops ingestion rather than scoring a season under last
   year's rules. `packages/rules` is season-versioned for exactly this.
2. Check SpeechWire for Phillipsburg, Hap Hingston, and any new non-Tabroom
   tournaments.
3. Re-run `scripts/discover-aliases.ts` and fold in new academies.
4. Confirm no new tournament shares a `tourn_id` with another, and that its
   *field* comes from the right event where one does — see section 3.
5. Confirm the speaker scale for any new league.

During and after:

6. **`npm run compare:sources`** — a whole tournament's entries moving at once
   is a field-size input, usually an event name the division classifier misread.
   See section 7b.
7. **`npm run backtest:fields`** — open field, N/JV, AFS, elim field and prelim
   count against the league's own. AFS is the one that selects a points row, so
   it is the one to watch.
8. **`npm run check:walkovers`** — XXI.5.C against the league's column.
9. **Snapshot before any reload, and diff after.** Two destructive bugs and one
   silent identity churn were caught this way and by nothing else. Speaker
   totals and ratings should not move when only points change; canonical ids
   should not move at all.

The first tournament of a season is its own case. Everything here has been
exercised against an empty season and a complete one; a season holding exactly
one tournament has never run, and the one dry run against an empty season found
four bugs.
