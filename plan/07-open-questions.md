# Open questions

Nothing here blocks Phases 0-2.

## Before Phase 3 — rules engine

1. **XXI.2.C one-third exception** — measured against the open field or the
   AFS? Does a bye count as "advanced without debating"? (Byes are common: 12
   of Berkeley's 16 double-octo sections.)
2. **XXI.3.B points floor** — "lowest-seeded breaking team with a winning
   record" by prelim seed or by bracket position? The `Tournaments` tab's
   `Breaking Record` column looks like the answer; confirm it means what it
   appears to.
3. **XXI.2.F** — does "no team shall lose points" floor at 0, or at what their
   prelim record would have earned?
4. **Adjustment stacking** — do the break-% penalty and prelim-count adjustment
   stack additively, and is the result floored before or after the points floor?
   (Berkeley and Cal both had only one adjustment active, so the data doesn't
   settle it.)
5. **XXI.6.C multiple open divisions** — how to detect programmatically versus
   an Open/JV split? Stanford's `Parli - Open` / `Parli - TOC` is exactly this
   ambiguity.
6. **Walkover detection** — the same-school-unscored-elim-section heuristic
   looks promising. Is it reliable, or are there walkovers it would miss?
7. **`manual_adj`** — what drives it? A few real examples would let me classify
   backtest mismatches correctly.
8. **Two-person rule** — confirm `Incorrect Team Size?` encodes XXI.1.G.
9. **CHSSA / OSAA scoring differences** — you mentioned differences beyond the
   rules text, and that these are effectively prelim-only. Please write these
   up; they're the least documented part of the engine.
10. **Cal's off-by-one open field** — I compute 58 after forfeit exclusion, the
    sheet says 59. Which is right?
11. **Nueva's N/JV field** — sheet records 37, the forfeit-adjusted figure is
    34. Is the exclusion meant to apply to novice/JV fields, or only to open?

26. **Forfeit exclusion divergence.** XXI.2.A read literally (count prelims
    with no win/loss, threshold 2) reproduces only 62% of official open fields.
    `dropped` OR three-plus missing reproduces 88%. Is the league's practice
    "the team stopped competing" rather than a literal ballot count?
27. **Which season does the alternative non-break table belong to?**
    (3-1=4, 3-2=3, 4-0=9, 4-1=8, 5-0=12, 4-2=5, 5-1=11, 6-0=14.) It is
    definitively not 2025-26. If it is 2026-27, the engine needs that season's
    full table before the season opens.
28. **State qualifier / alternate results** are not derivable from Tabroom.
    Is there a source beyond the sheet, or is manual entry expected?

## Before Phase 4 — speaker points

12. Pool novice/JV speaks with open for a judge's baseline, or keep separate?
    (Judges score novice rounds higher; I'd keep them separate.)
13. Minimum ballots before a debater appears on the speaker leaderboard?
14. Which leagues besides NYPDL declare a non-25-30 scale? I'd rather seed the
    config table from you than guess from data.
15. Should punitive sub-25 scores count in a debater's own displayed average?
    (I'd keep them — they're real results — but never display them as such.)

## Before Phase 5 — rating

16. Should novice/JV rounds feed the rating, or open only? (Points are
    open-only per XXI.1.A, but the rating could use everything.)
17. Minimum rounds before appearing on the rating leaderboard — 10? 15?

## Season coverage

18. Which season starts the "live" era — 2024-25 or 2025-26? Depends on whether
    the 24-25 rules are close enough to today's to recompute under one engine.
19. How far back does the archive go, and where do those sheets live? You
    mentioned roughly 2019.
20. Are the historical sheets shaped consistently enough for one mirror
    renderer, or does each season need its own?

## Product and policy

21. Debater profile pages — these are minors. What's shown, and is there an
    opt-out?
22. Judge pages public, or coach-only behind a login?
23. Domain name. Is `parli-pulse` the public name?
24. Public "report an error" form feeding `manual_overrides`?
25. Independent or NPDL-affiliated? Still undecided; the build stays
    independent-safe either way.
