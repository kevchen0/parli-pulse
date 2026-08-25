import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEVIATION,
  ballotScore,
  decay,
  defaultRating,
  update,
  winProbability,
} from './glicko2.ts';

describe('glicko-2', () => {
  /**
   * The worked example from Glickman's own paper, which is the only external
   * check available: a 1500/200/0.06 player who beats a 1400 and loses to a
   * 1550 and a 1700 finishes at 1464.06/151.52/0.05999.
   *
   * The rating and volatility are checked a place short of the figures the
   * paper prints. It rounds every intermediate to four places; carrying full
   * precision instead lands on 1464.0507 and 0.059996. The deviation matches
   * outright, so the difference is the paper's arithmetic, not ours.
   */
  it('reproduces the published worked example', () => {
    const r = update(
      { rating: 1500, deviation: 200, volatility: 0.06 },
      [
        { rating: 1400, deviation: 30, score: 1 },
        { rating: 1550, deviation: 100, score: 0 },
        { rating: 1700, deviation: 300, score: 0 },
      ],
      { tau: 0.5 },
    );
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.deviation).toBeCloseTo(151.52, 2);
    expect(r.volatility).toBeCloseTo(0.05999, 4);
  });

  it('moves an uncertain rating further than a settled one on the same result', () => {
    const opponents = [{ rating: 1500, deviation: 50, score: 1 }];
    const unsure = update({ rating: 1500, deviation: 300, volatility: 0.06 }, opponents);
    const settled = update({ rating: 1500, deviation: 60, volatility: 0.06 }, opponents);
    expect(unsure.rating - 1500).toBeGreaterThan(settled.rating - 1500);
  });

  it('pays more for beating a stronger opponent', () => {
    const strong = update(defaultRating(), [{ rating: 1800, deviation: 60, score: 1 }]);
    const weak = update(defaultRating(), [{ rating: 1200, deviation: 60, score: 1 }]);
    expect(strong.rating).toBeGreaterThan(weak.rating);
  });

  it('narrows the deviation as results accumulate', () => {
    let r = defaultRating();
    const before = r.deviation;
    for (let i = 0; i < 5; i++) {
      r = update(r, [
        { rating: 1500, deviation: 80, score: 1 },
        { rating: 1500, deviation: 80, score: 0 },
      ]);
    }
    expect(r.deviation).toBeLessThan(before);
    // Two even results a period should leave the rating roughly where it was.
    expect(Math.abs(r.rating - 1500)).toBeLessThan(15);
  });

  describe('side advantage', () => {
    it('credits a win from the unfavoured side more than one from the favoured', () => {
      const opponent = { rating: 1500, deviation: 80, score: 1 };
      const favoured = update(defaultRating(), [{ ...opponent, advantage: 40 }]);
      const against = update(defaultRating(), [{ ...opponent, advantage: -40 }]);
      expect(against.rating).toBeGreaterThan(favoured.rating);
    });

    it('leaves the rating alone when the sides are worth nothing', () => {
      const plain = update(defaultRating(), [{ rating: 1500, deviation: 80, score: 1 }]);
      const zero = update(defaultRating(), [
        { rating: 1500, deviation: 80, score: 1, advantage: 0 },
      ]);
      expect(zero.rating).toBeCloseTo(plain.rating, 10);
    });
  });

  describe('ballotScore', () => {
    it('scores a single-judge round as a plain win or loss at any weight', () => {
      for (const w of [0, 0.5, 1]) {
        expect(ballotScore(1, 1, w)).toBe(1);
        expect(ballotScore(0, 1, w)).toBe(0);
      }
    });

    it('ignores the split entirely at zero weight', () => {
      expect(ballotScore(2, 3, 0)).toBe(1);
      expect(ballotScore(3, 3, 0)).toBe(1);
    });

    it('pulls a split decision toward a draw as the weight rises', () => {
      expect(ballotScore(3, 3, 1)).toBe(1);
      expect(ballotScore(2, 3, 1)).toBeCloseTo(2 / 3, 10);
      expect(ballotScore(2, 3, 0.5)).toBeCloseTo(5 / 6, 10);
      // The loser of a 2-1 gets the complement, so a round still totals one.
      expect(ballotScore(1, 3, 1) + ballotScore(2, 3, 1)).toBeCloseTo(1, 10);
    });

    it('calls an evenly split panel a draw', () => {
      expect(ballotScore(1, 2, 1)).toBe(0.5);
      expect(ballotScore(1, 2, 0)).toBe(0.5);
    });
  });

  describe('decay', () => {
    it('holds the rating and widens the deviation', () => {
      const r = { rating: 1700, deviation: 90, volatility: 0.06 };
      const d = decay(r, 4);
      expect(d.rating).toBe(1700);
      expect(d.deviation).toBeGreaterThan(90);
    });

    it('never widens past the deviation of an unrated team', () => {
      const r = { rating: 1700, deviation: 340, volatility: 0.3 };
      expect(decay(r, 200).deviation).toBe(DEFAULT_DEVIATION);
    });

    it('is what an empty rating period does', () => {
      const r = { rating: 1700, deviation: 90, volatility: 0.06 };
      expect(update(r, [])).toEqual(decay(r, 1));
    });
  });

  describe('winProbability', () => {
    it('is even between identical teams', () => {
      const a = { rating: 1500, deviation: 60 };
      expect(winProbability(a, a)).toBeCloseTo(0.5, 10);
    });

    it('is symmetric', () => {
      const a = { rating: 1650, deviation: 60 };
      const b = { rating: 1500, deviation: 120 };
      expect(winProbability(a, b) + winProbability(b, a)).toBeCloseTo(1, 10);
    });

    it('hedges toward a coin flip when either team is unrated', () => {
      const gap = { rating: 1800, deviation: 50 };
      const known = { rating: 1500, deviation: 50 };
      const unknown = { rating: 1500, deviation: 350 };
      expect(winProbability(gap, unknown)).toBeLessThan(winProbability(gap, known));
      expect(winProbability(gap, unknown)).toBeGreaterThan(0.5);
    });

    it('favours the side that is worth something', () => {
      const a = { rating: 1500, deviation: 60 };
      expect(winProbability(a, a, 30)).toBeGreaterThan(0.5);
    });
  });
});
