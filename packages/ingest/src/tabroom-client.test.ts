import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type CalendarEntry,
  needsRefresh,
  parseCalendar,
  runsParli,
  seasonStartYear,
  worthFetching,
} from './tabroom-client.ts';

/**
 * A real response, saved the day the client was written. Parsing HTML with
 * regular expressions only stays honest against markup somebody actually
 * served; a fixture invented to match the parser proves nothing.
 */
const html = readFileSync(new URL('./__fixtures__/circuit-calendar.html', import.meta.url), 'utf8');

describe('circuit calendar', () => {
  const entries = parseCalendar(html);

  it('finds every tournament on the page', () => {
    expect(entries).toHaveLength(5);
    expect(new Set(entries.map((e) => e.tournId)).size).toBe(5);
  });

  it('reads names and locations', () => {
    const cal = entries.find((e) => e.tournId === '38795');
    expect(cal?.name).toBe('Cal Parli Invitational');
    expect(cal?.location).toContain('Berkeley');
  });

  it('takes the start date from the attribute, not the display text', () => {
    const harvard = entries.find((e) => e.startsOn === '2026-09-05');
    expect(harvard).toBeDefined();
    // "Sat Sep 5-6, 2026" -- the range end is recovered from the text.
    expect(harvard?.endsOn).toBe('2026-09-06');
  });

  it('recovers the advertised events', () => {
    const harvard = entries.find((e) => e.startsOn === '2026-09-05');
    expect(harvard?.events).toContain('Parli');
    expect(runsParli(harvard!)).toBe(true);
  });

  /**
   * The events cell is located by its position relative to the date, not by
   * looking for event names inside it. Finding it by content missed
   * "NParli, OParli" -- the two divisions of a tournament called Cal Parli
   * Invitational, which is exactly the tournament least affordable to miss.
   */
  it('finds the events cell structurally, whatever it contains', () => {
    const cal = entries.find((e) => e.tournId === '38795');
    expect(cal?.events).toEqual(['NParli', 'OParli']);
    expect(runsParli(cal!)).toBe(true);
    // The location is the plain cell on the other side of the date.
    expect(cal?.location).toContain('Berkeley');
  });

  it('reads every tournament on the fixture the same way', () => {
    // All five are on NPDL's own circuit calendar, so all five get fetched.
    expect(entries.every(worthFetching)).toBe(true);
  });

  /**
   * The parser is regex over markup nobody promised to keep. Silence on a
   * changed page would read as an empty season, which in September is
   * indistinguishable from a quiet week.
   */
  it('throws rather than returning nothing when the markup changes', () => {
    expect(() => parseCalendar('<html><body>redesigned</body></html>')).toThrow(/markup/);
    expect(() => parseCalendar('')).toThrow();
  });

  it('ignores rows with no tournament link', () => {
    expect(() => parseCalendar(`<tr><td>header</td></tr>${html}`)).not.toThrow();
    expect(parseCalendar(`<tr><td>header</td></tr>${html}`)).toHaveLength(5);
  });
});

describe('runsParli', () => {
  const of = (events: string[]): CalendarEntry =>
    ({ tournId: '1', name: 'x', location: null, startsOn: null, endsOn: null, events });

  it('accepts the spellings a circuit actually uses', () => {
    expect(runsParli(of(['Parli']))).toBe(true);
    expect(runsParli(of(['JVPF', 'NPF', 'VLD', 'Parli', 'VPF']))).toBe(true);
    expect(runsParli(of(['NParli', 'OParli']))).toBe(true);
    expect(runsParli(of(['NPDA']))).toBe(true);
    // The Cal Invitational writes it PAR; NSDA Campus suffixes the division.
    expect(runsParli(of(['OO', 'PAR', 'WSD']))).toBe(true);
    expect(runsParli(of(['PARN', 'PARO', 'PFNF']))).toBe(true);
  });

  it('does not mistake Public Forum for parliamentary', () => {
    expect(runsParli(of(['PF']))).toBe(false);
    expect(runsParli(of(['VPF', 'JVPF', 'NPF']))).toBe(false);
    expect(runsParli(of(['VLD', 'VPF', 'Congress']))).toBe(false);
  });
});

describe('worthFetching', () => {
  const of = (events: string[]): CalendarEntry =>
    ({ tournId: '1', name: 'x', location: null, startsOn: null, endsOn: null, events });

  it('fetches anything advertising parli', () => {
    expect(worthFetching(of(['PARN', 'PFOF']))).toBe(true);
  });

  it('fetches when the list says nothing about event types', () => {
    // A tournament listing its divisions rather than its events has not
    // answered the question, and it is on NPDL's circuit calendar regardless.
    expect(worthFetching(of([]))).toBe(true);
    expect(worthFetching(of(['Novice', 'Open']))).toBe(true);
    expect(worthFetching(of(['Varsity']))).toBe(true);
  });

  it('skips a tournament that is definitely something else', () => {
    expect(worthFetching(of(['VLD', 'JVLD', 'VPF', 'JVPF']))).toBe(false);
    expect(worthFetching(of(['DI', 'DUO', 'EXT', 'HI', 'OO']))).toBe(false);
  });
});

describe('needsRefresh', () => {
  const at = (endsOn: string | null) => ({ endsOn });
  const today = new Date('2026-09-20T00:00:00Z');

  it('fetches anything not yet cached', () => {
    expect(needsRefresh(at('2020-01-01'), false, today)).toBe(true);
  });

  it('keeps watching a tournament inside the correction window', () => {
    expect(needsRefresh(at('2026-09-06'), true, today)).toBe(true);
    expect(needsRefresh(at('2026-08-10'), true, today)).toBe(true);
  });

  it('leaves a finished tournament alone', () => {
    expect(needsRefresh(at('2026-06-01'), true, today)).toBe(false);
  });

  it('watches a tournament that has not happened yet', () => {
    expect(needsRefresh(at('2026-11-01'), true, today)).toBe(true);
  });

  it('re-fetches when the date is unknown, rather than assuming it is old', () => {
    expect(needsRefresh(at(null), true, today)).toBe(true);
    expect(needsRefresh(at('not a date'), true, today)).toBe(true);
  });
});

describe('seasonStartYear', () => {
  it('keys a season by the year it opens in', () => {
    expect(seasonStartYear('2026-27')).toBe(2026);
    expect(seasonStartYear('2025-26')).toBe(2025);
  });

  it('rejects a label it cannot read', () => {
    expect(() => seasonStartYear('next')).toThrow();
  });
});
