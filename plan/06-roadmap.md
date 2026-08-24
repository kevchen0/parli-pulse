# Roadmap

**Status:** phases 0-3 are complete and deployed. Phase 4 is in progress.

The 2026-27 season's first points-eligible tournament is Harvard, Sept 5-6
(August tournaments are excluded by XXI.1.H). Before then, run the seasonal
checklist in [09-data-quality.md](09-data-quality.md).

---

## Done

### Phase 0 — Foundation
Monorepo, TypeScript, Vitest. Article XXI constants encoded as typed data,
including the Elim Points Table the league publishes only as an image. Drizzle
schema, Neon Postgres, Vercel.

### Phase 1 — Rankings site
Team, debater and school standings at `/rankings`, served from Postgres, plus
a `/rankings/diagnostic` tab reconciling every partnership against the
league's published standings result by result.

### Phase 2 — Tabroom ingestion
Circuit-179 discovery, a cached `download_data` client, normalization, and
entity resolution. 96 tournaments, 4,872 entries, 3,127 debaters, 26,146
ballots, 32,267 speaker scores.

### Phase 3 — Article XXI engine and backtest
The full engine per [03-rules-engine.md](03-rules-engine.md), validated in
three stages: field sizes against the `Tournaments` tab, per-entry points
against `Entry` with each adjustment diffed separately, and season totals
against `team_calc`.

| | |
|---|---|
| Per-entry | **98%** (1529/1564) |
| NPDL-TOC, NYPDL | **100%** each |
| CHSSA | 99% |
| Regular invitationals | 96% |
| Partnerships, all 835 | **87% exact** |
| Top 100 | **92% exact**, 95% within 2% |

The gate was never 100% — `manual_adj` bakes human judgement into the league's
own figures. It was that every mismatch be explained, and they are, in
[09-data-quality.md](09-data-quality.md). Most are not ours to fix.

---

## Next

### Phase 4 — Speaker points *(in progress)*
Sentinel filtering, per-judge z-scores with shrinkage, display rescaling, then
speaker leaderboards and per-tournament speaker tabs.

Everything needed is loaded: 32,267 scores, 95% already attributed to a
specific debater, with the scale config known (25-30 default, NYPDL 23-30,
YFL 1 at 0-100). See [05-metrics.md](05-metrics.md) for the method and
[08-risks-policy.md](08-risks-policy.md) for why punitive scores are used but
never surfaced.

### Phase 5 — Glicko-2
Implement, tune on 2025-26, validate on held-out late-season rounds. Must beat
a naive "higher points wins" baseline or it does not ship.

### Phase 6 — Profiles and depth
Debater, team, school and tournament pages. Head-to-head records.

### Phase 7 — Live season
Scheduled ingest, "updated N hours ago", new-result diffing, and the
disagreement queue as an ops dashboard.

### Phase 8 — Historical archive
Static mirror of pre-2024 sheets, visually separated and never recomputed. See
[01-product.md](01-product.md) for why.

### Phase 9 — Judge scoring
Per-judge profiles: tournaments judged, panel rate, squirrel rate, speaker
generosity, side bias. Shrunk by sample size with visible confidence intervals,
launched aggregate-first. See [08-risks-policy.md](08-risks-policy.md).
