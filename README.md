# Parli Pulse

A public rankings site for American high school parliamentary debate. It mirrors
the National Parliamentary Debate League's official Article XXI points, and adds
two things that exist nowhere today: a Glicko-2 partnership rating and
judge-normalized speaker points.

There is no other public rankings site for this format. DebateDrills covers LD
and PF only, and Debate Land is defunct. NPDL publishes its points in a Google
Sheet embedded on `parliamentarydebate.org` — accurate, and with no profiles, no
history, no head-to-heads and no way to browse it.

## What it does

**Points are computed, not copied.** Every figure is derived from Tabroom's
round data through an implementation of Article XXI — field sizes, break
percentages, the elimination points table, walkover adjustments, the
diminishing-returns weighting. The league's own sheet is kept alongside as a
check, and the two are reconciled result by result.

On the 2025-26 season that reaches **96% per-entry agreement** with the league's
published figures and **92%** on partnership season totals. Where the two
disagree, the disagreement is recorded rather than smoothed over, and the
league's number is what a reader sees.

**The rating earns its place or is reported as a failure.** On 2,209 held-out
rounds from February 2026 onward, Glicko-2 predicts 63.4% against the league
ranking's 59.8%, at a better log loss. The commitment was to publish that
comparison either way.

**These are minors.** Only what the league and Tabroom already publish appears;
nothing identifies an Article XIV conduct sanction; and a removal request is
honoured everywhere a name would otherwise show, including on other people's
pages.

## Running it

```bash
npm install
npm test                      # 167 tests
npm run typecheck
npm run dev --workspace @parli-pulse/web
```

The site is buildable without a database and reads as "not connected yet"
rather than crashing. To build a season you need `DATABASE_URL` and the raw
payloads, which are gitignored and about 800MB:

```bash
npm run fetch                 # cache payloads named by the league's sheet
npm run check:rules           # stop if the Board Code has been revised
npm run load                  # score the season   (SEASON= to pick one)
npm run rollup                # identity merging, then standings
npm run speaks                # judge-normalized speaker points
npm run rate                  # Glicko-2 partnership ratings
npm run diagnostics           # the reconciliation the site displays
npm run mark-ingest           # record the run; the site shows how fresh it is
```

**The order is not negotiable.** `rollup` decides who is one person and who is
two, and everything after it groups by the identities it settles.
`.github/workflows/ingest.yml` runs the whole chain nightly.

### Measuring it

| | |
|---|---|
| `npm run backtest` | field sizes, per-entry points, partnership totals |
| `npm run compare` | agreement across the league's top 100 |
| `npm run compare:sources` | what the league's own inputs are worth, one at a time |
| `npm run compare:entries` | scoring every Tabroom entry against only the league's list |
| `npm run check:walkovers` | XXI.5.C derived from Tabroom against the league's column |
| `npm run validate:rating` | the held-out comparison against the league's ranking |

`SOURCE=sheet` on `load` or any backtest restores the league's own field sizes.
That is the right instrument for asking whether a *rule* is wrong — it isolates
the points rules, so a mismatch can never be a field-size mismatch in disguise —
and the wrong default for a pipeline that has to score a tournament before the
league writes it up.

## Layout

```
apps/web/          Next.js 15, App Router; seasons are routable
packages/rules/    Article XXI engine — pure, and where correctness risk lives
packages/rating/   Glicko-2, the field prior, Bradley-Terry
packages/speaks/   speaker-point normalization
packages/ingest/   Tabroom client, sheet mirror, entity resolution
packages/db/       Drizzle schema and migrations
scripts/           the pipeline, backtests and diagnostics
plan/              why every one of the above is the way it is
```

All TypeScript, one repo, one deploy target, chosen so a single maintainer never
context-switches languages. Node runs the `.ts` files directly — no build step,
which is why imports carry explicit `.ts` extensions.

## The plan

`plan/` is the project's memory: what was measured, what was decided, and what
went wrong. It is not a design document written in advance — most of it was
written after finding something out.

| | |
|---|---|
| [00-session-log.md](plan/00-session-log.md) | **Current state and handoff. Read this first.** |
| [01-product.md](plan/01-product.md) | What is being built and why; the pages and surfaces |
| [02-findings.md](plan/02-findings.md) | **Measurements.** Everything verified against live data |
| [03-rules-engine.md](plan/03-rules-engine.md) | Article XXI implementation spec |
| [04-architecture.md](plan/04-architecture.md) | Stack, data model, ingestion, entity resolution |
| [05-metrics.md](plan/05-metrics.md) | Glicko-2, speaker points, judge scoring |
| [06-roadmap.md](plan/06-roadmap.md) | Phases, sequencing, status |
| [07-open-questions.md](plan/07-open-questions.md) | What is unresolved, and what the sheet still supplies |
| [08-risks-policy.md](plan/08-risks-policy.md) | Risks, privacy, and editorial policy |
| [09-data-quality.md](plan/09-data-quality.md) | **Known gaps, hand entries, seasonal checklist** |
| [10-mistakes.md](plan/10-mistakes.md) | **Errors made and the patterns behind them. Read before changing scoring** |
| [11-site.md](plan/11-site.md) | Site structure, visual identity, and the pages that were missing |

## Ground rules

1. **Article XXI governs.** Where recollection, convention or intuition
   conflicts with the rules text, the text wins — and where the text is
   ambiguous, the league's own behaviour is the tiebreak. Every rule in
   [03-rules-engine.md](plan/03-rules-engine.md) was verified against real data
   before being written down.
2. **Never contradict NPDL in public.** Its points are displayed as
   authoritative. Ours run alongside as a check, and a disagreement goes to a
   triage queue rather than onto the page.
3. **Compute it, then check it against the league.** A figure read from the
   sheet cannot also verify the sheet. Where the two must differ, say so.
4. **Assume nothing about Tabroom.** The bulk endpoint is undocumented. Cache
   every payload so the site can be rebuilt offline.
5. **Read [10-mistakes.md](plan/10-mistakes.md) before touching scoring or
   identity.** Several of those bugs were reintroduced once already, in tooling
   written after the original fix. The patterns recur; the specific bugs matter
   less than the rule at the end of each one.
6. **Anything that reads a season must take the season.** A workbook, a cache
   path, a clearing `UPDATE`, a hardcoded document id: each has silently used
   the wrong season at least once, and every time the output looked normal. A
   source that yields a plausible answer for the wrong input is worse than one
   that errors.
7. **Diff it, do not count it.** 288 merges and 286 merges look equally
   plausible and one of them had two people in one. Snapshot what you are not
   changing and compare it afterwards.

## Status

Phases 0–7 are complete and deployed; Phase 6 is half done, with debater
profiles live and team, school and tournament pages still to come. The season
ingests itself nightly and its points are computed from Tabroom.

Unofficial, and not affiliated with the NPDL.
