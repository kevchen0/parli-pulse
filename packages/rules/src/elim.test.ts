import { describe, expect, it } from 'vitest';
import {
  ELIM_LEVELS,
  ELIM_LEVEL_FIELD_SIZE,
  ELIM_POINTS_TABLE,
  MIN_AFS_FOR_LEVEL,
  type ElimLevel,
} from './constants.ts';
import {
  breakPercentagePenalty,
  elimLevelFromSectionCount,
  elimPoints,
  findAfsBand,
  prelimCountAdjustment,
  prelimPoints,
} from './elim.ts';

describe('Elim Points Table structure', () => {
  it('covers every field size from 10 upward with no gaps or overlaps', () => {
    for (let i = 1; i < ELIM_POINTS_TABLE.length; i++) {
      expect(ELIM_POINTS_TABLE[i]!.minAfs).toBe(ELIM_POINTS_TABLE[i - 1]!.maxAfs + 1);
    }
    expect(ELIM_POINTS_TABLE[0]!.minAfs).toBe(10);
    expect(ELIM_POINTS_TABLE.at(-1)!.maxAfs).toBe(Infinity);
  });

  it('nulls exactly the cells whose bracket cannot fit in the field', () => {
    // The table's stepped border is not decorative: a level is unreachable
    // precisely when the bracket holds as many teams as the entire field.
    for (const b of ELIM_POINTS_TABLE) {
      for (const level of ELIM_LEVELS) {
        const reachable = b.minAfs >= MIN_AFS_FOR_LEVEL[level];
        expect(b.points[level] === null).toBe(!reachable);
      }
    }
  });

  it('derives each level threshold from its bracket size', () => {
    for (const level of ['tripleOcto', 'doubleOcto', 'octo'] as const) {
      expect(MIN_AFS_FOR_LEVEL[level]).toBe(ELIM_LEVEL_FIELD_SIZE[level] + 1);
    }
  });

  it('increases monotonically down each column and across each row', () => {
    for (const level of ELIM_LEVELS) {
      const col = ELIM_POINTS_TABLE.map((b) => b.points[level]).filter(
        (v): v is number => v !== null,
      );
      for (let i = 1; i < col.length; i++) expect(col[i]!).toBeGreaterThan(col[i - 1]!);
    }
    for (const b of ELIM_POINTS_TABLE) {
      const row = ELIM_LEVELS.map((l) => b.points[l]).filter((v): v is number => v !== null);
      // 'second' and 'first' both sit at the end; every step must still rise.
      for (let i = 1; i < row.length; i++) expect(row[i]!).toBeGreaterThan(row[i - 1]!);
    }
  });
});

describe('band boundaries', () => {
  it.each([
    [9, null],
    [10, '10-11'],
    [11, '10-11'],
    [12, '12-13'],
    [16, '14-16'],
    [17, '17-19'],
    [32, '28-32'],
    [33, '33-38'],
    [64, '55-64'],
    [65, '65-77'],
    [218, '184-218'],
    [219, '219+'],
    [10_000, '219+'],
  ])('afs %i falls in band %s', (afs, expected) => {
    const band = findAfsBand(afs);
    if (expected === null) {
      expect(band).toBeNull();
      return;
    }
    const label =
      band!.maxAfs === Infinity ? `${band!.minAfs}+` : `${band!.minAfs}-${band!.maxAfs}`;
    expect(label).toBe(expected);
  });
});

describe('elimPoints', () => {
  it('reads known cells from the published table', () => {
    expect(elimPoints(10, 'first')).toBe(17);
    expect(elimPoints(79, 'first')).toBe(29);
    expect(elimPoints(145, 'first')).toBe(32);
    expect(elimPoints(219, 'tripleOcto')).toBe(9);
    expect(elimPoints(1000, 'first')).toBe(35);
  });

  it('returns null rather than 0 for unreachable brackets', () => {
    expect(elimPoints(16, 'octo')).toBeNull();
    expect(elimPoints(32, 'doubleOcto')).toBeNull();
    expect(elimPoints(64, 'tripleOcto')).toBeNull();
    // ...and a real value one team later.
    expect(elimPoints(17, 'octo')).toBe(2);
    expect(elimPoints(33, 'doubleOcto')).toBe(2);
    expect(elimPoints(65, 'tripleOcto')).toBe(2);
  });

  it('returns null below the table floor', () => {
    expect(elimPoints(9, 'first')).toBeNull();
  });
});

describe('elimLevelFromSectionCount', () => {
  it('maps room counts to brackets', () => {
    const cases: [number, ElimLevel][] = [
      [32, 'tripleOcto'], [16, 'doubleOcto'], [8, 'octo'],
      [4, 'quarter'], [2, 'semi'], [1, 'first'],
    ];
    for (const [sections, level] of cases) {
      expect(elimLevelFromSectionCount(sections)).toBe(level);
    }
  });

  it('rejects counts that are not a power-of-two bracket', () => {
    for (const n of [0, 3, 5, 6, 7, 9, 12, 13]) {
      expect(elimLevelFromSectionCount(n)).toBeNull();
    }
  });
});

describe('prelimPoints (XXI.3.A)', () => {
  it('matches the published record table', () => {
    expect(prelimPoints(2, 1)).toBe(4);
    expect(prelimPoints(6, 0)).toBe(16);
    expect(prelimPoints(4, 2)).toBe(6);
    expect(prelimPoints(5, 1)).toBe(12);
  });

  it('awards nothing for records absent from the table', () => {
    // Losing and even records earn nothing here; XXI.2.C governs the exception.
    expect(prelimPoints(1, 2)).toBe(0);
    expect(prelimPoints(0, 5)).toBe(0);
    expect(prelimPoints(3, 3)).toBe(0);
  });
});

describe('breakPercentagePenalty (XXI.2.D)', () => {
  it.each([
    [0, -6], [4.7, -6],
    [4.8, -5], [6.6, -5],
    [6.7, -4], [9.4, -4],
    [9.5, -3], [13.4, -3],
    [13.5, -2], [18.9, -2],
    [19.0, -1], [26.8, -1],
    [26.9, 0], [27.0, 0], [50, 0], [100, 0],
  ])('break of %s%% incurs %i', (pct, expected) => {
    expect(breakPercentagePenalty(pct)).toBe(expected);
  });
});

describe('prelimCountAdjustment (XXI.2.E)', () => {
  it.each([[3, -6], [4, -3], [5, 0], [6, 1], [7, 3], [8, 3], [12, 3]])(
    '%i prelims adjusts by %i',
    (count, expected) => {
      expect(prelimCountAdjustment(count)).toBe(expected);
    },
  );
});
