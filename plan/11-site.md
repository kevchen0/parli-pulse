# Site: structure, identity, and the pages that are missing

The data is right and the site is not yet a place people want to navigate. This
is the plan for that, in phases small enough to land one at a time and be
reacted to. More items will arrive; the last section is where they go.

Nothing here changes a number. It changes how the numbers are found, framed and
trusted.

---

## The problem, stated once

**Navigation describes our tables, not the reader's question.** One flat row —
Teams, Debaters, Schools, Speakers, Ratings, Diagnostic — mixes three unrelated
things: the league's official points, two measures of our own, and a developer
tool. A reader cannot tell from the tabs which numbers are the league's.

**The season control is a row of bare year pills.** It reads as debug output.
Seasons are the site's second axis and deserve a real control.

**The identity is a default.** Warm cream ground, terracotta accent, everything
in a floating rounded card. It is the look a generator reaches for, and the
Unofficial notice — the most legally important sentence on the site — is
currently shouting from inside one of those boxes at the very top, which makes
it easy to stop seeing.

**Emphasis has stopped meaning anything.** Bold is used for the banner, for
lede sentences, for footnote leads, for stat numbers, and inside running prose.
When everything is bold, nothing is.

---

**Status:** A, B, C and D landed, and a second pass on top of them: tables page
at fifty rows with search and a page-jump, totals carry amber and red marks where
the league's sheet has not settled, TOC standing splits into AQ and AL, and
navigation shows a skeleton on the page you clicked rather than holding you on
the one you left.

E is analytics only — the security headers are in `next.config.mjs` and TLS
never needed anything. What remains is in *Still to be specified* below.

**Phase F, profiles, has started.** Debater pages at `/<season>/debater/<id>`,
linked from all four tables. Two things they forced that were not on this list:

- **The loading boundary moved down.** It sat at `[season]/`, which put a
  Suspense boundary over every page under a season — and a page that streams has
  already sent its status, so a profile could not answer 404 for a debater who
  does not exist. It now sits in each of the four table segments that wanted it.
- **Suppression became real.** The Privacy page under Phase C promised a removal
  path and `debaters.suppressed` was read by nothing. A profile is the wrong
  place to discover that, so it was built first: one SQL fragment, one
  component, and a name that is withheld everywhere it appears rather than only
  on its own page.

## Phase A — Information architecture

The structure has to encode the one distinction the whole project rests on:
**what the league publishes, and what we computed ourselves.**

```
Parli Pulse                              Season: 2025–26 (Final) ▾

  Points      Ratings    Speakers    Method    About
  └ Teams · Debaters · Schools
```

- **Points** — Article XXI, the league's own figures. Teams, Debaters and
  Schools are three views of one thing and belong together under it.
- **Ratings** — ours. Top level, because it is not points and must never read
  as though it were.
- **Speakers** — ours. Alongside Ratings for the same reason.
- **Method** — how each number is produced. The rating methodology page moves
  here and is joined by an Article XXI page explaining the engine.
- **About** — why the site exists, who built it, privacy, feedback.
- **Diagnostic** — stays reachable but leaves the main row. It is a maintainer's
  reconciliation tool, not a reader's page. Eventually gated; for now, a link
  from Method.

**Season control.** A labelled dropdown carrying its status — `Season: 2025–26
(Final)` — not a row of pills. Placed in the header, right-aligned, so it reads
as a global filter rather than a page tab. A **Seasons** page lists every season
with its status for anyone browsing back.

## Phase B — Visual identity

Away from the cream-and-terracotta default. Two directions to choose between:

1. **Ink and slate.** Cool near-white ground, deep ink text, a single muted
   blue-slate accent. Quiet, institutional, easy to read for a long time. Reads
   as a reference work.
2. **Paper and oxblood.** Warm off-white with a desaturated deep red accent and
   a serif for headings. More editorial, more personality, slightly more risk.

Either way:

- **No floating rounded cards for structure.** A flat header with a hairline
  rule. Cards only where content genuinely tiles.
