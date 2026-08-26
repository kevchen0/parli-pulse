import { describe, expect, it } from 'vitest';
import { seasonDestination } from '../app/[season]/season-picker.tsx';

describe('seasonDestination', () => {
  it('stays on a debater when the season changes', () => {
    // A profile is the same page in every season and says so when empty, so
    // this is the one path certain to exist in the target season.
    expect(seasonDestination('/2025-26/debater/1597465', '2026-27')).toBe(
      '/2026-27/debater/1597465',
    );
  });

  it('sends every other page to Points, as it always did', () => {
    for (const path of [
      '/2025-26/points/debaters',
      '/2025-26/ratings',
      '/2025-26/speakers',
      '/2025-26/diagnostic',
      '/2025-26/method/ratings',
      null,
    ]) {
      expect(seasonDestination(path, '2026-27')).toBe('/2026-27/points');
    }
  });

  it('does not mistake a deeper path under a debater for a profile', () => {
    expect(seasonDestination('/2025-26/debater/1597465/rounds', '2026-27')).toBe(
      '/2026-27/points',
    );
  });
});
