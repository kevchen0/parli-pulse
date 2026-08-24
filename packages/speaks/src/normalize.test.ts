import { describe, expect, it } from 'vitest';
import {
  MIN_SPREAD,
  SHRINKAGE_BALLOTS,
  judgeNormalizer,
  median,
  robustStats,
} from './normalize.ts';
import { CANONICAL, classifyRaw, scaleFor, toCanonical } from './scale.ts';

const many = (v: number, n: number): number[] => Array.from({ length: n }, () => v);

describe('scales come from configuration, not from the data', () => {
  it('knows the declared exceptions', () => {
    expect(scaleFor('Berkeley HS')).toEqual({ min: 25, max: 30 });
    expect(scaleFor('NYPDL October OL')).toEqual({ min: 23, max: 30 });
    expect(scaleFor('YFL 1')).toEqual({ min: 0, max: 100 });
  });

  it('maps other scales onto the canonical one', () => {
    expect(toCanonical(27.5, { min: 25, max: 30 })).toBeCloseTo(27.5);
    // Midpoint of 23-30 lands at the midpoint of 25-30.
    expect(toCanonical(26.5, { min: 23, max: 30 })).toBeCloseTo(27.5);
    expect(toCanonical(50, { min: 0, max: 100 })).toBeCloseTo(27.5);
  });

  it('keeps a punitive score below the scale rather than clamping it', () => {
    // A 24 on a 25-30 ballot is a real, unusually low score.
    expect(toCanonical(24, { min: 25, max: 30 })).toBeLessThan(25);
    expect(classifyRaw(24, { min: 25, max: 30 })).toEqual({ usable: true });
  });

  it('rejects forfeits and impossible values', () => {
    expect(classifyRaw(0, { min: 25, max: 30 })).toMatchObject({ usable: false, reason: 'sentinel' });
    expect(classifyRaw(11.5, { min: 25, max: 30 })).toMatchObject({ usable: false, reason: 'out-of-range' });
    // Zero is a legitimate score where the scale starts there.
    expect(classifyRaw(0, { min: 0, max: 100 })).toEqual({ usable: true });
  });
});

describe('robust statistics', () => {
  it('takes a median rather than a mean', () => {
    expect(median([27, 28, 29])).toBe(28);
    expect(median([27, 28, 29, 30])).toBe(28.5);
  });

  it('barely moves when one score is punitive', () => {
    const ordinary = [27, 27.5, 28, 28, 28.5, 29];
    const withSanction = [...ordinary, 24];
    const a = robustStats(ordinary);
    const b = robustStats(withSanction);
    expect(Math.abs(b.centre - a.centre)).toBeLessThan(0.35);
    // A standard deviation would roughly double here; the robust spread must not.
    expect(b.spread).toBeLessThan(a.spread * 1.6);
  });
});

describe('judgeNormalizer', () => {
  const pool = robustStats([26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5]);

  it('places a score at the judge baseline on the pool average', () => {
    const judge = robustStats(many(26, 40).concat(many(27, 40)));
    const n = judgeNormalizer(judge, pool);
    // `n.centre`, not the raw median: shrinkage deliberately moves a judge's
    // baseline toward the pool in proportion to how little evidence they give.
    expect(n.z(n.centre)).toBeCloseTo(0, 6);
    expect(n.display(n.centre)).toBeCloseTo(pool.centre, 6);
  });

  it('shrinks a judge baseline toward the pool', () => {
    const harshMedian = 26;
    const judge = robustStats(many(harshMedian, 40));
    const n = judgeNormalizer(judge, pool);
    expect(n.centre).toBeGreaterThan(harshMedian);
    expect(n.centre).toBeLessThan(pool.centre);
  });

  it('makes a harsh and a generous judge comparable', () => {
    // Same shape, shifted two points apart. Both busy enough that their own
    // baselines are trusted, so this measures normalization rather than
    // shrinkage.
    const harsh = robustStats([24, 25, 26, 27, 28].flatMap((v) => many(v, 60)));
    const kind = robustStats([26, 27, 28, 29, 30].flatMap((v) => many(v, 60)));
    const topOfHarsh = judgeNormalizer(harsh, pool).z(28);
    const topOfKind = judgeNormalizer(kind, pool).z(30);
    // Raw, these differ by a full two points; normalized they should agree.
    expect(Math.abs(topOfHarsh - topOfKind)).toBeLessThan(0.2);
    expect(topOfHarsh).toBeGreaterThan(1);
  });

  it('trusts a busy judge more than a new one', () => {
    const sparse = robustStats([29, 29.5]);
    const busy = robustStats(many(29, 100).concat(many(29.5, 100)));
    // Both look generous; only the busy one has earned that baseline, so an
    // identical score should read as further above average for them.
    expect(Math.abs(judgeNormalizer(sparse, pool).z(29.5)))
      .toBeGreaterThan(Math.abs(judgeNormalizer(busy, pool).z(29.5)));
  });

  it('falls back to the pool when a judge has no usable spread', () => {
    const identical = robustStats(many(28, 6));
    const n = judgeNormalizer(identical, pool);
    expect(Number.isFinite(n.z(29))).toBe(true);
    expect(n.spread).toBeGreaterThanOrEqual(MIN_SPREAD);
  });

  it('shrinks halfway at the configured sample size', () => {
    const judge = robustStats(many(26, SHRINKAGE_BALLOTS));
    const n = judgeNormalizer(judge, pool);
    expect(n.centre).toBeCloseTo((26 + pool.centre) / 2, 6);
  });

  it('leaves a single punitive score from moving other debaters', () => {
    const clean = robustStats([27, 27.5, 28, 28, 28.5, 29, 29, 29.5]);
    const sanctioned = robustStats([27, 27.5, 28, 28, 28.5, 29, 29, 29.5, 24]);
    const before = judgeNormalizer(clean, pool).display(29);
    const after = judgeNormalizer(sanctioned, pool).display(29);
    expect(Math.abs(after - before)).toBeLessThan(0.3);
  });

  it('reports display values on the familiar scale', () => {
    const judge = robustStats([26, 27, 28, 29, 30].flatMap((v) => many(v, 10)));
    const d = judgeNormalizer(judge, pool).display(30);
    expect(d).toBeGreaterThan(CANONICAL.min);
    expect(d).toBeLessThan(CANONICAL.max + 1);
  });
});
