import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, pageNumbers, pageSlice } from './paging';

const rows = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe('pageSlice', () => {
  it('returns the first page of a long list', () => {
    const { current, totalPages, shown } = pageSlice(rows(806), 1);
    expect(current).toBe(1);
    expect(totalPages).toBe(17);
    expect(shown).toHaveLength(PAGE_SIZE);
    expect(shown[0]).toBe(1);
    expect(shown.at(-1)).toBe(50);
  });

  it('advances a page rather than repeating the first', () => {
    const { shown } = pageSlice(rows(806), 2);
    expect(shown[0]).toBe(51);
    expect(shown.at(-1)).toBe(100);
  });

  it('gives the last page whatever is left of it', () => {
    const { current, shown } = pageSlice(rows(806), 17);
    expect(current).toBe(17);
    expect(shown).toHaveLength(6);
    expect(shown.at(-1)).toBe(806);
  });

  // A reader on page 12 who then searches for something with four matches has
  // a page number that no longer exists. The answer is the last page there is,
  // never an empty table.
  it('clamps a page past the end onto the last one', () => {
    const { current, totalPages, shown } = pageSlice(rows(4), 12);
    expect(current).toBe(1);
    expect(totalPages).toBe(1);
    expect(shown).toHaveLength(4);
  });

  it('clamps a page below the first', () => {
    expect(pageSlice(rows(200), 0).current).toBe(1);
    expect(pageSlice(rows(200), -3).current).toBe(1);
  });

  it('reports one page for an empty list rather than none', () => {
    const { current, totalPages, shown } = pageSlice([], 1);
    expect(current).toBe(1);
    expect(totalPages).toBe(1);
    expect(shown).toEqual([]);
  });

  it('does not page a list that fits', () => {
    const { totalPages, shown } = pageSlice(rows(50), 1);
    expect(totalPages).toBe(1);
    expect(shown).toHaveLength(50);
  });
});

describe('pageNumbers', () => {
  it('keeps both ends reachable from the middle', () => {
    expect(pageNumbers(6, 16)).toEqual([1, '…', 5, 6, 7, '…', 16]);
  });

  it('replaces a gap standing for a single page with that page', () => {
    expect(pageNumbers(4, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns one page when there is one page', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
  });
});
