import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * `apps/web/lib` is included because rules migrated there.
     *
     * Deciding a round on a majority of its ballots and ordering elims after
     * prelims are the same kind of claim as anything in `packages/rules`, and
     * pattern A in plan/10-mistakes.md has now been got wrong in three separate
     * files. A rule is not safer for being rendered rather than stored.
     */
    include: ['packages/*/src/**/*.test.ts', 'apps/web/lib/**/*.test.ts'],
  },
});