- **A real type pairing**, not the system stack. One face for headings, one for
  body, tabular figures everywhere digits align.
- **One accent**, used for links and the current-page marker, nowhere else.
  Semantic colour (a divergence, a warning) stays separate from it.
- **Bold discipline.** Bold marks a term being defined or the single number a
  stat line is about. Never a sentence in running prose. Audit every current use
  against that rule and delete the rest.

## Phase C — The missing pages

**About.** Why this exists, who built it, how it was built, and what it is not.
Should say plainly that it is one person's project, that the league's figures
are authoritative, and roughly how the engine reaches its numbers.

**Privacy.** The page that matters most and does not exist. Content:

- These are minors. What is shown: names, schools, results, points — all of it
  already published by the league or by Tabroom. Nothing is added.
- What is never shown: contact details, and no speaker-point figure that could
  identify an Article XIV conduct sanction. The `suppressed` flag exists and is
  honoured.
- Analytics: aggregate counts only, cookieless, no individual tracking.
- How to request removal, and who to ask.

**Method.** A hub. The rating specification moves under it; an Article XXI page
joins it explaining how points are computed and where our figures diverge from
the league's.

**Feedback.** A way to report a wrong number. Options in order of effort: a
mailto link; a GitHub issue template; a form writing to `manual_overrides`
behind a check. Start with the first, because a wrong number reported by email
is still reported.

## Phase D — Corrections and detail

**TOC qualification is currently shown in the wrong place — and both places are
needed.** The rules distinguish two things the site currently collapses:

- **XXII.1.A** — an *individual* with 40+ points on March 1 autoqualifies. The
  existing debater-level flag is correct for this and stays.
- **XXII.1.E** — only a *team* whose **both** partners autoqualified may accept
  a bid. That is the one that decides who goes, and it is not shown anywhere.

So: keep the debater marker, relabel it so it clearly means "autoqualified as an
individual", and add a distinct marker on Teams for partnerships where both
partners cleared it. Different words, not the same badge in two places.

**The Unofficial notice.** Out of the shouting box at the top. Into a persistent
but quiet position — a line in the header rule and a fuller statement in the
footer and on About. Present on every page, never the loudest thing on any of
them.

**Bold audit.** Phase B's rule, applied to every existing page.

## Phase E — Infrastructure

**TLS is already handled.** Vercel provisions and renews certificates
automatically for `*.vercel.app` and for any custom domain, via Let's Encrypt.
There is nothing to buy. The real question is whether the site gets a **custom
domain**, which is a naming decision (open question 14) rather than a security
one. HSTS and security headers are worth adding explicitly in `next.config`.

**Analytics.** Aggregate, cookieless, no consent banner. Vercel Web Analytics is
one package and one component; Plausible if a better dashboard is wanted later.
Whatever is chosen gets written down on the Privacy page before it ships.

**Diagnostic gating.** Eventually behind a check so the reconciliation queue is
a maintainer's tool. Not urgent while it is honest and public.

---

## Sequencing

A and D first: they are the ones that mislead a reader today. B next, because
identity is easier to apply once the structure has stopped moving. C alongside
B. E last, except analytics, which should wait for the Privacy page rather than
precede it.

| Phase | Lands | Depends on |
|---|---|---|
| A — architecture | Nav, season control, Seasons page | — |
| D — corrections | TOC markers, Unofficial notice, bold audit | A |
| B — identity | Palette, type, flat header | A |
| C — pages | About, Privacy, Method hub, Feedback | A |
| E — infrastructure | Headers, analytics, domain | C (privacy first) |

---

## Still to be specified

Where further changes go as they arrive. Nothing here is decided.

- Choice between the two visual directions in Phase B.
- Whether `/rankings` keeps forwarding once the nav is restructured, or whether
  Points gets its own path.
- ~~Pagination for the debaters table~~ — done; every table pages at fifty,
  server-side, so only the shown rows are rendered.
- Whether the Diagnostic gate is a login, an env flag, or an unlisted path.
- Custom domain and the public name (open question 14).
