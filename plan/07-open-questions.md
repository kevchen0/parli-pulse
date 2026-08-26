# Open questions

What is still unresolved, and what has been settled. Answered items move to the
bottom with their answers, so nobody re-investigates them.

**Cite these by title, not by number.** Numbers are positional and shift every
time something is answered and moves down — which is how three references
elsewhere in the plan came to point at questions that no longer existed.

---

## Still open — needed before the next phase

### Rating design
1. **Partnership or person?** The league keys a team by school *and* debaters,
   so one partnership competing under two registrations becomes two rows with
   its points split — Schrank & Schwartz appear as Stuyvesant 9.0 and
   Independent 7.6. We merge them. Ours is arguably the better model but it
   cannot reconcile against either of theirs. A product decision, not a bug.
   The rating now inherits this: it follows the people, like the standings.

### Rules still ambiguous
2. **XXI.2.C one-third exception** — measured against the open field or the
   AFS? Does a bye count as "advanced without debating"? Byes are common: 12 of
   Berkeley's 16 double-octo sections.
3. **XXI.3.B points floor** — "lowest-seeded breaking team with a winning
   record" by prelim seed or bracket position? The `Tournaments` tab's
   `Breaking Record` column behaves like the answer; confirm it means that.
4. **XXI.2.F** — does "no team shall lose points" floor at 0, or at what the
   team's own prelim record would have earned?
5. **XXI.6.C multiple open divisions** — how to detect programmatically versus
   an Open/JV split. Stanford's `Parli - Open` / `Parli - TOC` is the case.
6. **`manual_adj`** — what drives it? Berkeley HS and Apollo both carry a +1
   nobody can derive. A few real examples would let the backtest classify
   these instead of leaving them unexplained.
7. **Forfeit exclusion.** XXI.2.A read literally reproduces 62% of official
   open fields; `dropped` OR three-plus missing reproduces 88%. Is the league's
   practice "the team stopped competing" rather than a ballot count?
8. **UCLA's prelim count.** Tabroom shows six preliminary rounds, the league
   recorded five, which is worth four points to six teams. Dropped round, or a
   hidden elim counted as a prelim?
9. **The alternative non-break table** (3-1=4, 3-2=3, 4-0=9, 4-1=8, 5-0=12,
   4-2=5, 5-1=11, 6-0=14). Not 2025-26 — all 774 non-breaking rows match
   XXI.3.A — and **not 2026-27 either**: the published Board Code still carries
   the 2025-26 values, checked 2026-08-26 and now guarded by
   `npm run check:rules`, which runs before every ingest. Probably an older
   season. No longer blocking, but still unidentified.

### Product and policy
10. **Judge pages** public, or coach-only behind a login? Needed before Phase 9.
11. **Domain name.** Is `parli-pulse` the public name?
12. **Public "report an error" form** feeding `manual_overrides`?
13. **Independent or NPDL-affiliated?** The build stays independent-safe either
   way, but it changes framing and whether the reconciliation report becomes a
   tool for the Reporting Director.
14. **Historical archive** — how far back, and where do those sheets live?
   Roughly 2019 was mentioned. Are they shaped consistently enough for one
   mirror renderer?

### Raised by the live season
15. **What happens when the league revises a figure after we have published it?**
   A tournament can be rescored inside the 30-day correction window. The fetch
   picks it up, but a reader who quoted the earlier number is not told it moved.
   Worth a visible "changed since" marker, or worth deciding it does not matter.
16. **Does the provisional marker come off correctly?** Points are marked amber
   until the league's sheet carries the tournament. That transition has never
   been observed, because no season has been live since the marker existed.

---

## Answered

