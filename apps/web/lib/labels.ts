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

/**
 * A count's noun, singular where the count is one.
 *
 * Every board states its size in the line above the table, and each of those
 * read "1 tournaments" the first time a season held exactly one. Nothing was
 * wrong with the figure; the sentence around it had only ever been seen with a
 * plural in it. The season status line had already grown its own copy of this
 * logic, which is the second sign it belonged somewhere shared.
 */
export const plural = (n: number, one: string, many = `${one}s`): string =>
  (n === 1 ? one : many);

/**
 * A prelim record counted off the ballots, ties kept apart from losses.
 *
 * The stored `prelim_wins`/`prelim_losses` fold a tie into the losses: the
 * ingest asks `won * 2 > total` and sends everything else to `losses++`, which
 * is right on an odd panel and wrong on an even one. Three tournaments in
 * 2025-26 ran two-judge prelims -- the TOC, the CHSSA qualifier and the TCFL
 * qualifier -- and 318 rounds across 133 entries deadlocked 1-1 and were
 * recorded as defeats.
 *
 * Counting here rather than reading the stored pair also stops the summary
 * disagreeing with the rounds underneath it, which is how this surfaced: the
 * round list said Split three times while the record above it said 3-4.
 *
 * Elims are excluded, as they are from the stored figures. A bye is a win, the
 * same reading the ingest takes. A round holding no ballots is not counted at
 * all: it was never debated, or its result was never entered, and neither is a
 * result.
 */
export interface PrelimRecord {
  wins: number;
  losses: number;
  /** Panels that split evenly. Real on a two-judge panel, impossible on three. */
  ties: number;
}

export function prelimRecord(
  rounds: readonly {
    kind: string;
    bye: boolean;
    ballotsWon: number;
    ballots: number;
  }[],
): PrelimRecord {
  const out: PrelimRecord = { wins: 0, losses: 0, ties: 0 };
  for (const r of rounds) {
    if (r.kind !== 'prelim') continue;
    if (r.bye) { out.wins++; continue; }
    if (r.ballots === 0) continue;
    if (r.ballotsWon * 2 > r.ballots) out.wins++;
    else if (r.ballotsWon * 2 < r.ballots) out.losses++;
    else out.ties++;
  }
  return out;
}

/**
 * "6-1", or "3-1-3" where rounds were tied.
 *
 * The third figure appears only when there is one, so the ordinary record keeps
 * the two-part shape everybody reads it in.
 */
export const recordLabel = (r: PrelimRecord): string =>
  r.ties > 0 ? `${r.wins}–${r.losses}–${r.ties}` : `${r.wins}–${r.losses}`;

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
 * one advances and the other stands down, which XXI.5.C prices at -2 and +2.
 *
 * The signature is a **short panel** -- fewer ballots than the same round gave
 * its other sections. A walkover still gets a token ballot recording who went
 * through, so "nobody won" misses most of them; and two teammates meeting is
 * not enough on its own, because some closeouts really are debated. On 2025-26
 * this reproduces the league's own `walkover_adjustment` for 1,525 of 1,541
 * matched entries, measured by `npm run check:walkovers`.
 *
 * State qualifiers are excluded. Their points come from XXI.4.C rather than
 * from a bracket, and the league records no walkover there even when the
 * bracket shows one.
 *
 * Direction comes from how far the entry went afterwards, because the ballots
 * cannot say. Where the round's own stage is unrecorded there is nothing to
 * compare against, and the round is reported as a walkover without a direction
 * rather than guessed at -- pattern F.
 */
export function walkoverDirection(r: {
  bye: boolean;
  kind: string;
  roundLevel: string | null;
  category: string | null;
  mySchool: string | null;
  theirSchool: string | null;
  ballots: number;
  /** The largest panel this round gave any of its sections. */
  roundMaxBallots: number;
  reached: string | null;
}): 'advanced' | 'conceded' | 'unknown' | null {
  if (r.bye || r.kind !== 'elim') return null;
  if (r.category === 'CHSSA' || r.category === 'OSAA') return null;
  if (!r.mySchool || !r.theirSchool || r.mySchool !== r.theirSchool) return null;
  if (!(r.ballots < r.roundMaxBallots)) return null;

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
