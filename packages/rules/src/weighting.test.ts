import { describe, expect, it } from 'vitest';
import { DIMINISHING_RETURNS_WEIGHTS } from './constants.ts';
import { weightedBreakdown, weightedTotal } from './score.ts';

/**
 * The breakdown exists so a profile page can show which tournaments counted.
 * These tests are mostly about the two ways that display could lie: by summing
 * to something other than the total shown beside it, and by reordering between
 * renders.
 */
describe('weightedBreakdown', () => {
  it('sums to weightedTotal', () => {
    const cases = [
      [],
      [12],
      [9, 12],
      [31, 28, 27, 25, 12, 9, 4],
      [4, 4, 4, 4, 4, 4],
      [0, 0, 0],
    ];
    for (const points of cases) {
      const summed = weightedBreakdown(points).reduce((s, r) => s + r.contribution, 0);
      expect(Math.round(summed * 1e6) / 1e6).toBeCloseTo(weightedTotal(points), 9);
    }
  });

  it('weights the best five in order and zeroes the rest', () => {
    // Deliberately out of order, so the weighting cannot be reading position.
    const rows = weightedBreakdown([4, 31, 12, 27, 9, 28, 25]);
    const byPoints = [...rows].sort((a, b) => b.points - a.points);
    expect(byPoints.map((r) => r.points)).toEqual([31, 28, 27, 25, 12, 9, 4]);
    expect(byPoints.map((r) => r.weight)).toEqual([...DIMINISHING_RETURNS_WEIGHTS, 0, 0]);
  });

  it('returns results in input order, whatever their weight', () => {
    const points = [4, 31, 12];
    expect(weightedBreakdown(points).map((r) => r.index)).toEqual([0, 1, 2]);
    expect(weightedBreakdown(points).map((r) => r.points)).toEqual(points);
  });

  it('breaks ties by input order rather than arbitrarily', () => {
    // Six results at one value: exactly five draw a weight, and which five must
    // not change between calls -- see mistake 30, an unordered input feeding an
    // order-sensitive rule.
    const rows = weightedBreakdown([7, 7, 7, 7, 7, 7]);
    expect(rows.map((r) => r.weight)).toEqual([...DIMINISHING_RETURNS_WEIGHTS, 0]);
    expect(weightedBreakdown([7, 7, 7, 7, 7, 7])).toEqual(rows);
  });

  it('counts every result when there are fewer than five', () => {
    const rows = weightedBreakdown([12, 9]);
    expect(rows.every((r) => r.weight > 0)).toBe(true);
    expect(rows.map((r) => r.weight)).toEqual([1.0, 0.9]);
  });

  it('is empty for a debater with no results', () => {
    expect(weightedBreakdown([])).toEqual([]);
    expect(weightedTotal([])).toBe(0);
  });
});
