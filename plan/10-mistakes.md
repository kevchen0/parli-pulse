# Mistakes made building this

Every error that reached working code or a reported number, with the symptom
that revealed it. Recorded so they are not reintroduced — several were
reintroduced once already, in tooling written after the original fix.

Grouped by what they have in common, because the patterns matter more than the
individual bugs.

---

## Pattern A: a panel is not a ballot

Tabroom stores one ballot per judge. Treating ballots as rounds inflates
everything.

1. **Prelim records counted ballots, not rounds.** A three-judge panel gave a
   team three wins for one round, producing a 6-0 record at a four-round
   tournament — a record absent from the XXI.3.A table, so the team silently
   scored zero. *Found at Sid Fox: "Franklin Singer & St. Martin 6-0" in four
   rounds.*
2. **Elim rounds used `some(ballot.won)` rather than a majority.** A 1-2 panel
   decision read as a victory, promoting beaten finalists to champion — a full
   level, six points in every band. **This is Pattern A reintroduced**: the
   prelim path had already been fixed, the elim path had not. *Found because
   Piedmont was scored the winner of a final it lost 1-2.*
3. **TOC elim wins counted published rounds.** The TOC's final round is not in
   Tabroom, so champions came up one win short. Wins now derive from bracket
   position, which is independent of what got posted.

**Rule:** a round is won on a majority of its ballots. Never `some`. And never
count rounds when the rule pays per ballot — read tab's own `BalPm` instead.

## Pattern B: surnames are not identities

4. **Match keys stripped first initials.** `Egleson & S. Goyal` and
   `Egleson & N. Goyal` collapsed to one key — two real Menlo partnerships 73
   points apart. The matcher was rebuilt to disambiguate on initials, and then
   **the same bug was reintroduced in the comparison tooling**, which reported
   fabricated data problems until it was made to reuse the matcher. *Found
   because a diagnostic claimed a team at 81.0 was scoring 8.0.*
5. **Assumed Tabroom student ids are globally stable.** They are stable within
   a chapter. A debater entering under a club or independent registration gets
   a second id, splitting their season in half. *Found because Stuyvesant's top
   team, who also competed as "Rodda's Disciples", showed 78.4 against an
   official 83.*

**Rule:** all comparison and aggregation goes through
`scripts/lib/standings.ts` or `packages/ingest/src/matching.ts`. Never write a
new key.

## Pattern C: field sizes decide points before any table is consulted

6. **Counted bracket slots instead of teams.** `sections × 2` is the bracket
   size, not the break. Berkeley's double-octofinals had 16 sections but 12
   were byes, so 20 teams broke, not 32 — which lands in a different XXI.2.D
   penalty band.
7. **Skipped the forfeit exclusion (XXI.2.A) entirely**, then implemented it
   literally, which over-excluded: an unscored ballot is usually a result
   nobody entered. The literal reading reproduced 62% of official open fields;
   `dropped` OR three-plus missing reproduces 88%.
8. **Reported three "verified" champion scores that were wrong** — Berkeley 32,
   Cal 29, Nueva 29, actually 31, 28, 27 — because both errors above fed the
   AFS band.

**Rule:** validate field sizes against the `Tournaments` tab *before* trusting
any points figure. Stage 1 of the backtest exists for this.

## Pattern D: scoring a result is not the same as counting it

9. **Entries recovered from ballot labels got no debater rows.** Their points
   scored correctly and then vanished from every standing, because standings
   group by debater. 9.6% of all scored results. **Invisible to the per-entry
   backtest**, which checks scoring, not aggregation.
10. **The two-person test read `studentIds.length`.** Entries known only from
    ballots have no student records, so they read as zero-person teams and
    failed XXI.1.G. Same root cause as above, same invisibility.
11. **Hand-entered and sheet-scored results had no rows at load time.** Third
    instance of the same failure.

**Rule:** any new result source needs entries, debaters, *and* entry_debaters.
Assert that no scored result lacks a debater link — it is a one-line query.

## Pattern E: rule order matters

12. **Applied the XXI.3.B points floor to the final total.** It lifts the
    *base*, and adjustments apply on top. *Found at NYPDL September OL, where a
    4-1 breaking record floors octofinalists from 8 to 10 and the −1 break
    penalty still takes them to 9, not 10.* Fixing it took NYPDL 88% → 98%.
13. **Applied the TOC break penalty only to breaking teams.** XXI.4.A applies
    it to everyone; prelim-only TOC totals are odd numbers, which a
    two-points-per-ballot schedule cannot produce alone.
14. **Never passed walkover adjustments to the TOC scorer**, though XXI.5.C
    applies there too.

## Pattern F: guessing at missing data

15. **Credited unentered prelim rounds as wins at panel size.** An unentered
    round had a real winner the ballots do not record. Campolindo and Evergreen
    Valley shared such a room and the league credited it to one of them, not to
    both — which the heuristic could never get right. *The earlier "both teams
    were credited" conclusion was wrong; it fit only because I checked teams
    that needed the credit.*
16. **Promoted runners-up to champion whenever a final was unentered.** An
    over-correction while adding closeout detection; it overstated beaten
    finalists by six points until gated on the finalists sharing a school.

**Rule:** when data is missing, prefer tab's own published aggregate. Where
none exists, leave the gap and flag it. Do not infer a winner.

## Pattern G: duplicated logic drifts

17. **`backtest-points.ts` kept its own copy of the season computation** after
    the shared library was extracted, and reported pre-fix numbers while the
    partnership backtest reported post-fix ones. A fix looked like it had no
    effect for twenty minutes.
18. **An event-selection exclusion was written globally instead of per
    tournament.** A pattern meant to disambiguate one shared payload matched
    `Open Parli` everywhere and dropped 450 results.

## Infrastructure

19. **`apps/web` was an empty directory.** Git tracks files, not directories,
    so it never reached GitHub and could not be selected as a Vercel root.
20. **`next.config.ts` needed TypeScript to load**, before Next starts. A
    production install prunes devDependencies, so the Vercel build failed
    obscurely. Now `.mjs`, with the toolchain as a real dependency.
21. **Next reads `.env` from the app directory**, not the repo root, so local
    builds rendered "database not connected" while the scripts worked fine.

---

## What actually caught these

Ranked by yield:

1. **Backtesting against the league's own numbers**, sliced by tournament,
   category, result type, *and rule component*. Storing each adjustment in its
   own column is what made a mismatch name the rule that diverged.
2. **Auditing individual teams result by result.** Aggregate rates hid
   Pattern D completely — per-entry accuracy looked fine while a tenth of
   results never reached a standing.
3. **Testing a hypothesis instead of assuming it.** "Top teams share
   tournaments we score wrong" was wrong — accuracy is flat across rank bands —
   but chasing why led straight to Pattern D.
4. **Checking whether a fix actually moved the number.** Twice a fix appeared
   to do nothing; once it was stale duplicate code, once the wrong root cause.
