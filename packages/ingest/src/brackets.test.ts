import { describe, expect, it } from 'vitest';
import { partitionElimRounds, type NormalizedRound } from './normalize.ts';

/**
 * NYPDL runs one preliminary pool and two brackets out of it, interleaved in a
 * single round list. Only the open bracket is the elim field for XXI.2, and
 * break percentage drives the XXI.2.D penalty -- so counting the novice
 * bracket's teams lands the whole tournament in the wrong penalty band.
 */
const round = (
  name: string,
  label: string,
  sections: string[][],
): NormalizedRound => ({
  roundId: name,
  name,
  label,
  type: 'elim',
  isPrelim: false,
  isElim: true,
  elimLevel: null,
  sections: sections.map((entryIds, i) => ({
    sectionId: `${name}-${i}`,
    entryIds,
    ballots: entryIds.map((entryId) => ({
      entryId, judgeId: null, side: null, won: true, isBye: false,
      speaks: [] as never[],
    })),
    isBye: entryIds.length === 1,
    unscored: false,
  })) as never,
});

describe('partitionElimRounds', () => {
  it('splits on the labels the tournament wrote, when it wrote them', () => {
    // NYPDL labels varsity VO/VQ/VS/VF and novice NQ/NS/NF. That is the
    // tournament stating which bracket a round is in, and beats anything
    // inferred from bracket shape.
    const rounds = [
      round('6', 'NQ', [['n1', 'n2'], ['n3', 'n4']]),
      round('7', 'VO', [['v1', 'v2'], ['v3', 'v4']]),
      round('8', 'NS', [['n1', 'n3']]),
      round('9', 'VQ', [['v1', 'v3']]),
    ];
    const { main, consolation } = partitionElimRounds(rounds);
    expect(main.map((r) => r.label)).toEqual(['VO', 'VQ']);
    expect(consolation.map((r) => r.label)).toEqual(['NQ', 'NS']);
  });

  it('ignores decorative labels, which say nothing about brackets', () => {
    // "Novice Finals" would be a bracket statement; "Octos"/"Finals" are not,
    // and their first letters must not be read as one.
    const rounds = [
      round('5', 'Octos', [['a', 'b'], ['c', 'd']]),
      round('6', 'Finals', [['a', 'c']]),
    ];
    const { main, consolation } = partitionElimRounds(rounds);
    expect(main).toHaveLength(2);
    expect(consolation).toHaveLength(0);
  });

  it('does not split when only one bracket is labelled', () => {
    const rounds = [
      round('5', 'VO', [['a', 'b'], ['c', 'd']]),
      round('6', 'VF', [['a', 'c']]),
    ];
    expect(partitionElimRounds(rounds).consolation).toHaveLength(0);
  });

  it('falls back to the shared-team walk when labels are missing', () => {
    // The two brackets never share a team, so a round sharing one with the
    // championship is in the main bracket and everything else is not.
    const rounds = [
      round('6', '', [['n1', 'n2'], ['n3', 'n4']]),
      round('7', '', [['v1', 'v2'], ['v3', 'v4']]),
      round('8', '', [['n1', 'n3']]),
      round('9', '', [['v1', 'v3']]),
    ];
    const { main, consolation } = partitionElimRounds(rounds);
    expect(main.flatMap((r) => r.sections.flatMap((s) => s.entryIds))).toContain('v1');
    expect(consolation.flatMap((r) => r.sections.flatMap((s) => s.entryIds))).toContain('n1');
  });
});
