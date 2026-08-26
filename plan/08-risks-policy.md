# Risks and policy

## Risks

**Rules ambiguity** *(highest)*. Article XXI has real edge cases, and the
official numbers include human judgment (`manual_adj`). Mitigation: the sheet is
authoritative for display; our engine surfaces only through the disagreement
queue. Field-size computation is validated separately from points so failures
are diagnosable.

**Undocumented Tabroom endpoint** could change or be rate-limited without
notice. Mitigation: cache every raw payload permanently so the site can be
rebuilt offline; the sheet mirror keeps it alive even if Tabroom access breaks
entirely.

**Statistical overreach.** Judge scoring is thin (277 dissent events across
1,336 judges) and speaker z-scores are sensitive to small samples. Mitigation:
shrinkage everywhere, visible confidence intervals, minimum-sample gates on
every leaderboard.

**Perceived authority.** An unofficial site showing numbers beside NPDL's
invites confusion. Mitigation: persistent "unofficial" banner, official numbers
clearly sourced, Glicko-2 visually distinct and never called "rankings."

**Stale archive.** Pre-2024 points were computed under different rules.
Mitigation: archival seasons are mirrored, never recomputed, and visually
separated from live seasons.

## Policy

**Minors' data.** Names, schools, and win/loss records are already public on
Tabroom, but aggregating them into searchable profiles is a real change in
exposure. Defaults: no photos, no contact information, no grade or age, and an
email-based removal path.

**Equity sanctions stay invisible.** Sub-25 speaker scores are usually Article
XIV conduct sanctions. They inform normalization but must never be surfaced —
no "lowest speaks" view, no punitive flag, nothing that identifies a recipient.
The same reasoning constrains judge pages: no "harshest judge" leaderboard.

**Judge pages launch aggregate-first.** Distributions and league-wide context
before any individual ranking, and a deliberate decision — see "judge pages" in
[07-open-questions.md](07-open-questions.md) — before individual
judge stats go public at all.
