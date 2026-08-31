import { describe, expect, it } from 'vitest';
import {
  compareRounds,
  plural,
  prelimRecord,
  recordLabel,
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
  // A walkover section drew one ballot where its siblings drew three.
  const base = {
    bye: false,
    kind: 'elim',
    roundLevel: 'semi',
    category: 'Regular',
    mySchool: 'sch_stuyvesant',
    theirSchool: 'sch_stuyvesant',
    ballots: 1,
    roundMaxBallots: 3,
    reached: 'semi',
  };

  it('reads the direction from how far the entry went afterwards', () => {
    // The ballots cannot say: a walkover still records a token win for
    // whoever went through, so the bracket is the only witness.
    expect(walkoverDirection({ ...base, reached: 'first' })).toBe('advanced');
    expect(walkoverDirection({ ...base, reached: 'second' })).toBe('advanced');
    expect(walkoverDirection({ ...base, reached: 'semi' })).toBe('conceded');
  });

  it('needs a short panel, not merely two teams from one school', () => {
    // Same-school elims are sometimes genuinely debated -- Harvard's
    // octafinal went 2-1 -- and those draw the round's full panel.
    expect(walkoverDirection({ ...base, ballots: 3, roundMaxBallots: 3 })).toBeNull();
  });

  it('ignores state qualifiers, whose points do not come from a bracket', () => {
    // XXI.4.C scores these on qual/alt, and the league records no walkover
    // there even where the bracket shows one.
    expect(walkoverDirection({ ...base, category: 'CHSSA' })).toBeNull();
    expect(walkoverDirection({ ...base, category: 'OSAA' })).toBeNull();
  });

  it('is not a walkover across schools, in a prelim, or on a bye', () => {
    expect(walkoverDirection({ ...base, theirSchool: 'sch_menlo' })).toBeNull();
    expect(walkoverDirection({ ...base, kind: 'prelim' })).toBeNull();
    expect(walkoverDirection({ ...base, bye: true })).toBeNull();
  });

  it('will not guess a direction it cannot read', () => {
    // Pattern F: name the gap rather than infer who advanced.
    expect(walkoverDirection({ ...base, roundLevel: null, reached: null })).toBe('unknown');
    expect(walkoverDirection({ ...base, reached: null })).toBe('unknown');
  });

  it('says nothing when a school is unknown on either side', () => {
    expect(walkoverDirection({ ...base, mySchool: null })).toBeNull();
    expect(walkoverDirection({ ...base, theirSchool: null })).toBeNull();
  });
});

describe('prelimRecord', () => {
  const r = (kind: string, ballotsWon: number, ballots: number, bye = false) =>
    ({ kind, ballotsWon, ballots, bye });

  it('counts a majority as a win and a minority as a loss', () => {
    expect(prelimRecord([r('prelim', 2, 3), r('prelim', 1, 3)])).toEqual({
      wins: 1, losses: 1, ties: 0,
    });
  });

  // The bug this was written for: a two-judge panel splitting 1-1 was counted
  // as a defeat, so a 6-1 at the TOC was published as 3-4.
  it('keeps an evenly split panel out of the losses', () => {
    expect(prelimRecord([r('prelim', 1, 2)])).toEqual({ wins: 0, losses: 0, ties: 1 });
  });

  it('reads Georgatos at the 2025-26 TOC as 3-1-3', () => {
    const rounds = [
      r('prelim', 1, 2), r('prelim', 1, 2), r('prelim', 1, 2),
      r('prelim', 2, 2), r('prelim', 0, 2), r('prelim', 2, 2), r('prelim', 2, 2),
      r('elim', 1, 3),
    ];
    expect(prelimRecord(rounds)).toEqual({ wins: 3, losses: 1, ties: 3 });
  });

  it('ignores elims, as the stored figures do', () => {
    expect(prelimRecord([r('elim', 3, 3), r('elim', 0, 3)])).toEqual({
      wins: 0, losses: 0, ties: 0,
    });
  });

  it('counts a bye as a win', () => {
    expect(prelimRecord([r('prelim', 0, 0, true)])).toEqual({ wins: 1, losses: 0, ties: 0 });
  });

  it('does not count a round holding no ballots', () => {
    expect(prelimRecord([r('prelim', 0, 0)])).toEqual({ wins: 0, losses: 0, ties: 0 });
  });

  it('reads a single-judge round on its one ballot', () => {
    expect(prelimRecord([r('prelim', 1, 1), r('prelim', 0, 1)])).toEqual({
      wins: 1, losses: 1, ties: 0,
    });
  });
});

describe('recordLabel', () => {
  it('keeps the two-part shape where nothing tied', () => {
    expect(recordLabel({ wins: 6, losses: 1, ties: 0 })).toBe('6–1');
  });

  it('shows ties as a third figure', () => {
    expect(recordLabel({ wins: 3, losses: 1, ties: 3 })).toBe('3–1–3');
  });
});

describe('plural', () => {
  it('drops the s at one', () => {
    expect(plural(1, 'tournament')).toBe('tournament');
  });

  it('keeps it at every other count', () => {
    expect(plural(0, 'tournament')).toBe('tournaments');
    expect(plural(2, 'tournament')).toBe('tournaments');
    expect(plural(98, 'tournament')).toBe('tournaments');
  });

  it('takes an irregular plural', () => {
    expect(plural(1, 'match', 'matches')).toBe('match');
    expect(plural(3, 'match', 'matches')).toBe('matches');
  });
});
