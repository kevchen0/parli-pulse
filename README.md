# Parli Pulse

**[parli-pulse.vercel.app](https://parli-pulse.vercel.app)**

A public rankings site for American high school parliamentary debate. It
computes the National Parliamentary Debate League's Article XXI points from
Tabroom's round data, and adds two figures of its own: a Glicko-2 partnership
rating and judge-normalized speaker points.

Points, ratings and speaker standings are browsable by season — for
partnerships, for debaters and for schools — and every debater has a page that
opens their season tournament by tournament and round by round.

## What it does

**Points are computed, not copied.** Every figure is derived from Tabroom's
round data through an implementation of Article XXI — field sizes, break
percentages, the elimination points table, walkover adjustments, the
diminishing-returns weighting. The league's own sheet is kept alongside as a
check, and the two are reconciled result by result.

On the 2025-26 season that reaches **96% per-entry agreement** with the league's
published figures and **92%** on partnership season totals. Where the two
disagree, the disagreement is recorded rather than smoothed over, and the
league's number is what a reader sees. NPDL's points are the official ones;
ours run alongside as a check, never as a correction.

**The rating earns its place or is reported as a failure.** On 2,209 held-out
rounds from February 2026 onward, Glicko-2 predicts 63.4% against the league
ranking's 59.8%, at a better log loss. The commitment was to publish that
comparison either way. How every figure is produced is on the site itself, at
`/method`.

**These are minors.** Only what the league and Tabroom already publish appears;
nothing identifies an Article XIV conduct sanction; and a removal request is
honoured everywhere a name would otherwise show, including on other people's
pages. Debater profiles are excluded from search engines twice over — by
`robots.txt` and by `noindex` — because a table is a page about a competition
and a profile is a page about one child.

## Layout

```
apps/web/          Next.js 15, App Router; seasons are routable
packages/rules/    Article XXI engine — pure, and where correctness risk lives
packages/rating/   Glicko-2, the field prior, Bradley-Terry
packages/speaks/   speaker-point normalization
packages/ingest/   Tabroom client, sheet mirror, entity resolution
packages/db/       Drizzle schema and migrations
scripts/pipeline/  the nightly chain that builds a season
scripts/measure/   backtests, and the comparisons against the league
scripts/probe/     one-off investigation tools
docs/              how to run the pipeline, how to deploy, how to write the copy
plan/              why every one of the above is the way it is
```

All TypeScript, one repo, one deploy target, chosen so a single maintainer never
context-switches languages. Node runs the `.ts` files directly — no build step,
which is why imports carry explicit `.ts` extensions.

## Running it

```bash
npm install
npm test                      # 186 tests
npm run typecheck
npm run dev --workspace @parli-pulse/web
```

The site is buildable without a database and reads as "not connected yet"
rather than crashing, so this is enough to see it.

Building a season from Tabroom needs `DATABASE_URL` and about 800MB of cached
payloads. That chain, the order it has to run in, and what each check is for
are in [docs/pipeline.md](docs/pipeline.md). Deploying is
[docs/deploying.md](docs/deploying.md), and the copy the site shows follows
[docs/writing-style.md](docs/writing-style.md).

## Licence

The code is MIT, in [LICENSE](LICENSE).

**That covers the code and not the data.** Results, names and schools belong to
the league and to Tabroom, and appear here because both publish them. Nothing
in the licence grants anyone the right to redistribute records about minors.

If you run your own instance, the removal requests honoured here do not travel
with a fork — `debaters.suppressed` is a column in this database, not a fact in
the source — so you are responsible for your own. See
[plan/08-risks-policy.md](plan/08-risks-policy.md) for what that involves.

## The plan

`plan/` is the project's memory: what was measured, what was decided, and what
went wrong. It is not a design document written in advance — most of it was
written after finding something out. Start at
[plan/00-session-log.md](plan/00-session-log.md), which is the current state and
the handoff, and read [plan/10-mistakes.md](plan/10-mistakes.md) before changing
anything that scores or identifies.

## Status

Live, indexed, and ingesting nightly. Phases 0–7 are complete; Phase 6 is half
done, with debater profiles live and team, school and tournament pages still to
come. `/method` reads "Coming soon!" while the methodology page is rewritten on
the `method-rewrite` branch.

Unofficial, and not affiliated with the NPDL.
