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

/**
 * Whether an elim round was a walkover, and which side of it this entry was on.
 *
 * Two teams from one school meeting in elims usually means they do not debate:
 * one advances and the other steps aside, which XXI.5.C prices at -2 and +2.
 * The signature is a same-school section that **nobody won** -- not merely a
 * same-school section. On 2025-26 there are 91 of the latter and only 4 of the
 * former: the other 87 carry a real decision, several of them 2-1, and calling
 * a debated octafinal a concession would contradict the ballots.
 *
 * Direction comes from how far the entry went afterwards, because the ballots
 * cannot say: in every one of the four, both entries carry a losing ballot and
 * only the bracket records who advanced. Where the round's own stage is
 * unrecorded there is nothing to compare against, and the round is reported as
 * a walkover without a direction rather than guessed at -- pattern F.
 */
export function walkoverDirection(r: {
  bye: boolean;
  kind: string;
  roundLevel: string | null;
  mySchool: string | null;
  theirSchool: string | null;
  myBallots: number;
  myWon: number;
  theirBallots: number;
  theirWon: number;
  reached: string | null;
}): 'advanced' | 'conceded' | 'unknown' | null {
  if (r.bye || r.kind !== 'elim') return null;
  if (!r.mySchool || !r.theirSchool || r.mySchool !== r.theirSchool) return null;
  const majority = (won: number, total: number) => total > 0 && won * 2 > total;
  if (majority(r.myWon, r.myBallots) || majority(r.theirWon, r.theirBallots)) return null;

  const here = r.roundLevel ? ELIM_STAGE_ORDER.indexOf(r.roundLevel) : -1;
  const got = r.reached ? ELIM_STAGE_ORDER.indexOf(r.reached) : -1;
  if (here < 0 || got < 0) return 'unknown';
  return got > here ? 'advanced' : 'conceded';
}

/** How a walkover reads in the results column. */
export const walkoverLabel = (
  direction: 'advanced' | 'conceded' | 'unknown',
): { text: string; title: string } =>
  direction === 'advanced'
    ? {
        text: 'Advanced',
        title:
          'Closeout: both teams were from the same school, so the round was not debated and this entry went through (XXI.5.C).',
      }
    : direction === 'conceded'
      ? {
          text: 'Stood down',
          title:
            'Closeout: both teams were from the same school, so the round was not debated and the other entry went through (XXI.5.C).',
        }
      : {
          text: 'Closeout',
          title:
            'Both teams were from the same school and the round was not debated. Which of them advanced is not recorded.',
        };
