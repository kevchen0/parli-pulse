/**
 * The words the league uses for a result, in one place.
 *
 * `elim_level` means two different things depending on where it is read, and
 * the difference matters on a profile page. On a **round** it names the stage
 * being debated -- "Semifinals". On an **entry** it names the furthest stage
 * that entry reached, so `first` is the champion and `second` the team that
 * lost the final. Nothing in the enum says which reading applies, so both
 * mappings are written out rather than one being derived from the other.
 */

/** The stage a round is: what the pairing was for. */
const ROUND_STAGE: Record<string, string> = {
  tripleOcto: 'Triple octafinals',
  doubleOcto: 'Double octafinals',
  octo: 'Octafinals',
  quarter: 'Quarterfinals',
  semi: 'Semifinals',
  second: 'Third place',
  first: 'Finals',
};

/** The furthest stage an entry reached: what they are afterwards. */
const ENTRY_RESULT: Record<string, string> = {
  tripleOcto: 'Triple-octafinalist',
  doubleOcto: 'Double-octafinalist',
  octo: 'Octafinalist',
  quarter: 'Quarterfinalist',
  semi: 'Semifinalist',
  second: 'Finalist',
  first: 'Champion',
};

export function roundLabel(
  kind: string,
  elimLevel: string | null,
  tabroomLabel: string,
  isConsolation = false,
): string {
  if (kind !== 'elim' || !elimLevel) {
    // Tabroom labels prelims with a bare number, which reads as a row index in
    // a table of rounds.
    return /^\d+$/.test(tabroomLabel) ? `Round ${tabroomLabel}` : tabroomLabel;
  }
  const stage = ROUND_STAGE[elimLevel] ?? tabroomLabel;
  return isConsolation ? `${stage} (consolation)` : stage;
}

/** How far an entry got, or null where it did not break. */
export const entryResultLabel = (elimLevel: string | null): string | null =>
  elimLevel ? ENTRY_RESULT[elimLevel] ?? elimLevel : null;

/**
 * A round's outcome from one entry's side.
 *
 * A bye is neither a win nor a loss: the team advanced without debating, and
 * calling it a win credits them with beating somebody. A round with no decided
 * ballot is likewise not a loss -- see pattern F, where inferring a winner from
 * missing data credited a room to whichever team happened to need it.
 */
export function roundOutcome(
  ballotsWon: number,
  ballots: number,
  bye: boolean,
): { text: string; state: 'win' | 'loss' | 'none' } {
  if (bye) return { text: 'Bye', state: 'none' };
  if (ballots === 0) return { text: '—', state: 'none' };
  // Majority of the ballots on this side of the section, never `some`. A 1-2
  // panel decision read as a win is pattern A in plan/10-mistakes.md.
  if (ballotsWon * 2 > ballots) return { text: 'Win', state: 'win' };
  if (ballotsWon * 2 < ballots) return { text: 'Loss', state: 'loss' };
  return { text: 'Split', state: 'none' };
}

/** "3-0" or "2-1" where a panel divided, and nothing for a single judge. */
export const panelLabel = (ballotsWon: number, ballots: number): string | null =>
  ballots > 1 ? `${ballotsWon}–${ballots - ballotsWon}` : null;

/** Proposition or opposition, as Tabroom records the side. */
export const sideLabel = (side: number | null): string | null =>
  side === 1 ? 'Prop' : side === 2 ? 'Opp' : null;

/**
 * The order rounds were actually debated in.
 *
 * Not the round id: Tabroom allocates ids as rounds are created, and at several
 * 2025-26 tournaments the elims were set up before the prelims, so ordering on
 * the id lists the octafinals above round one. Not the round label either --
 * those are bare numbers that restart or run on depending on the tournament.
 *
 * Prelims first in label order, then elims from the widest bracket to the
 * final, with a consolation round sorted beside the stage it belongs to.
 */
export function compareRounds(
  a: { kind: string; elimLevel: string | null; label: string },
  b: { kind: string; elimLevel: string | null; label: string },
): number {
  const phase = (r: { kind: string }) => (r.kind === 'elim' ? 1 : 0);
  if (phase(a) !== phase(b)) return phase(a) - phase(b);
  if (a.kind === 'elim') {
    const rank = (r: { elimLevel: string | null }) =>
      r.elimLevel ? ELIM_STAGE_ORDER.indexOf(r.elimLevel) : ELIM_STAGE_ORDER.length;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
  }
  const n = (r: { label: string }) => (/^\d+$/.test(r.label) ? Number(r.label) : Number.NaN);
  const [na, nb] = [n(a), n(b)];
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.label.localeCompare(b.label);
}

/** Elim stages from the widest bracket to the final. */
const ELIM_STAGE_ORDER = [
  'tripleOcto', 'doubleOcto', 'octo', 'quarter', 'semi', 'second', 'first',
];
