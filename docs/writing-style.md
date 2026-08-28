# Writing style

For everything a reader sees: page copy, footnotes, table labels, empty
states. Not for code comments or `plan/`, which are written for whoever
maintains this.

The reference text is section 2 of `/method`, from "Our rating uses Glicko-2"
through the four edits. Read it before writing a new page.

---

## The register

Declarative and mechanical. State the problem, then the mechanism, then stop.

> Wins are skewed ~52% opposition in open rounds. With `p`, the proposition
> win rate:

Not:

> A raw speaker score says as much about the judge as the debater, which is
> the whole reason the normalisation exists.

Explain *why* in terms of what would otherwise happen:

> because three tournaments can happen on one weekend, which would count a
> team attending one of these tournaments as missing two periods

## Rules

**No contractions.** "does not", not "doesn't".

**Digits stay digits.** 20 ballots, 10 rounds, 4 edits. Not twenty, ten, four.
Do not mix the two forms in one sentence.

**Headings name a subject, not an attitude.** "Validation", not "Does it earn
its place". "Known limitation", not "A limitation, stated rather than papered
over".

**One short sentence before an equation, ending in a colon.** The definition
of symbols goes in the `defn` paragraph below it, with concrete values.

**Every number is checkable.** If a figure appears in prose it should be
reproducible from the pipeline or the database. Prefer rendering a constant
(`{MIN_BALLOTS}`) over typing one.

**Say who did it.** "We define `t` here as..." for our choices. The league's
figures are the league's.

**"We" everywhere except the biography.** The site speaks as a project, the way
a paper does, even though one person maintains it. The only first person
singular is the "About me" section, which is somebody introducing themselves.

## Do not write

Each of these was in the copy at some point and was cut.

| Pattern | Example |
|---|---|
| "not X, but Y" | "A strength rating, not a season total." |
| "says more about X than about Y" | "says more about which judges a debater drew than about the debater" |
| Em-dash asides | "the rating holds — which is the point — and only the deviation moves" |
| Aphoristic closers | "a warning nobody stops seeing is a warning that has stopped working" |
| "which is the point" / "that is the whole point" | |
| Rule-of-three narration | "It recomputes... It adds... And it normalizes..." |
| Rhetorical framing | "Three things to read off the table" |
| Verbed abstractions | "prices the judge", "what the deviation buys" |
| Personification | "ranking and prediction want different numbers" |
| "worth noting" / "worth saying" | throat-clearing before the actual claim |
| Unearned intensifiers | "exactly", "precisely", "genuinely", "actually" |
| "quietly" | "quietly compress everyone else" |
| Hedge pairs | "real but not comfortable" |
| Colon-then-restatement | clause, colon, the same clause reworded |
| Rhetorical question then answer | |

## Never publish

**Anything explaining what a low speaker score means.** Sub-scale scores exist
in the data and inform the normalisation. The site does not rank from the
bottom, flag an individual figure, or describe the convention, because
describing it teaches every reader to interpret a low score. Write around it:
"robust to outliers", "one unusually low score".

**Anything that identifies a debater as an individual beyond what the league
and Tabroom already publish.** See `/privacy`.

## Mechanics

JSX, so:

- `&rsquo;` for an apostrophe, `&mdash;`, `&ndash;`. A raw `'` breaks the build.
- `{' '}` at the end of a line before a tag is a real space. Deleting it welds
  words together.
- `{braces}` are code. `{MIN_BALLOTS}` renders 20.
- A footnote number appears twice: the `<FootnoteRef notes={[2]} />` marker and
  the `<li id="fn2">`. Keep footnote ids numeric — the marker renders the value
  as both the anchor and the visible label, and a word-shaped id printed
  "-recon" on three pages.

Before pushing:

```
npm run typecheck && npm test
```
