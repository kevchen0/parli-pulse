# The product

## Why

There is no public rankings site for American high school parliamentary debate.
DebateDrills covers LD and PF only. Debate Land is defunct (`debate.land`
returns 500; its `tournaments.tech` API is dead). NPDL publishes official
Article XXI points in a Google Sheet embedded on
`parliamentarydebate.org/rankings-2025-26` — accurate, but hard to browse, with
no debater profiles, no history, no head-to-heads, no speaker analysis, and no
rating metric.

## What

Two parallel systems, always clearly distinguished:

1. **Official Article XXI points** — mirrored from NPDL, displayed as
   authoritative, never contradicted in public.
2. **Glicko-2 rating** — our own, computed from raw Tabroom round data.
   Visually distinct, and never labeled "rankings."

Plus **judge-normalized speaker points**, which exist nowhere today.

## Surfaces

**Rankings** — team, individual, school, and TOC-qualification tables. Search,
region filter, per-team top-5 point breakdown showing the diminishing-returns
weights. Rating and normalized speaks as additional columns.

**Profiles** — debater (career arc, partner history, tournament-by-tournament
results, speaks trend), team, school.

**Tournaments** — field sizes, break line, full bracket, per-round results,
speaker awards.

**Head-to-head** — record between any two teams or debaters.

**Editorial** — the interesting surface is where the two systems disagree: most
underrated by points, teams whose rating outruns their tournament count.

## Season coverage

The rules have changed materially over time, so older seasons are not
comparable to current ones and should not be blended into one live system.

- **Through 2023-24 (data exists back to ~2019):** archival. Present these as a
  clean, well-designed static mirror of the historical sheets. No recomputation,
  no rating — the rules those points were computed under no longer apply, and
  recomputing them under today's rules would produce numbers that never existed.
- **2024-25 onward:** dynamic. Full Tabroom ingestion, our own Article XXI
  computation, Glicko-2, and speaker normalization. Exact start season (24-25 vs
  25-26) to be confirmed — see [07-open-questions.md](07-open-questions.md).

A visible boundary in the UI between "archive" and "live" seasons, so nobody
reads a 2021 number as commensurable with a 2026 one.
