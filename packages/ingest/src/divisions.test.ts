import { describe, expect, it } from 'vitest';
import { classifyDivision, isParliEvent } from './divisions.ts';
import { fieldEventFilter, openEventFilter } from './event-selection.ts';

/**
 * These decide field sizes, and a field size decides which row of the elim
 * points table every team at a tournament reads. A misclassified division is
 * not a rounding error.
 */
describe('isParliEvent', () => {
  it('accepts the spellings tournaments actually use', () => {
    for (const name of [
      'Open Parli',
      'Parliamentary Debate',
      'Parli - TOC',
      'Senior Parliamentary',
      'NPDA',
      // Singletary spells it a letter short, and under a whole-word pattern
      // its nine novice teams never reached the AFS.
      'Novice Parlimentary Debate',
    ]) {
      expect(isParliEvent(name, null), name).toBe(true);
    }
  });

  it('still rejects Public Forum, which the loose pattern could reach', () => {
    expect(isParliEvent('Public Forum - Novice', 'PF-N')).toBe(false);
    expect(isParliEvent('Middle School PF', 'MSPF')).toBe(false);
    expect(isParliEvent('Lincoln Douglas', 'LD')).toBe(false);
    expect(isParliEvent('Congress', 'C-V')).toBe(false);
  });
});

describe('classifyDivision', () => {
  it('reads the ordinary divisions', () => {
    expect(classifyDivision('Open Parli')).toBe('open');
    expect(classifyDivision('Parli - TOC')).toBe('open');
    expect(classifyDivision('Novice Parli')).toBe('novice');
    expect(classifyDivision('Parli - JV')).toBe('jv');
    expect(classifyDivision('Middle School Parli')).toBe('middle');
  });

  it('counts a combined middle-school-and-novice division as novice', () => {
    // XXI.2.B puts novice and JV in the adjusted field size and middle school
    // outside it, and the league counts these: Stanford's N/JV is 49 against a
    // JV division of 18, the other 30 being this event.
    expect(classifyDivision('Parli - Middle School + Novice Combined')).toBe('novice');
    expect(classifyDivision('Middle School + Novice Parli')).toBe('novice');
  });

  it('leaves a pure middle-school division out', () => {
    // The same sheet confirms the other side of it: NPDL Nationals records
    // N/JV as 0 beside a 15-team Middle School Parli.
    expect(classifyDivision('Middle School Parli', 'MSPAR')).toBe('middle');
  });

  it('prefers the restrictive label over "open" in the same name', () => {
    expect(classifyDivision('Novice Parli Open Division')).toBe('novice');
  });

  it('treats an unqualified parli event as the open division', () => {
    expect(classifyDivision('PARLI', 'PAR')).toBe('open');
  });
});

describe('event selection for a shared payload', () => {
  const events = [
    { name: 'Open Parli', abbr: 'OPAR', division: 'open', isParli: true },
    { name: 'Round Robin', abbr: 'RR', division: 'unknown', isParli: false },
    { name: 'Middle School Parli', abbr: 'MSPAR', division: 'middle', isParli: true },
  ];
  const pick = (f: (e: (typeof events)[number]) => boolean) => events.filter(f).map((e) => e.name);

  it('gives each league tournament the event holding its own results', () => {
    expect(pick(openEventFilter('NPDL Nationals'))).toEqual(['Open Parli']);
    expect(pick(openEventFilter('NPDL Round Robin'))).toEqual(['Round Robin']);
  });

  it('scores the Round Robin against the field it ran inside', () => {
    // Both sheet rows carry an open field of 37 and 13 breaking, which are
    // Open Parli's figures. Reading the Round Robin's own twelve would put it
    // several rows down the elim points table.
    expect(pick(fieldEventFilter('NPDL Round Robin'))).toEqual(['Open Parli']);
    expect(pick(fieldEventFilter('NPDL Nationals'))).toEqual(['Open Parli']);
  });

  it('falls back to the ordinary rule where no override applies', () => {
    expect(pick(fieldEventFilter('Berkeley HS'))).toEqual(['Open Parli']);
  });
});
