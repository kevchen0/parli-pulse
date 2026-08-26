import { describe, expect, it } from 'vitest';
import { computeFieldStats, type NormalizedEvent, type NormalizedRound } from './normalize.ts';

/**
 * The elim field is the numerator of the break percentage that drives XXI.2.D,
 * so one team either way moves a whole tournament across a penalty threshold.
 */
const entry = (id: string, dropped = false) => [id, {
  entryId: id, code: id, name: id, schoolId: `s${id}`, schoolName: `s${id}`,
  studentIds: [`a${id}`, `b${id}`], eligibleTeamSize: true, hybrid: false, dropped,
}] as const;

const ballot = (entryId: string, won: boolean | null) => ({
  ballotId: `${entryId}-b`, entryId, entryCode: entryId, entryName: entryId,
  side: null, judgeId: 'j', judgePersonId: 'j', won, isBye: false, speaks: [],
});

const round = (name: string, isElim: boolean, pairs: string[][]): NormalizedRound => ({
  roundId: name, name, label: '', type: isElim ? 'elim' : 'prelim',
  isPrelim: !isElim, isElim, elimLevel: null,
  sections: pairs.map((ids, i) => ({
    sectionId: `${name}-${i}`,
    entryIds: ids,
    // The first named entry wins the section.
    ballots: ids.map((id, k) => ballot(id, k === 0)),
    isBye: ids.length === 1,
    unscored: false,
  })),
});

const event = (
  ids: string[],
  rounds: NormalizedRound[],
  seeds: [string, number][],
): NormalizedEvent => ({
  eventId: 'e', name: 'Open Parli', abbr: 'OPAR', division: 'open', isParli: true,
  entries: new Map(ids.map((id) => entry(id))),
  rounds,
  prelimCount: rounds.filter((r) => r.isPrelim).length,
  publishedPrelimWins: new Map(), publishedPrelimBallots: new Map(),
  publishedRecords: new Map(), finalPlacesChampions: new Set(),
  prelimSeeds: new Map(seeds),
});

/** Four teams, two prelims, everyone 1-1 except as paired. */
const prelims = (ids: string[]): NormalizedRound[] => [
  round('1', false, [[ids[0]!, ids[1]!], [ids[2]!, ids[3]!]]),
  round('2', false, [[ids[0]!, ids[2]!], [ids[1]!, ids[3]!]]),
];

describe('elim field', () => {
  it('counts teams that appeared, not bracket slots', () => {
    // Berkeley: 16 sections but 12 byes, so 20 teams broke rather than 32.
    const ids = ['a', 'b', 'c', 'd'];
    const ev = event(ids, [...prelims(ids), round('3', true, [['a', 'b'], ['c']])],
      [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
    // 'd' never reached an elim and is seeded below everyone who did.
    expect(computeFieldStats(ev).elimField).toBe(3);
  });

  it('recovers a team that broke and debated no elim round', () => {
    // Seeds 1, 2 and 4 are in a four-slot bracket holding three teams: seed 3
    // qualified above seed 4 and was never paired. Invisible in the rounds,
    // and the league counts it.
    const ids = ['a', 'b', 'c', 'd'];
    const ev = event(ids, [...prelims(ids), round('3', true, [['a', 'b'], ['d']])],
      [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
    expect(computeFieldStats(ev).elimField).toBe(4);
  });

  it('recovers nothing when the bracket was full', () => {
    // Nueva: the fourth seed withdrew and the ninth was pulled up from below
    // the line to fill the slots, so the seed gap is not a team that broke.
    const ids = ['a', 'b', 'c', 'd'];
    const ev = event(ids, [...prelims(ids), round('3', true, [['a', 'b'], ['d', 'c']])],
      [['a', 1], ['b', 2], ['d', 4], ['c', 5]]);
    expect(computeFieldStats(ev).elimField).toBe(4);
  });

  it('will not recover a team that did not clear the break line', () => {
    // NYPDL November OL: a seed-10 gap at 2-3 against a bracket whose worst is
    // 4-1. That team is simply not in the bracket.
    const ids = ['a', 'b', 'c', 'd'];
    const rounds = [
      // a beats c, b beats d  ->  a 1-0, b 1-0, c 0-1, d 0-1
      round('1', false, [['a', 'c'], ['b', 'd']]),
      // a beats b, d beats c  ->  a 2-0, b 1-1, c 0-2, d 1-1
      round('2', false, [['a', 'b'], ['d', 'c']]),
      round('3', true, [['a', 'b'], ['d']]),
    ];
    // The bracket's worst is 1-1; the seed-3 gap is 'c' at 0-2.
    const ev = event(ids, rounds, [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
    expect(computeFieldStats(ev).elimField).toBe(3);
  });
});
