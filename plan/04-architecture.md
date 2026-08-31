# Architecture

All TypeScript, one repo, one deploy target — chosen so a single maintainer
never context-switches languages.

```
parli-pulse/
├─ apps/web/              Next.js 15 App Router; seasons are routable
├─ packages/rules/        Article XXI engine (pure, heavily tested)
├─ packages/rating/       Glicko-2, the field prior, Bradley-Terry
├─ packages/speaks/       Speaker-point normalization
├─ packages/ingest/       Tabroom client, sheet mirror, entity resolution
├─ packages/db/           Drizzle schema + migrations
├─ scripts/               The pipeline, backtests and diagnostics
├─ .github/workflows/     Nightly ingest
├─ data/raw/              Cached payloads (gitignored, ~800MB)
├─ docs/                  Rules text, Elim Points Table image
└─ plan/                  This plan
```

## Routes

The season is in the URL rather than implied, so a link shared in August still
means what it meant when it was shared.

```
/                                     → the most recent season with results
/<season>/points                      Teams, and Debaters and Schools under it
/<season>/ratings                     ours
/<season>/speakers                    ours
/<season>/debater/<id>                a profile; any of a person's ids resolves
/<season>/internal/reconciliation     unlisted; against the league's sheet
/method /about /privacy /feedback     not about any one season
/api/feedback                         POST from the contact form
/robots.txt                           allows all but profiles, internal, api
/sitemap.xml                          static pages and every season's tables
/opengraph-image                      the link card, rendered from live ratings
/rankings/*                           forwards, mapped page by page
```

The reconciliation view is unlisted rather than gated: it enumerates by name
every place the league's spreadsheet and this engine disagree, which is a
maintainer's tool and not a reader's page. `/method/ratings` and
`/<season>/method/ratings` both redirect to `/method#rating`; the specification
is a section of one method page rather than a page under a season, because the
method does not change with the season.

## Stack

- **Next.js 15 on Vercel** (free tier), **Neon Postgres** + **Drizzle**.
- Data is small: ~1.6k entries and ~15k ballots per season.
- **Vitest** on `packages/rules` — that's where correctness risk lives.
- **Vercel Web Analytics** for page counts. Cookieless; unique visitors come
  from a hash Vercel rotates daily, so nothing identifies a person across two
  days. Disclosed on the Privacy page, which had committed to saying so before
  any analytics shipped.
- **Resend** delivers contact-form messages, behind `RESEND_API_KEY`. Absent
  the key, a message is still stored and the reader is still told it arrived,
  which is true.

## Ingestion

Runs as a **GitHub Actions cron** at 09:10 UTC, not a Vercel cron: raw payloads
reach 84 MB (Stanford) and Actions has no execution-time pressure.

**The league's sheet decides which tournaments exist.** The `Results` column of
its `Tournaments` tab holds a Tabroom URL, written in as each tournament is
scored; `fetch` takes the id from it and `load` accepts nothing else. The circuit
calendar finds 44 tournaments where the sheet finds 95, so it is reported as a
lookahead and never used for discovery — see [02-findings.md](02-findings.md).

It no longer decides which *teams* exist. Every open-division entry clearing
XXI.1.D is scored, listed or not, and a result worth nothing is stored and never
aggregated — 3,302 stored for 2025-26, of which 1,587 are worth points.

- Cache every payload by `tourn_id` + content hash. Unchanged tournaments are
  never re-fetched, and the whole site can be rebuilt offline.
- Re-fetch only tournaments ending within 45 days (the 30-day correction window
  plus slack).
- Sequential fetches with backoff. The endpoint is undocumented and
  unauthenticated; do not hammer it.
- The workbook and its cache are **keyed by season**. A new document is
  published each year and an unknown season throws rather than falling back:
  reading last season's sheet reports a full slate of finished tournaments and
  nothing about the output looks wrong.

**Points are computed from Tabroom.** Field sizes, break percentage, prelim
count, the breaking record, XXI.5.C walkovers and which teams exist are all
derived from the payload; `SOURCE=sheet` restores the old behaviour of
preferring the league's published figures, which is what the backtests want
because it isolates the points rules. The trade is 96% per-entry agreement
against 98%, taken deliberately: depending on the sheet for the numbers means
the check and the thing being checked share a source.

What the sheet still supplies is audited in
[07-open-questions.md](07-open-questions.md). Six things, of which two are
numbers — state qualifier placements and a prelim-only fallback, together 5.7%
of scoring entries — and two more decide *which school* a result belongs to,
which Tabroom cannot state for a club registration or a hybrid.

