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

25. **The rating's round extraction counted a panel twice.** Tabroom writes one
    ballot per judge *per entry*, so a single-judge round holds two rows and a
    three-judge round holds six. Taking the section's total as the panel size
    made every ordinary round a 1-1 tie: 3,893 of 8,064 rounds were thrown away
    as undecided. **This is Pattern A for the third time**, in a third piece of
    code, written an hour after reading the two entries above it. *Found because
    the skip count came out larger than the keep count.*

**Rule:** a round is won on a majority of its ballots. Never `some`. And never
count rounds when the rule pays per ballot — read tab's own `BalPm` instead.
The panel size is the ballots on **one** side of a section, never the sum. Any
new consumer of ballot data should print what it discarded and the number should
be looked at: every instance of this pattern has been visible in a count.

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

22. **Identity merging under-merged, splitting partnerships across several
    team rows.** Diamond Bar's Liu & Zhu existed three times — 37.5, 17.3 and
    9.0 — because their three registrations produced debater records that never
    unified. Merging keyed on full name, so label-recovered records carrying no
    first name could not group at all. Two keys are needed: full name across
    schools, and school-plus-surname for records with no first name, unioned.
23. **Treated a first-name abbreviation as a different person.** Tabroom writes
    "M" where the league writes "Melina", which split a partnership in half.
24. **Synthesized debaters from the normalized match key**, so "Cassel Engen"
    became "casselengen" and never tied back to the student record carrying the
    space. Synthetic records must use the league's own spelling.

26. **The rating keyed partnerships on the canonical debater pair, which is not
    what a partnership is.** `rollup` collapses pairs a *second* time, on school
    and surnames, because a label-recovered record carrying no first name never
    merges into its student record — item 22 above, patched at the team level
    rather than the debater level. The rating did not know about the second
    collapse, so a partnership the standings treat as one was rated as two, each
    on half the evidence. **Pattern G as much as Pattern B**: the rule existed,
    inline, in one script. *Found by checking how many of the league's 799
    partnerships got a rating, and asking why any did not.*

**Rule:** all comparison and aggregation goes through
`scripts/lib/standings.ts`, `scripts/lib/identity.ts`, or
`packages/ingest/src/matching.ts`. Never write a new key. Identity needs *both*
over- and under-merge guards: distinct first names and different partners at one
tournament prove two people; an abbreviation and a missing first name prove
nothing. And a partnership is not its debater pair — it is that pair after the
collapse in `identity.ts`.

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

**Rule:** when a second caller needs a rule that already exists inline, move the
rule rather than copying it — and prove the move changed nothing. Extracting the
partnership collapse out of `rollup.ts` was verified by snapshotting every
standings row before and after and diffing them; that check costs a minute and
is the only reason the extraction could be trusted.

## Pattern H: a model that manufactures confidence

27. **Seeding a new partnership made it more certain than the partnerships it
    came from.** A new pairing starts at the average of its two debaters'
    ratings, and the deviation was computed as the deviation of that average —
    which, for two independent estimates, is smaller than either. So a pair who
    had never debated together arrived better established than the partnership
    one of them had built over six tournaments, and two debaters nobody had ever
    seen arrived at 275 rather than the default 350. The arithmetic is right for
    two readings of one quantity and wrong here: a pair is not the mean of its
    debaters, it only tends to be. *Found by a test asserting the obvious —
    that two unknowns produce an unknown.*

**Rule:** any prior that combines evidence has to be checked at its degenerate
ends. Combining no information must yield no information, and a derived estimate
must never come out surer than what it was derived from. Both are one-line
assertions and both failed on the first implementation.

## Infrastructure

19. **`apps/web` was an empty directory.** Git tracks files, not directories,
    so it never reached GitHub and could not be selected as a Vercel root.
20. **`next.config.ts` needed TypeScript to load**, before Next starts. A
    production install prunes devDependencies, so the Vercel build failed
    obscurely. Now `.mjs`, with the toolchain as a real dependency.
21. **Next reads `.env` from the app directory**, not the repo root, so local
    builds rendered "database not connected" while the scripts worked fine.
