# Deploying

Merging a pull request into `main` is the deploy. Vercel rebuilds and
`parli-pulse.vercel.app` swings to the new build, usually inside a minute.

## Branches

| Branch | Holds | Preview URL |
|---|---|---|
| `main` | what is live | parli-pulse.vercel.app |
| `dev` | day-to-day edits, one page at a time | parli-pulse-git-dev-kevchen01.vercel.app |
| `method-rewrite` | the full methodology page while it is rewritten | parli-pulse-git-method-rewrite-kevchen01.vercel.app |

`dev` starts each cycle identical to `main`, so a squash-merge from it ships
only what you edited and nothing else.

`method-rewrite` is separate because it holds an unfinished page. If the
rewrite lived on `dev`, every footnote edit shipped from `dev` would drag that
page into production with it.

Preview URLs are behind Vercel's login. Sign in and they open; a stranger with
the link gets a login page.

## The cycle

### 1. Work on dev

```bash
git checkout dev
```

Edit, commit, push. Each push rebuilds the preview, so read the change on the
preview URL rather than only on localhost — it is the same build production
will get.

### 2. Open the pull request

Push, then on the repository page GitHub offers **Compare & pull request**.
Failing that: **Pull requests → New pull request**, and set

```
base: main   ←   compare: dev
```

The title and body here are the discussion. A checklist is pre-filled from
`.github/pull_request_template.md`. This is not the commit message.

### 3. Merge, and write the note

Click **Merge pull request**, and in the dropdown choose **Squash and merge**.

Two boxes appear, and **what you type in them becomes the commit on `main`**:

- **Commit title** — defaults to the PR title with `(#4)` on the end
- **Commit description** — defaults to a bulleted list of every commit on the
  branch

Clear the bullet list and write the note. `main`'s history is a list of
releases, so write it for someone scanning what changed on the live site: what
a reader sees, and why it changed. Short first line, blank line, then the
reasoning.

Then **Confirm squash and merge**.

### 4. Reset dev

```bash
git checkout dev
git fetch origin
git reset --hard origin/main
git push --force-with-lease
```

Squashing puts one new commit on `main` that `dev` does not have, while `dev`
still holds the originals. Git cannot tell they are the same content, so
without this the next pull request shows changes that already shipped.

## Keeping method-rewrite current

Every so often, pull `main` into it:

```bash
git checkout method-rewrite
git merge main
```

Footnote edits touch other files, so the only file that ever conflicts is the
methodology page. The answer is always to keep this branch's version:

```bash
git checkout --ours apps/web/app/method/page.tsx
git add apps/web/app/method/page.tsx
git commit
```

When the rewrite is finished, merge `method-rewrite` into `main` through a
pull request like any other. That is the one time the long page is meant to
win.

## Worth setting once

**Settings → General → Pull Requests**: untick *Allow merge commits* and
*Allow rebase merging*, leaving only squash. The merge button then cannot do
the wrong thing by accident.

## What branches do not isolate

The database. `drizzle-kit migrate` and the pipeline scripts (`load`,
`rollup`, `speaks`, `rate`) read `DATABASE_URL`, which is production on every
branch and from your laptop. A migration or a reload reaches the live site the
moment it runs, whatever branch you are on.

Treat either as a deploy in its own right, and snapshot before running one.
Two destructive bugs and one silent identity churn were caught by a
before-and-after diff and by nothing else.
