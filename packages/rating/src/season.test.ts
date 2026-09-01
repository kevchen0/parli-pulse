import { describe, expect, it } from 'vitest';
import { DEFAULT_DEVIATION, DEFAULT_RATING } from './glicko2.ts';
import {
  DEFAULT_OPTIONS,
  type RatedRound,
  type RatingPeriod,
  SeasonRun,
  VALIDATED_OPTIONS,
  estimateSideAdvantage,
  runSeason,
} from './season.ts';

/** A decided round, single judge, `a` on proposition unless told otherwise. */
const round = (
  id: string,
  a: string,
  b: string,
  aWins: boolean,
  extra: Partial<RatedRound> = {},
): RatedRound => ({
  id, a, b, wonA: aWins ? 1 : 0, ballots: 1, sideA: 1, kind: 'prelim', ...extra,
});

const period = (id: string, date: string, rounds: RatedRound[]): RatingPeriod => ({
  id, tournamentId: id, date, final: true, rounds,
});

describe('SeasonRun', () => {
  it('rates a winner above a loser', () => {
    const run = runSeason([period('t1', '2025-09-06', [round('r1', 'A', 'B', true)])], new Map());
    expect(run.ratingAt('A', '2025-09-06').rating).toBeGreaterThan(
      run.ratingAt('B', '2025-09-06').rating,
    );
  });

  it('counts a round for both teams in it', () => {
    const run = runSeason(
      [period('t1', '2025-09-06', [round('r1', 'A', 'B', true), round('r2', 'A', 'B', false)])],
      new Map(),
    );
    expect(run.roundsFor('A')).toBe(2);
    expect(run.roundsFor('B')).toBe(2);
  });

  /**
   * The property that makes a tournament the right rating period. If round one
   * were applied before round two were judged, a team's second opponent would
   * be priced using a rating the first round produced, and the order Tabroom
   * happens to return rounds in would change the answer.
   */
  it('judges every round in a period against the ratings held before it', () => {
    const rounds = [round('r1', 'A', 'B', true), round('r2', 'C', 'A', true)];
    const forward = runSeason([period('t1', '2025-09-06', rounds)], new Map());
    const backward = runSeason([period('t1', '2025-09-06', [...rounds].reverse())], new Map());
    for (const team of ['A', 'B', 'C']) {
      expect(forward.ratingAt(team, '2025-09-06').rating).toBeCloseTo(
        backward.ratingAt(team, '2025-09-06').rating,
        9,
      );
    }
  });

  it('widens the deviation of a team that stops competing', () => {
    const run = runSeason([period('t1', '2025-09-06', [round('r1', 'A', 'B', true)])], new Map());
    const settled = run.ratingAt('A', '2025-09-06');
    const later = run.ratingAt('A', '2026-03-06');
    expect(later.rating).toBeCloseTo(settled.rating, 9);
    expect(later.deviation).toBeGreaterThan(settled.deviation);
  });

  it('gives an unseen partnership the default rating', () => {
    const run = new SeasonRun();
    const r = run.ratingAt('nobody', '2025-09-06');
    expect(r.rating).toBe(DEFAULT_RATING);
    expect(r.deviation).toBe(DEFAULT_DEVIATION);
    expect(run.roundsFor('nobody')).toBe(0);
  });

  describe('seeding a new partnership', () => {
    /**
     * The whole reason the rating is worth more than the league's ranking on
     * this data: a debater who changes partner mid-season should not hand their
     * new partnership a blank slate.
     */
    const members = new Map<string, string[]>([
      ['strong', ['ann', 'bea']],
      ['weak', ['cal', 'dee']],
      ['newPair', ['ann', 'cal']],
    ]);

    const establish = (options = VALIDATED_OPTIONS): SeasonRun => {
      const run = new SeasonRun(options);
      for (const [k, m] of members) run.declareMembers(k, m);
      for (let i = 0; i < 6; i++) {
        run.runPeriod(
          period(`t${i}`, `2025-${String(9 + i).padStart(2, '0')}-06`, [
            round(`r${i}`, 'strong', 'weak', true),
          ]),
        );
      }
      return run;
    };

    it('starts a new pairing between its debaters, not at the default', () => {
      const run = establish();
      const seeded = run.ratingAt('newPair', '2026-01-10');
      const strong = run.ratingAt('strong', '2026-01-10').rating;
      const weak = run.ratingAt('weak', '2026-01-10').rating;
      expect(strong).toBeGreaterThan(weak);
      expect(seeded.rating).toBeGreaterThan(weak);
      expect(seeded.rating).toBeLessThan(strong);
    });

    it('is less sure of a new pairing than of either partnership behind it', () => {
      const run = establish();
      const seeded = run.ratingAt('newPair', '2026-01-10');
      expect(seeded.deviation).toBeGreaterThan(run.ratingAt('strong', '2026-01-10').deviation);
      expect(seeded.deviation).toBeLessThanOrEqual(DEFAULT_DEVIATION);
    });

    it('starts cold when seeding is off', () => {
      const run = establish({ ...VALIDATED_OPTIONS, seedFromMembers: false });
      expect(run.ratingAt('newPair', '2026-01-10').rating).toBe(DEFAULT_RATING);
    });

    it('leaves a pairing of two unknowns at the default', () => {
      const run = new SeasonRun(VALIDATED_OPTIONS);
      run.declareMembers('fresh', ['nobody1', 'nobody2']);
      const r = run.ratingAt('fresh', '2025-09-06');
      expect(r.rating).toBe(DEFAULT_RATING);
      expect(r.deviation).toBe(DEFAULT_DEVIATION);
    });
  });

  describe('side', () => {
    it('credits a win from opposition more than the same win from proposition', () => {
      const opts = { ...DEFAULT_OPTIONS, sideAdvantage: 40 };
      const asProp = runSeason(
        [period('t1', '2025-09-06', [round('r1', 'A', 'B', true, { sideA: 1 })])],
        new Map(),
        opts,
      );
      const asOpp = runSeason(
        [period('t1', '2025-09-06', [round('r1', 'A', 'B', true, { sideA: 2 })])],
        new Map(),
        opts,
      );
      expect(asOpp.ratingAt('A', '2025-09-06').rating).toBeGreaterThan(
        asProp.ratingAt('A', '2025-09-06').rating,
      );
    });

    it('reads the proposition edge off the results', () => {
      // Opposition takes three of four, so the edge belongs to opposition.
      const rounds = [
        round('r1', 'A', 'B', false, { sideA: 1 }),
        round('r2', 'C', 'D', false, { sideA: 1 }),
        round('r3', 'E', 'F', false, { sideA: 1 }),
        round('r4', 'G', 'H', true, { sideA: 1 }),
      ];
      expect(estimateSideAdvantage(rounds)).toBeLessThan(0);
      const even = [round('r1', 'A', 'B', true), round('r2', 'C', 'D', false)];
      expect(estimateSideAdvantage(even)).toBeCloseTo(0, 9);
    });

    it('reports no edge when there is nothing to read', () => {
      expect(estimateSideAdvantage([])).toBe(0);
    });
  });

  it('records one history row per subject per period it competed in', () => {
    const run = runSeason(
      [
        period('t1', '2025-09-06', [round('r1', 'A', 'B', true)]),
        period('t2', '2025-10-06', [round('r2', 'A', 'C', true)]),
      ],
      new Map(),
    );
    expect(run.history.filter((h) => h.subject === 'A').map((h) => h.periodId)).toEqual(['t1', 't2']);
    expect(run.history.filter((h) => h.subject === 'B')).toHaveLength(1);
    // B sat out the second tournament and still appears in the standings.
    expect(run.standingsAt('2025-10-06').map((s) => s.subject).sort()).toEqual(['A', 'B', 'C']);
  });

  it('brings every standing forward to the same date', () => {
    const run = runSeason(
      [
        period('t1', '2025-09-06', [round('r1', 'A', 'B', true)]),
        period('t2', '2026-01-06', [round('r2', 'C', 'D', true)]),
      ],
      new Map(),
    );
    const at = new Map(run.standingsAt('2026-01-06').map((s) => [s.subject, s.rating.deviation]));
    // A has been away four months, C has just debated.
    expect(at.get('A')!).toBeGreaterThan(at.get('C')!);
  });
});

