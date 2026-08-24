# Data quality register

Every known gap, anomaly, and hand-entered result, with what to do about each.
Kept current — an unlisted gap will be mistaken for an ingestion bug and
re-debugged from scratch.

Current standing accuracy: per-entry **98%** (1529/1564); the league's top 100
teams **90% exact**, 93% within 2%; schools 50% exact, 66% within 2%.

---

## 1. Tournaments that do not use Tabroom

Results are entered by hand in `packages/ingest/src/manual-results.ts` with
`source` recorded. **These need updating every season.**

| Tournament | Platform | Status |
|---|---|---|
| Phillipsburg Fall Spooktacular | SpeechWire | 6 results entered for 2025-26 |
| Hap Hingston | SpeechWire | 6 results entered for 2025-26 |

Neither has a `tourn_id` in the league calendar, so the ingest cannot discover
them. **Before each season, check SpeechWire for these and any new ones.**

Longer term: a SpeechWire reader would remove the hand entry. Their results
are public; nobody has written the parser.

## 2. Tournaments with unusable Tabroom data

Listed in `INCOMPLETE_TOURNAMENTS`, flagged so the gap reads as a known
condition rather than a bug.

| Tournament | Problem | Effect |
|---|---|---|
| Ridge Debates | Published 4 of 28 teams | 24 results missing; Ridge school total −54 |

Nothing recovers this: the results exist in no public source. Only the
tournament can supply them.

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

**Prelim count disagreements.** UCLA published **six** preliminary rounds to
Tabroom (rounds 1-6, twelve sections each); the league recorded five. Teams we
read as 3-3 the league records as 3-2, which is the difference between nothing
and four points, and it affects six results. Whether a round was dropped, or a
hidden elim (XXI.6.A) was counted as a prelim, needs the Reporting Director.

**Tournaments publishing no rounds at all.** Ryan Rutledge has zero rounds in
its payload. Records come from tab's own summary, so prelim results are right,
but **elim placement is unrecoverable** — teams the league records as reaching
finals or semifinals score only their prelim points here. Four results. Same
class as Ridge Debates, and only manual entry fixes it.

**Still unexplained.** One result:

| Tournament | Official | Ours | Note |
|---|---|---|---|
| TCFL Spring, 3-1 | 7 | 0 | we read no record for this team |

## 6b. Partnerships with no standing of ours (44)

Categorised, because they are not one problem:

| Cause | n | Fixable |
|---|---|---|
| We scored none of their results | 24 | No — these are the Ridge Debates / Randolph Fall Classic / CBSR 3 gaps in sections 1-2 |
| The league lists one partnership under two schools | ~8 | No — see below |
| League typo creating a phantom second team | 3 | No |
| School ambiguity and hybrids | ~9 | Partly |

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

## 8. Seasonal checklist

Before a season opens:

1. Check SpeechWire for Phillipsburg, Hap Hingston, and any new non-Tabroom
   tournaments.
2. Re-run `scripts/discover-aliases.ts` and fold in new academies.
3. Confirm no new tournament shares a `tourn_id` with another.
4. Confirm the speaker scale for any new league.
5. **Confirm the rules have not changed.** The Board Code is revised each July;
   `packages/rules` is season-versioned for exactly this reason. See
   [07-open-questions.md](07-open-questions.md) Q27.