- **What a debater profile page may hold** — results, partners, the best-five
  weighting, speaker figures, partnership ratings, and rounds with the opponent
  named. Settled deliberately, because naming opponents makes a page about one
  minor also a page about every minor they met. What makes that acceptable is
  that the exposure is now *revocable*: a suppressed debater reads as "Name
  withheld" on other people's pages too, which was true of no page on the site
  before — the flag existed and nothing read it. Nothing appears that the league
  and Tabroom do not already publish, and there is still no surface anywhere
  that identifies an Article XIV sanction.
- **Should novice/JV rounds feed the rating?** Open only, matching XXI.1.A and
  the speaker points. Mixing divisions would place a team above opponents it
  could never meet, and the extra evidence would be evidence about a different
  competition.
- **Minimum rounds before a partnership appears on the rating board** — ten.
  387 of 1,776 rated partnerships clear it. Every partnership keeps a rating and
  a deviation regardless; the gate decides only who is ranked. It matters less
  than it looked, because the board is ordered on the rating *less* its
  deviation, which already pushes thin ratings down rather than out.
- **Whether elim rounds need extra weight** — no, and neither do large fields.
  Elim opponents average 53% more season points, so an opponent-adjusted rating
  already pays more for beating them; a multiplier would count the same fact
  twice. See [05-metrics.md](05-metrics.md).
- **Whether the rating earns its place** — yes, on held-out rounds: 63.4%
  against the league ranking's 59.8%, with a clearly better log loss. The
  commitment was to report a failure if it lost, and it did not.
- **Which season starts the live era** — 2025-26. Earlier seasons are archival
  (Phase 8); 2024-25 may be backfilled, and the schema and loader are
  season-keyed throughout, so `SEASON=2024-25 npm run load` is all it takes.
- **CHSSA and OSAA scoring** — they use the ordinary XXI.3.A prelim table, not
  the reduced XXI.4.B schedule, and are prelim-only in practice. Implementing
  XXI.4.B literally dropped CHSSA agreement from 44% to 0%. Qualifier results
  follow XXI.4.C exactly: `qual` = 8, `alt` = 4.
- **Adjustment order** — the XXI.3.B points floor lifts the *base*, and
  adjustments apply on top. Not a floor on the final total. Verified at NYPDL
  September OL.
- **The two-person rule** — `Incorrect Team Size?` does encode XXI.1.G.
  Applying it reproduces Princeton-Campos (32.5) and Dalton-Alexander (16.2)
  exactly.
- **Hybrid school value** — half to each school, per XXI.9.C. 56/56 schools
  exact at half, 43/56 at full.
- **Individual points** — the debater's own results pooled across every
  partner, per XXI.8.A. Not averaged between partners.
- **Speaker pools** — open divisions only, and novice kept separate. Judges
  score novice rounds differently; mixing distorts both.
- **Minimum ballots to rank a speaker** — 20. From the data: the spread of
  season means is 0.75 sd among debaters with ten ballots or fewer, 0.52 by
  twenty, 0.41 by thirty.
- **Punitive sub-25 scores** — kept in a debater's own average, since they are
  real results, but never surfaced as such. Robust judge statistics stop one
  from distorting everyone else. See [08-risks-policy.md](08-risks-policy.md).
- **Non-standard speaker scales** — NYPDL 23-30 (verified: 157 scores land
  exactly on 23, with a smooth distribution above), YFL 1 at 0-100. Everything
  else 25-30. Held in a config table, never inferred.
- **Walkovers** — detectable, and the profile pages now do detect them for
  display: a same-school elim section that *nobody* won, four of them in
  2025-26. Note the qualifier — 87 further same-school elim sections carry a
  real decision, so "two teammates met" is not the signature and an earlier
  note saying "no scored ballot" was loose about it.
  **The scoring side is a different matter and is broken:** the engine was
  believed to read the value from the sheet's `walkover_adjustment`, and that
  column is null for every mirrored row while ours is 0 for all 1,564. Nobody
  is applying the -2/+2. See [09-data-quality.md](09-data-quality.md).
- **State qualifier results** are not derivable from Tabroom and come from the
  sheet's own result column.