describe('contested rounds', () => {
  /** A period holding both ratable rounds and rounds we could not rate. */
  const mixed = (
    id: string,
    date: string,
    rounds: RatedRound[],
    contested: Record<string, number>,
  ): RatingPeriod => ({
    id, tournamentId: id, date, final: true, rounds,
    contested: new Map(Object.entries(contested)),
  });

  it('counts toward the gate without touching the rating', () => {
    const rounds = [round('r1', 'A', 'B', true)];
    const plain = runSeason([mixed('t1', '2025-09-06', rounds, {})], new Map());
    const withMav = runSeason([mixed('t1', '2025-09-06', rounds, { A: 3 })], new Map());

    // The whole point: the gate moves, the rating does not.
    expect(withMav.gateRoundsFor('A')).toBe(plain.gateRoundsFor('A') + 3);
    expect(withMav.roundsFor('A')).toBe(plain.roundsFor('A'));
    expect(withMav.ratingAt('A', '2025-09-06')).toEqual(plain.ratingAt('A', '2025-09-06'));
  });

  it('leaves the deviation alone, so an unratable round buys no certainty', () => {
    const rounds = [round('r1', 'A', 'B', true)];
    const plain = runSeason([mixed('t1', '2025-09-06', rounds, {})], new Map());
    const withMav = runSeason([mixed('t1', '2025-09-06', rounds, { A: 5 })], new Map());
    expect(withMav.ratingAt('A', '2025-09-06').deviation)
      .toBeCloseTo(plain.ratingAt('A', '2025-09-06').deviation, 10);
  });

  it('keeps them out of the rated count that calibration reads', () => {
    const run = runSeason(
      [mixed('t1', '2025-09-06', [round('r1', 'A', 'B', true)], { A: 9 })],
      new Map(),
    );
    // Ten gate rounds, one rated. Calibration must see the one.
    expect(run.gateRoundsFor('A')).toBe(10);
    expect(run.roundsFor('A')).toBe(1);
  });

  it('tracks a subject whose only rounds were unratable', () => {
    const run = runSeason([mixed('t1', '2025-09-06', [], { Z: 5 })], new Map());
    expect(run.gateRoundsFor('Z')).toBe(5);
    // No rating came from anywhere, so it must still read as entirely unknown.
    expect(run.roundsFor('Z')).toBe(0);
    expect(run.ratingAt('Z', '2025-09-06').rating).toBe(DEFAULT_RATING);
    expect(run.ratingAt('Z', '2025-09-06').deviation).toBe(DEFAULT_DEVIATION);
  });

  it('still widens the deviation across a period spent only on unratable rounds', () => {
    // Turning up to a round nobody can score teaches us exactly as much as not
    // turning up, so the deviation must grow as though the subject were away.
    const rounds = [round('r1', 'A', 'B', true)];
    const run = runSeason(
      [
        mixed('t1', '2025-09-06', rounds, {}),
        mixed('t2', '2025-11-06', [], { A: 4 }),
      ],
      new Map(),
    );
    const at = run.ratingAt('A', '2025-11-06');
    const before = runSeason([mixed('t1', '2025-09-06', rounds, {})], new Map());
    expect(at.deviation).toBeGreaterThan(before.ratingAt('A', '2025-09-06').deviation);
    expect(run.gateRoundsFor('A')).toBe(5);
  });

  it('accumulates across periods', () => {
    const run = runSeason(
      [
        mixed('t1', '2025-09-06', [round('r1', 'A', 'B', true)], { A: 2 }),
        mixed('t2', '2025-10-06', [round('r2', 'A', 'B', false)], { A: 1 }),
      ],
      new Map(),
    );
    expect(run.roundsFor('A')).toBe(2);
    expect(run.gateRoundsFor('A')).toBe(5);
  });

  it('is inert when a period declares none', () => {
    const rounds = [round('r1', 'A', 'B', true)];
    const a = runSeason([period('t1', '2025-09-06', rounds)], new Map());
    const b = runSeason([mixed('t1', '2025-09-06', rounds, {})], new Map());
    expect(a.gateRoundsFor('A')).toBe(b.gateRoundsFor('A'));
    expect(a.ratingAt('A', '2025-09-06')).toEqual(b.ratingAt('A', '2025-09-06'));
  });
});