The chain is `fetch → load → rollup → speaks → rate → diagnostics`, and the
order is not negotiable — `rollup` settles identity, and everything after it
groups by what it settled. `check:rules` runs first of all, so a revised point
table stops ingestion rather than scoring a season under last year's rules.

## Branches and deployment

`main` is what is live. Nothing is committed to it directly. `dev` carries
day-to-day work and is identical to `main` between merges, so a squash-merge
ships only what was edited. `method-rewrite` holds the methodology page while
it is rewritten, separately, because otherwise every edit shipped from `dev`
would carry an unfinished page into production.

Vercel builds every branch, each to its own preview URL behind Vercel's login.
Merging a pull request into `main` is the deploy. Workflow in
[../docs/deploying.md](../docs/deploying.md).

**Branches do not isolate the database.** `drizzle-kit migrate` and every
pipeline script read `DATABASE_URL`, which is production on every branch and
from the maintainer's laptop.

## Credentials

Three roles, scoped by where they run rather than by what they do.

| where | role | rights |
|---|---|---|
| GitHub Actions | `parli_ingest` | select, insert, update, delete |
| Vercel | `parli_web` | select, plus insert on `feedback_messages` |
| the maintainer's laptop | owner | everything, including DDL |

Only the owner can migrate, which is why it stays local; `drizzle-kit migrate`
is never run by CI. `ALTER DEFAULT PRIVILEGES` covers tables a future migration
creates, so a new table is readable by both scoped roles without a manual grant.

## Data model

`tournaments`, `events`, `schools`, `debaters` (keyed on Tabroom student id),
`entries`, `entry_debaters`, `rounds`, `ballots` (entry, side, judge_person,
win/loss, raw speaks), `speaker_scores` (raw + z + display), `entry_results`
(computed points + full adjustment audit trail), `official_entry_results`
(sheet mirror), `official_tournament_stats` (sheet `Tournaments` tab),
`disagreements`, `ratings`, `judge_stats`, `manual_overrides`,
`feedback_messages`.

`feedback_messages` holds what the contact form receives. Stored as well as
emailed, because a message is a record of a request — a removal request
especially — and email is the one part that depends on a third party. The same
table rate-limits the form: counting a sender's recent rows is a distributed
limit needing no infrastructure beyond the database already here. `sender_hash`
is a salted SHA-256 of the client address, truncated; unsalted, a hash of an
IPv4 address is reversible in minutes.

`entry_results` stores each adjustment in its own column, mirroring the sheet's
shape, so a backtest mismatch points at the specific rule that diverged rather
than at a single opaque total.

`ratings` holds two kinds of row per subject: a historical one per rating period
carrying the rating as it stood after it, so a season can be charted, and one
with a null `tournament_id` — the current figure, its deviation widened for
however long the partnership has been away. A tournament is *two* periods,
prelims then elims, so a weekend usually writes two historical rows. Both carry
the same `tournament_id`, which is what the column has a foreign key to; the
period's own identity lives in the row id. The subject id is the partnership
key from `scripts/lib/identity.ts`, which is what lets a rating join to a
standings row.

## Entity resolution

Tabroom school names vary (`Mountain View`, `Mountain View/Mountain View`).
`SchoolList` is the canonical authority for school → short name → region.

**A partnership is a pair of people, then a collapse.** `debaters.canonical_id`
merges one person's several Tabroom records; `collapsePartnerships` in
`scripts/lib/identity.ts` then merges pairs that are the same partnership seen
twice, on school and surnames with no contradicting first name. Both the
standings and the rating go through it. They have to reach the same answer or
the site shows a team with points and no rating.

**Debaters key on Tabroom student id**, which is stable across tournaments.
This is strictly better than the sheet's surname matching — see the
`Mclean`/`McLean` case in [02-findings.md](02-findings.md), where one debater
appears twice in the official rankings. A manual `aliases` table covers the rest.

Hybrid entries carry two school ids; `entry_debaters` resolves each debater to
their own school so XXI.9.C's half-value split is computed from real membership
rather than a parsed team name.

## Disagreement handling

A first-class `disagreements` table, not a log file. Every divergence between
our computed value and the sheet's gets a row: entity, tournament, our value,
official value, the full adjustment trail, and a status:

`open` → `our_bug` | `sheet_manual_override` | `missing_tabroom_data` | `accepted_divergence`

- **Backend:** a triage queue with the adjustment trail rendered, so you can see
  exactly which rule diverged.
- **Frontend:** only `accepted_divergence` rows surface a small public flag
  ("our calculation differs from the official sheet here", with the reason).
  Everything else stays invisible until triaged. **The default display is always
  the official number.**
