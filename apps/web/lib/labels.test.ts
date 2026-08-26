import { describe, expect, it } from 'vitest';
import {
  compareRounds,
  entryResultLabel,
  panelLabel,
  roundLabel,
  roundOutcome,
  walkoverDirection,
} from './labels.ts';

describe('roundOutcome', () => {
  it('decides a panel on a majority, never on any ballot', () => {
    // Pattern A in plan/10-mistakes.md, three times in three places: a 1-2
    // panel read as a win promoted beaten finalists to champion.
    expect(roundOutcome(2, 3, false).state).toBe('win');
    expect(roundOutcome(1, 3, false).state).toBe('loss');
    expect(roundOutcome(3, 5, false).state).toBe('win');
    expect(roundOutcome(2, 5, false).state).toBe('loss');
    expect(roundOutcome(1, 1, false).state).toBe('win');
    expect(roundOutcome(0, 1, false).state).toBe('loss');
  });

  it('calls an even split neither a win nor a loss', () => {
    // Two-judge panels are real: the NPDL-TOC runs them, and a 1-1 there is a
    // divided round rather than a result for either team.
    expect(roundOutcome(1, 2, false)).toEqual({ text: 'Split', state: 'none' });
    expect(roundOutcome(2, 4, false).state).toBe('none');
  });

  it('treats a bye as neither, whatever the ballots say', () => {
    // A bye carries a losing ballot row at some tournaments. Reading it as a
    // loss says a team was beaten in a round nobody debated.
    expect(roundOutcome(0, 1, true)).toEqual({ text: 'Bye', state: 'none' });
    expect(roundOutcome(1, 1, true).text).toBe('Bye');
  });

  it('does not infer a result from no ballots', () => {
    // Pattern F: where the data is missing, leave the gap.
    expect(roundOutcome(0, 0, false)).toEqual({ text: '—', state: 'none' });
  });
});

describe('panelLabel', () => {
  it('shows the split only where more than one judge sat', () => {
    expect(panelLabel(2, 3)).toBe('2–1');
    expect(panelLabel(3, 5)).toBe('3–2');
    expect(panelLabel(1, 1)).toBeNull();
    expect(panelLabel(0, 1)).toBeNull();
  });
});

describe('roundLabel', () => {
  it('names the stage for elims and numbers prelims', () => {
    expect(roundLabel('prelim', null, '3')).toBe('Round 3');
    expect(roundLabel('elim', 'octo', '7')).toBe('Octafinals');
    expect(roundLabel('elim', 'first', '10')).toBe('Finals');
    expect(roundLabel('elim', 'semi', '9', true)).toBe('Semifinals (consolation)');
  });

  it('keeps a label Tabroom wrote out rather than numbering it', () => {
    expect(roundLabel('prelim', null, 'Round Robin')).toBe('Round Robin');
  });
});

describe('entryResultLabel', () => {
  it('reads an entry level as how far they got, not what was debated', () => {
    // The same enum means the stage on a round and the achievement on an entry.
    expect(entryResultLabel('first')).toBe('Champion');
    expect(entryResultLabel('second')).toBe('Finalist');
    expect(entryResultLabel('semi')).toBe('Semifinalist');
    expect(entryResultLabel(null)).toBeNull();
  });
});

describe('compareRounds', () => {
  const r = (kind: string, elimLevel: string | null, label: string) => ({ kind, elimLevel, label });

  it('puts prelims before elims however the ids fell', () => {
    // Several 2025-26 tournaments created their elim rounds first, so ordering
    // on the round id listed the octafinals above round one.
    const rounds = [
      r('elim', 'octo', '7'),
      r('prelim', null, '2'),
      r('elim', 'first', '10'),
      r('prelim', null, '1'),
      r('elim', 'semi', '9'),
      r('elim', 'doubleOcto', '6'),
    ];
    expect([...rounds].sort(compareRounds).map((x) => roundLabel(x.kind, x.elimLevel, x.label))).toEqual([
      'Round 1',
      'Round 2',
      'Double octafinals',
      'Octafinals',
      'Semifinals',
      'Finals',
    ]);
  });

  it('orders prelims numerically rather than as strings', () => {
    const rounds = [r('prelim', null, '10'), r('prelim', null, '2'), r('prelim', null, '1')];
    expect([...rounds].sort(compareRounds).map((x) => x.label)).toEqual(['1', '2', '10']);
  });
});

describe('walkoverDirection', () => {
  const base = {
    bye: false,
    kind: 'elim',
    roundLevel: 'semi',
    mySchool: 'sch_stuyvesant',
    theirSchool: 'sch_stuyvesant',
    myBallots: 1,
    myWon: 0,
    theirBallots: 1,
    theirWon: 0,
    reached: 'semi',
  };

  it('reads the direction from how far the entry went afterwards', () => {
    // The ballots cannot say: in all four 2025-26 walkovers both entries carry
    // a losing ballot and only the bracket records who advanced.
    expect(walkoverDirection({ ...base, reached: 'first' })).toBe('advanced');
    expect(walkoverDirection({ ...base, reached: 'second' })).toBe('advanced');
    expect(walkoverDirection({ ...base, reached: 'semi' })).toBe('conceded');
  });

  it('is not a walkover when somebody won the section', () => {
    // 87 same-school elim sections in 2025-26 carry a real decision, several
    // of them 2-1. Two teammates meeting is not by itself a walkover.
    expect(walkoverDirection({ ...base, myBallots: 3, myWon: 2, theirBallots: 3, theirWon: 1 })).toBeNull();
    expect(walkoverDirection({ ...base, myBallots: 3, myWon: 1, theirBallots: 3, theirWon: 2 })).toBeNull();
  });

  it('is not a walkover across schools, in a prelim, or on a bye', () => {
    expect(walkoverDirection({ ...base, theirSchool: 'sch_menlo' })).toBeNull();
    expect(walkoverDirection({ ...base, kind: 'prelim' })).toBeNull();
    expect(walkoverDirection({ ...base, bye: true })).toBeNull();
  });

  it('will not guess a direction it cannot read', () => {
    // One of the four sits in a round with no recorded stage. Pattern F: name
    // the gap rather than infer a winner.
    expect(walkoverDirection({ ...base, roundLevel: null, reached: null })).toBe('unknown');
    expect(walkoverDirection({ ...base, reached: null })).toBe('unknown');
  });

  it('says nothing when a school is unknown on either side', () => {
    expect(walkoverDirection({ ...base, mySchool: null })).toBeNull();
    expect(walkoverDirection({ ...base, theirSchool: null })).toBeNull();
  });
});