28. **Node's type stripping rejects TypeScript parameter properties.** There is
    no build step, so `constructor(private readonly x: T) {}` is a runtime
    `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` — and `tsc --build` passes it happily,
    so the typecheck says nothing. Declare the field and assign it.
29. **A new workspace package needs `npm install` before Next can import it.**
    `packages/rating` typechecked, tested and ran from scripts, then the page
    failed with "Can't resolve '@parli-pulse/rating'": nothing had created the
    `node_modules` symlink. Scripts import packages by relative path and never
    notice; only the web app uses the `@parli-pulse/*` specifiers.

30. **An unordered query fed an order-sensitive collapse.** The section
    extraction had no `ORDER BY`, and the partnership collapse names a group
    after the first pair it sees. Postgres does not promise an order without
    one, so identical runs of the validation disagreed — 64.0% one run, 63.4%
    the next, with no code change between — and the variant selection picked a
    different winner each time. Any query whose row order reaches a decision
    needs an explicit `ORDER BY`, and a script whose output should be
    reproducible should be run twice and diffed before its numbers are quoted.
31. **`tsc --build` passed while the script crashed at runtime, twice.** Both
    times an identifier was genuinely undefined — once a missing import, once a
    helper that had been renamed — and both times the incremental build info
    was stale enough to report success. `npm run typecheck` is not proof a
    script runs. Run the script.

**Rule:** a number nobody re-derived is a number nobody has checked. Run it
twice, and run it after the typecheck rather than instead of it.

32. **Named a correlation as the cause and built the explanation on it.** Two
    partnerships were wrongly top of the board; both were thin *and* debated
    almost entirely in-region, and I concluded the cause was pool isolation, that
    deviation could not see connectivity, and that the field prior fixed it. The
    first claim was untestable as stated and the third was false. Shrinkage is
    blind to who a partnership played: in-region share is uncorrelated with
    round count (-0.02) and deviation (0.03), and among partnerships with forty
    rounds or more the shrinkage applied is flat across in-region share. The fix
    worked because the offenders were *thin*, which is a different problem with
    the same two examples. It reached a plan document, four source docstrings and
    a public methodology page before the coach asked the obvious question: tau is
    global and RD knows nothing about regions, so by what mechanism?

**Rule:** when a fix works, check it works *for the reason claimed* -- find the
cases that have the supposed cause without the correlate, and confirm the fix
still fires. A mechanism nobody tested is a story, and it will be repeated in
every document that cites it.

33. **Built discovery on the wrong source, and it looked like it worked.** The
    fetcher read Tabroom's circuit-179 calendar because a note in
    plan/02-findings.md recommended it. On 2025-26 that finds 44 tournaments
    against the 95 the season actually used, and would have fetched 37 --
    silently ingesting 39% of a season, with Jack Howe, Yale, Sid Fox and La
    Costa Canyon simply absent. The real source is the `Results` column of the
    rankings sheet, which `sheet.ts` had been reading correctly all along. The
    note was comparing the calendar against a *different* sheet.
34. **A season-keyed document read from a hardcoded id.** `SHEET_ID` pointed at
    the 2025-26 workbook, so `SEASON=2026-27 npm run fetch` reported 96
    tournaments with results links -- every one of them last season's, all
    finished, and nothing in the output looking wrong. The same fallback then
    turned up again in `load.ts`, where an unsuffixed cache filename meant
    2026-27 would read 2025-26's sheet. Both now throw or use a season-scoped
    path instead of quietly resolving to the most recent thing available.

**Rule:** a source that yields a plausible non-empty answer for the wrong input
is worse than one that errors. Where a resource is keyed by season, key the
lookup by season and fail on a miss -- and check a new data source against a
season whose answer is already known before trusting it.

### Found by the first end-to-end run against an empty season

All four were live before that run, and two were quietly damaging 2025-26.

