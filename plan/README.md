# Parli Pulse — Plan

A public rankings site for American high school parliamentary debate (NPDL):
official Article XXI points, plus an independent Glicko-2 rating and
judge-normalized speaker points that exist nowhere today.

## Contents

| File | What it holds |
|---|---|
| [00-session-log.md](00-session-log.md) | **Current state and handoff. Read this first.** |
| [01-product.md](01-product.md) | What we're building and why; the pages and surfaces |
| [02-findings.md](02-findings.md) | **Measurements and known facts.** Everything verified against live data |
| [03-rules-engine.md](03-rules-engine.md) | Article XXI implementation spec |
| [04-architecture.md](04-architecture.md) | Stack, data model, ingestion, entity resolution |
| [05-metrics.md](05-metrics.md) | Glicko-2, speaker points, judge scoring |
| [06-roadmap.md](06-roadmap.md) | Phases, sequencing, status |
| [07-open-questions.md](07-open-questions.md) | What's still unresolved, grouped by when it blocks |
| [08-risks-policy.md](08-risks-policy.md) | Risks, privacy, and editorial policy |
| [09-data-quality.md](09-data-quality.md) | **Known gaps, manual entries, seasonal checklist** |
| [10-mistakes.md](10-mistakes.md) | **Errors made and the patterns behind them. Read before changing scoring** |

## Ground rules

1. **Article XXI governs.** Where recollection, convention, or intuition
   conflicts with the rules text, the text wins — and where the text is
   ambiguous, the official sheet's behavior is the tiebreak. Every rule in
   [03-rules-engine.md](03-rules-engine.md) was verified against real data
   before being written down.
2. **Never contradict NPDL in public.** The official points are mirrored and
   displayed as authoritative. Our own computation runs alongside as a check,
   and disagreements go to a triage queue rather than onto the page.
3. **Assume nothing about Tabroom.** The bulk endpoint is undocumented. Cache
   every payload so the site can always be rebuilt offline.
4. **Read [10-mistakes.md](10-mistakes.md) before touching scoring or
   identity.** Several bugs there were reintroduced once already, in tooling
   written after the original fix. The patterns recur; the specific bugs are
   less important than the rules at the end of each one.

## Status

Phases 0-5 complete; Phase 6 (profiles) is next. Per-entry Article XXI
agreement is 98%, partnership season totals 87% exact, and the league's top 100
92% exact. The Glicko-2 rating beats the league's own ranking at predicting
held-out rounds, 63.4% against 61.2%.

See [00-session-log.md](00-session-log.md) for the handoff and
[06-roadmap.md](06-roadmap.md) for the phases.
