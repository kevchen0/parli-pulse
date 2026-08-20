# Roadmap

Phases 1-3 are the critical path. Phase 1 is independently launchable.

**Timing:** the 2026-27 season's first points-eligible tournament is Harvard,
Sept 5-6 (August tournaments are excluded by XXI.1.H).

---

### Phase 0 — Foundation — *in progress*
Repo, workspace, Drizzle schema, CI. Article XXI constants encoded as typed data.

- [x] Monorepo scaffold, TypeScript config, Vitest
- [x] `packages/rules/src/constants.ts` — Elim Points Table and all rule constants
- [x] `packages/rules/src/elim.ts` + tests (47 passing, including the structural
      invariant that the table's stepped border follows bracket size)
- [x] Tabroom payload types
- [ ] Drizzle schema
- [ ] Neon + Vercel provisioning — **blocked on your accounts**

### Phase 1 — Sheet mirror
Ingest every tab. Ship team / individual / school / TOC-qual rankings with
search, region filter, and point breakdowns. Launchable on its own; de-risks
everything after it.

### Phase 2 — Tabroom ingestion
Circuit-179 discovery, cached `download_data` client, normalization, entity
resolution against `SchoolList` and student ids. Clean round-level data, no
scoring yet.

### Phase 3 — Article XXI engine + backtest *(the hard part)*
Full engine per [03-rules-engine.md](03-rules-engine.md). Two-stage validation:

1. **Field sizes** against the `Tournaments` tab (117 rows) — open field, N/JV,
   AFS, elim field, break %, penalties. Most of the difficulty lives here.
2. **Points** against the `Entry` tab (1,612 rows), diffing each adjustment
   column separately so a mismatch points at the specific rule that diverged.

**Gate:** every mismatch classified — not necessarily 100% match, since
`manual_adj` bakes in human judgment by construction.

### Phase 4 — Speaker points
Sentinel filtering, per-judge z-scores with shrinkage, display rescaling.
Speaker leaderboards and per-tournament speaker tabs.

### Phase 5 — Glicko-2
Implement, tune on 2025-26, validate on held-out late-season rounds. Rating
columns and history charts.

### Phase 6 — Profiles and depth
Debater, team, school, and tournament pages. Head-to-head records.

### Phase 7 — Live season
Scheduled ingest, "updated N hours ago", new-result diffing, disagreement queue
as an ops dashboard.

### Phase 8 — Historical archive
Static mirror of pre-2024 sheets. Separate visual treatment, no recomputation.
See [01-product.md](01-product.md) on why these stay archival.

### Phase 9 — Judge scoring *(future)*
Per-judge profiles: tournaments judged, rounds, panel rate, squirrel rate,
speaker generosity, side bias. All shrunk by sample size with visible confidence
intervals. Launch aggregate-first — see [08-risks-policy.md](08-risks-policy.md).
