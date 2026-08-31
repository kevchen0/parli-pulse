# The pipeline

How a season gets from Tabroom into the site. [deploying.md](deploying.md) is
about shipping code; this is about building data.

You need `DATABASE_URL` and the raw payloads, which are gitignored and run to
about 800MB.

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

The scripts themselves live in `scripts/pipeline/`. `scripts/measure/` holds
the backtests and the comparisons against the league; `scripts/probe/` holds
one-off investigation tools that nothing schedules.

## Measuring it

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

## The database is not isolated by anything

`drizzle-kit migrate` and every script above read `DATABASE_URL`, which is
production on every branch and from a laptop. A migration or a reload reaches
the live site the moment it runs. Treat either as a deploy, and snapshot first.

## Rules for changing this

1. **Assume nothing about Tabroom.** The bulk endpoint is undocumented. Cache
   every payload so the site can be rebuilt offline.
2. **Read [../plan/10-mistakes.md](../plan/10-mistakes.md) before touching
   scoring or identity.** Several of those bugs were reintroduced once already,
   in tooling written after the original fix. The patterns recur; the specific
   bugs matter less than the rule at the end of each one.
3. **Anything that reads a season must take the season.** A workbook, a cache
   path, a clearing `UPDATE`, a hardcoded document id: each has silently used
   the wrong season at least once, and every time the output looked normal. A
   source that yields a plausible answer for the wrong input is worse than one
   that errors.
4. **Diff it, do not count it.** 288 merges and 286 merges look equally
   plausible and one of them had two people in one. Snapshot what you are not
   changing and compare it afterwards.