35. **`speaks` cleared every normalized score in the database.** The statement
    that resets `z`, `display` and `excluded` before recomputing had no season
    filter, so running the season with no results in it set `z` to null on all
    27,013 of 2025-26's ballots. **Nothing on the site looked wrong** — the
    totals tables are season-scoped and survived — so the damage sat one level
    down, in the per-ballot figures those totals are rebuilt from. Found only
    because the run was snapshotted first.
36. **Identity merging was not deterministic.** Its ranking fell through to
    appearance count with no total tiebreak, so two records tying on every test
    were ordered by however Postgres returned them. Seven debaters changed
    canonical id on a run that loaded no new data — and every row id keyed on a
    partnership moves with them: team totals, speaker totals, ratings. It would
    have churned nightly, forever, for nothing.
37. **`build-diagnostics` read 2025-26's workbook whatever season it was given**,
    reconciling last season's sheet and writing 830 rows tagged 2026-27, for a
    season with no results at all. Fixed once at the top of the file and
    reintroduced immediately by `computeSeason()`, whose *default argument* is
    the same hardcoded path.
38. **The pipeline could not run where there is no `.env`.** `--env-file=.env`
    requires the file; a CI runner has the values in the environment instead.
    Every script died before executing a line. `load` then crashed on a payload
    directory that does not exist until something has been fetched, which is the
    state every season starts in.

**Rule:** run the whole chain against an empty season before trusting it, and
snapshot the season you are not touching first. Three of these four were
invisible in the output and two were destructive; only a before-and-after diff
of the untouched season showed them at all.

### Found building the first profile page

39. **A policy was written on the public site and implemented nowhere.** The
    Privacy page committed to a removal path -- "the name will not appear" --
    and `debaters.suppressed` was written by the loader as `false` and read by
    no query, no page and no test. Nobody had asked to be removed, so nothing
    was visibly wrong and nothing would have been until the first request
    arrived, which is the worst possible moment to find out. The name expression
    had been written out inline in five queries, which is the structural reason:
    a check that has to be remembered five times gets missed once, and here it
    was missed five times out of five.

40. **A page that streams cannot answer with a status.** `[season]/loading.tsx`
    opens a Suspense boundary over its whole subtree, so every page under it
    flushes its shell before the page component runs. `notFound()` and
    `redirect()` still rendered the right thing, and both had already gone out
    as `200` -- a crawler was told every one of ~4,000 possible debater ids
    existed, and a merged id resolved to its canonical one only for a reader
    running JavaScript. Moving the boundary down to the four table segments that
    wanted it fixed both. *Found by checking the status code rather than the
    page, which looked entirely correct.*

41. **Ordered rounds by the round id.** Tabroom allocates ids as rounds are
    *created*, and several tournaments built their elim brackets before their
    prelims -- so Harvard listed the octafinals, quarters and semis above round
    one. Every number on the page was right and the sequence was fiction. The
    round label cannot do the job either; they are bare integers that restart at
    some tournaments and run on at others.

**Rule:** a promise on the site is a feature with a test, or it is not a
promise -- grep the flag, not the page. And an ordering is a claim like any
other: it was read off an id that means creation order, and nothing about the
output looked wrong, because a list is always in *some* order.

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
   The converse caught #30: a number that moved when nothing had changed.
5. **Writing the test that asserts the obvious.** Pattern H was found by a test
   saying two unknown debaters make an unknown partnership — a line nobody would
   write if they were only testing what they thought was hard.
6. **Reading the counts a script prints about what it threw away.** Both new
   Pattern A instances and the identity drift showed up as a number that was the
   wrong size, before any of them showed up as a wrong rating.
7. **Being asked how something works by someone who will not accept the
   summary.** #32 survived being written into five places and died in one
   question from the coach, who knew the circuit and could see the mechanism did
   not follow.
8. **Snapshotting the thing you are not changing.** Running the pipeline for an
   empty season should have touched nothing else. Diffing 2025-26 before and
   after is what exposed #35 and #36, neither of which changed anything visible.
9. **Reading a page as a machine would.** #40 was invisible to every check that
   looked at the rendered page, which was correct throughout. One `curl -w
   '%{http_code}'` found it. The same habit would have found #39 years earlier:
   the Privacy page said what it did, and nobody grepped for the column.
