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

**Nothing is indexed.** `robots.txt` disallows everything and every page sends
`noindex, nofollow`. A search result is a different exposure from a page
somebody navigated to: it puts a debater's name in front of anyone who searches
that name for any reason. Relaxing this is a deliberate decision, not a default,
and `/<season>/debater/*` is the part to keep disallowed if it ever is.

**The removal path is real and has been exercised.** A withheld name reads as
"Name withheld" everywhere it would appear, including as a partner or opponent
on somebody else's page; the profile 404s; and search never matches it. What
removal does *not* do is remove the row — the points still count toward school
and partnership totals, so a row remains showing the school, the partner and
the figures, and somebody comparing it against the league's own standings can
often identify it. Removing the row instead would move a school's total and make
the request legible from the arithmetic. **The Privacy page says this outright**,
because a reader deciding whether to ask should know it before they ask.

**Nothing explains what a low speaker score means.** Sub-scale scores inform
the normalisation and are described nowhere. Naming the convention on a public
page teaches every reader to interpret a low figure, which is the same exposure
the policy exists to prevent, delivered wholesale rather than one debater at a
time. Write around it: "robust to outliers", "one unusually low score".

**Messages and analytics.** The contact form stores what it receives and
forwards it to one mailbox. Rate limiting counts a salted hash of the sender's
address; the address is never stored. Analytics is Vercel's, cookieless, with a
visitor hash that rotates daily. Both are described on the Privacy page, which
had committed to disclosing analytics before any shipped.

**Equity sanctions stay invisible.** Sub-25 speaker scores are usually Article
XIV conduct sanctions. They inform normalization but must never be surfaced —
no "lowest speaks" view, no punitive flag, nothing that identifies a recipient.
The same reasoning constrains judge pages: no "harshest judge" leaderboard.

**Judge pages launch aggregate-first.** Distributions and league-wide context
before any individual ranking, and a deliberate decision — see "judge pages" in
[07-open-questions.md](07-open-questions.md) — before individual
judge stats go public at all.
