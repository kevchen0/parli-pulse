# Architecture

All TypeScript, one repo, one deploy target — chosen so a single maintainer
never context-switches languages.

```
parli-pulse/
├─ apps/web/              Next.js 15 App Router
├─ packages/rules/        Article XXI engine (pure, heavily tested)
├─ packages/rating/       Glicko-2
├─ packages/speaks/       Speaker-point normalization
├─ packages/ingest/       Tabroom client, sheet mirror, entity resolution
├─ packages/db/           Drizzle schema + migrations
├─ data/raw/              Cached payloads (gitignored)
├─ docs/                  Rules text, Elim Points Table image
└─ plan/                  This plan
```

## Stack

- **Next.js 15 on Vercel** (free tier), **Neon Postgres** + **Drizzle**.
- Data is small: ~1.6k entries and ~15k ballots per season.
- **Vitest** on `packages/rules` — that's where correctness risk lives.

## Ingestion

Runs as a **GitHub Actions cron**, not a Vercel cron: raw payloads reach 84 MB
(Stanford) and Actions has no execution-time pressure.

- Cache every payload by `tourn_id` + content hash. Unchanged tournaments are
  never re-fetched, and the whole site can be rebuilt offline.
- Re-fetch only tournaments ending within 45 days (the 30-day correction window
  plus slack).
- Sequential fetches with backoff. The endpoint is undocumented and
  unauthenticated; do not hammer it.

## Data model

`tournaments`, `events`, `schools`, `debaters` (keyed on Tabroom student id),
`entries`, `entry_debaters`, `rounds`, `ballots` (entry, side, judge_person,
win/loss, raw speaks), `speaker_scores` (raw + z + display), `entry_results`
(computed points + full adjustment audit trail), `official_entry_results`
(sheet mirror), `official_tournament_stats` (sheet `Tournaments` tab),
`disagreements`, `ratings`, `judge_stats`, `manual_overrides`.

`entry_results` stores each adjustment in its own column, mirroring the sheet's
shape, so a backtest mismatch points at the specific rule that diverged rather
than at a single opaque total.

`ratings` holds two kinds of row per subject: one per tournament, carrying the
rating as it stood after that rating period so a season can be charted, and one
with a null `tournament_id` — the current figure, its deviation widened for
however long the partnership has been away. The subject id is the partnership
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
