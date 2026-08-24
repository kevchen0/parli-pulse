/**
 * Results the league scores that Tabroom does not carry.
 *
 * Some tournaments do not run on Tabroom at all -- Phillipsburg and Hap
 * Hingston publish on SpeechWire -- and some publish so little that most of
 * their field is unrecoverable. Those results are real and count toward the
 * standings, so they are entered here by hand rather than silently missing.
 *
 * Every entry is a claim we cannot verify against a primary source we control.
 * Keep `source` accurate, keep the list short, and prefer fixing ingestion
 * whenever a result is actually available somewhere.
 */

export interface ManualResult {
  /** League tournament name, exactly as the rankings sheet writes it. */
  tournament: string;
  school: string;
  partner1: string;
  partner2: string;
  /** Article XXI points for this result. */
  points: number;
  /** Where the figure came from, so it can be re-checked. */
  source: 'speechwire' | 'reported' | 'sheet';
}

export const MANUAL_RESULTS: ManualResult[] = [
  // Runs on SpeechWire, not Tabroom.
  { tournament: 'Phillipsburg Fall Spooktacular', school: 'Bridgewater-Raritan', partner1: 'Gvozdenovic', partner2: 'Patel', points: 7, source: 'speechwire' },
  { tournament: 'Phillipsburg Fall Spooktacular', school: 'Morris Knolls', partner1: 'Johnson', partner2: 'Mantripragada', points: 7, source: 'speechwire' },
  { tournament: 'Phillipsburg Fall Spooktacular', school: 'Ridge', partner1: 'Butala', partner2: 'Vasanthavada', points: 7, source: 'speechwire' },
  { tournament: 'Phillipsburg Fall Spooktacular', school: 'Ridge', partner1: 'Chen', partner2: 'Mitra', points: 7, source: 'speechwire' },
  { tournament: 'Phillipsburg Fall Spooktacular', school: 'Hunterdon', partner1: 'Khalsa', partner2: 'Schroppe', points: 13, source: 'speechwire' },
  { tournament: 'Phillipsburg Fall Spooktacular', school: 'Ridge', partner1: 'Qin', partner2: 'Shah', points: 19, source: 'speechwire' },

  // Also SpeechWire.
  { tournament: 'Hap Hingston', school: 'Westview', partner1: 'Bethapudi', partner2: 'Bian', points: 4, source: 'speechwire' },
  { tournament: 'Hap Hingston', school: 'Tualatin', partner1: 'Vander Plog', partner2: 'Wiese', points: 4, source: 'speechwire' },
  { tournament: 'Hap Hingston', school: 'Oregon City', partner1: 'McFarland', partner2: 'Sanders', points: 7, source: 'speechwire' },
  { tournament: 'Hap Hingston', school: 'Westview', partner1: 'Liu', partner2: 'Xu', points: 7, source: 'speechwire' },
  { tournament: 'Hap Hingston', school: "St. Mary's (OR)", partner1: 'Ghavam', partner2: 'Wilcox', points: 14, source: 'speechwire' },
  { tournament: 'Hap Hingston', school: "St. Mary's (OR)", partner1: 'Davis', partner2: 'Janeway', points: 14, source: 'speechwire' },
];

/**
 * Tournaments whose Tabroom data is too incomplete to score from, flagged so
 * the gap is visible rather than looking like an ingestion failure.
 */
export const INCOMPLETE_TOURNAMENTS: { tournament: string; note: string }[] = [
  {
    tournament: 'Ridge Debates',
    note: 'Published 4 of 28 teams to Tabroom. The rest exist in no public source; needs manual entry from the tournament.',
  },
];
