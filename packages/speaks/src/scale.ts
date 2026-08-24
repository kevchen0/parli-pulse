/**
 * Speaker point scales.
 *
 * The convention is 25-30, but it is not universal: NYPDL runs 23-30 across
 * its whole slate, and YFL 1 uses 0-100. A scale must come from configuration,
 * never from the observed minimum -- a single punitive 24 on a 25-30 ballot
 * would otherwise be read as a wider scale, which misclassifies 24 of the 43
 * parli events in 2025-26.
 *
 * See plan/09-data-quality.md section 5.
 */

export interface Scale {
  min: number;
  max: number;
}

/** What everything is normalized onto, and what display values are shown in. */
export const CANONICAL: Scale = { min: 25, max: 30 };

export const DEFAULT_SCALE: Scale = { min: 25, max: 30 };

/**
 * Scales that differ from the convention, matched against the league's
 * tournament name. Add here as leagues declare them; do not infer.
 */
export const SCALE_OVERRIDES: { tournament: RegExp; scale: Scale }[] = [
  { tournament: /^NYPDL/i, scale: { min: 23, max: 30 } },
  { tournament: /^YFL 1$/i, scale: { min: 0, max: 100 } },
];

export function scaleFor(tournamentName: string): Scale {
  return SCALE_OVERRIDES.find((o) => o.tournament.test(tournamentName))?.scale ?? DEFAULT_SCALE;
}

/**
 * Maps a raw score onto the canonical 25-30 scale so that judges working
 * across leagues are comparable.
 *
 * Deliberately linear and unclamped: a punitive score below the scale minimum
 * stays below 25 afterwards, which is correct. It is a real, unusually low
 * score, and the robust statistics downstream are what keep it from distorting
 * a judge's baseline.
 */
export function toCanonical(raw: number, scale: Scale): number {
  const span = scale.max - scale.min;
  if (span <= 0) return raw;
  return CANONICAL.min + ((raw - scale.min) * (CANONICAL.max - CANONICAL.min)) / span;
}

/**
 * Values that are not scores. Zero is how a forfeit or no-show is recorded;
 * anything far below the scale is a data-entry error rather than a ballot.
 */
export function classifyRaw(
  raw: number,
  scale: Scale,
): { usable: true } | { usable: false; reason: 'sentinel' | 'out-of-range' } {
  if (raw === 0 && scale.min > 0) return { usable: false, reason: 'sentinel' };
  const span = scale.max - scale.min;
  // Allow a punitive margin below the stated minimum -- those are real ballots.
  if (raw < scale.min - span || raw > scale.max + span * 0.1) {
    return { usable: false, reason: 'out-of-range' };
  }
  return { usable: true };
}
