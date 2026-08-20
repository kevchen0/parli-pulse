import { describe, expect, it } from 'vitest';
import {
  editDistance,
  matchTeams,
  normalizeSurname,
  parseSheetName,
  scoreCandidate,
  type EntryCandidate,
} from './matching.ts';

const cand = (entryId: string, schoolName: string, ...people: [string, string][]): EntryCandidate => ({
  entryId,
  schoolName,
  people: people.map(([first, last]) => ({ first, last })),
});

describe('name parsing', () => {
  it('splits a disambiguating initial from the surname', () => {
    expect(parseSheetName('C. Pennington')).toMatchObject({ initial: 'c', surname: 'pennington' });
    // The sheet uses two letters when siblings share a first initial.
    expect(parseSheetName('Ma. Qiu')).toMatchObject({ initial: 'ma', surname: 'qiu' });
    expect(parseSheetName('Me. Qiu')).toMatchObject({ initial: 'me', surname: 'qiu' });
  });

  it('treats a bare surname as having no initial', () => {
    expect(parseSheetName('Singel')).toMatchObject({ initial: null, surname: 'singel' });
  });

  it('normalizes punctuation and diacritics in surnames', () => {
    expect(normalizeSurname('Babji-Ross')).toBe('babjiross');
    expect(normalizeSurname("O'Neill")).toBe('oneill');
    expect(normalizeSurname('St. Martin')).toBe('stmartin');
    expect(normalizeSurname('Muñoz')).toBe('munoz');
  });
});

describe('editDistance', () => {
  it('measures small differences and gives up beyond the bound', () => {
    expect(editDistance('macatangay', 'macantangay', 1)).toBe(1);
    expect(editDistance('stanislawski', 'stansilawski', 2)).toBeLessThanOrEqual(2);
    expect(editDistance('smith', 'jones', 1)).toBeGreaterThan(1);
  });
});

describe('same-surname disambiguation', () => {
  // CFL 3 really does contain two different "He & Zhang" partnerships.
  const a = cand('A', 'Arcadia', ['Cici', 'Zhang'], ['Robert', 'He']);
  const b = cand('B', 'Arcadia', ['Maximus', 'Zhang'], ['Lewis', 'He']);

  it('uses initials to pick the right one of two identical surname pairs', () => {
    const teams = [
      { partner1: 'C. Zhang', partner2: 'R. He', school: 'Arcadia' },
      { partner1: 'M. Zhang', partner2: 'L. He', school: 'Arcadia' },
    ];
    const { matches, ambiguous } = matchTeams(teams, [a, b]);
    expect(ambiguous).toHaveLength(0);
    expect(matches.get(0)!.entryId).toBe('A');
    expect(matches.get(1)!.entryId).toBe('B');
  });

  it('refuses to guess when surnames collide and no initial separates them', () => {
    const teams = [{ partner1: 'Zhang', partner2: 'He', school: 'Arcadia' }];
    const { matches, ambiguous } = matchTeams(teams, [a, b]);
    expect(ambiguous).toHaveLength(1);
    expect(matches.get(0)!.ambiguous).toBe(true);
  });

  it('never assigns one entry to two different sheet rows', () => {
    const teams = [
      { partner1: 'Zhang', partner2: 'He', school: 'Arcadia' },
      { partner1: 'Zhang', partner2: 'He', school: 'Arcadia' },
    ];
    const { matches } = matchTeams(teams, [a, b]);
    expect(new Set([...matches.values()].map((m) => m.entryId)).size).toBe(2);
  });

  it('rejects a candidate whose first name contradicts the initial', () => {
    const teams = [{ partner1: 'Q. Zhang', partner2: 'Q. He', school: 'Arcadia' }];
    const { matches, unmatched } = matchTeams(teams, [a, b]);
    expect(matches.size).toBe(0);
    expect(unmatched).toEqual([0]);
  });
});

describe('tiers', () => {
  it('prefers an exact match over a fuzzy one for the same row', () => {
    const exact = cand('E', 'Crater', ['Ana', 'Irigoyen'], ['Jo', 'Stanislawski']);
    const near = cand('N', 'Crater', ['Ana', 'Irigoyen'], ['Jo', 'Stansilawskii']);
    const teams = [{ partner1: 'Irigoyen', partner2: 'Stanislawski', school: 'Crater' }];
    const { matches } = matchTeams(teams, [near, exact]);
    expect(matches.get(0)!.entryId).toBe('E');
    expect(matches.get(0)!.tier).toBe('exact-surnames');
  });

  it('allows a near-miss spelling only when the school agrees', () => {
    const team = { partner1: 'Irigoyen', partner2: 'Stansilawski', school: 'Crater' };
    expect(scoreCandidate(team, cand('X', 'Crater', ['A', 'Irigoyen'], ['J', 'Stanislawski']))?.tier)
      .toBe('fuzzy-surname');
    expect(scoreCandidate(team, cand('Y', 'Nueva', ['A', 'Irigoyen'], ['J', 'Stanislawski'])))
      .toBeNull();
  });

  it('matches a maverick row against a one-person entry', () => {
    const solo = cand('S', 'AITE', ['Kevin', 'Ho']);
    const teams = [{ partner1: 'Ho', partner2: '', school: 'AITE' }];
    const { matches } = matchTeams(teams, [solo]);
    expect(matches.get(0)).toMatchObject({ entryId: 'S', tier: 'partial-maverick' });
  });

  it('does not match teams that share no surname', () => {
    const teams = [{ partner1: 'Smith', partner2: 'Jones', school: 'Nueva' }];
    const { unmatched } = matchTeams(teams, [cand('Z', 'Nueva', ['A', 'Brown'], ['B', 'Green'])]);
    expect(unmatched).toEqual([0]);
  });
});
