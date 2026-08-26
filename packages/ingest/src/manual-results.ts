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

  // Ridge Debates published four of its twenty-eight teams to Tabroom, which
  // is worse than publishing none: the field size and every band are
  // unknowable from a quarter of a bracket, so its four visible teams scored
  // zero and the rest scored nothing. Supplied by the league.
  //
  // Every figure below is what the elim points table gives at this
  // tournament's AFS of 56 -- band 55-64, so octofinalist 9, quarterfinalist
  // 13, semifinalist 17, finalist 21, champion 27 -- with a 3-2 worth 4 under
  // XXI.3.A and no break penalty at a 28.6% break. They are consistent with
  // the rules rather than merely asserted, which is the only check available
  // when there is no bracket to recompute from.
  // 3-2 -- 4
  { tournament: 'Ridge Debates', school: 'Watchung Hills', partner1: 'Muchnik', partner2: 'Uslay', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Stuyvesant', partner1: 'Dugar', partner2: 'Karim', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Regis', partner1: 'Jette', partner2: 'Takata', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Stuyvesant', partner1: 'Burdi', partner2: 'Efraim', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Trinity', partner1: 'Hebard', partner2: 'Perales', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Stuyvesant', partner1: 'Dugdale', partner2: 'Huang', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Bard Queens', partner1: 'Lin', partner2: 'Naidich', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Brooklyn Tech', partner1: 'Malish', partner2: 'Tsujimoto', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Stuyvesant', partner1: 'Kowalski', partner2: 'Wong', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Jia', partner2: 'Robinson', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Bard Queens', partner1: 'Defrias', partner2: 'Do', points: 4, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Brooklyn Tech', partner1: 'Korneeva', partner2: 'Zhang', points: 4, source: 'reported' },
  // octofinalist -- 9
  { tournament: 'Ridge Debates', school: 'Regis', partner1: 'Brennan', partner2: 'Louis', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Bard Queens', partner1: 'Kumorowska-Candra', partner2: 'Tong', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Ranjan', partner2: 'Worthington', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Eng', partner2: 'Fine', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Regis', partner1: 'Dominguez', partner2: 'Rodriguez', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Balber', partner2: 'Shah', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Regis', partner1: 'Denehy', partner2: 'Shrekgast', points: 9, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Bard Queens', partner1: 'Berkowitz', partner2: 'Sherman', points: 9, source: 'reported' },
  // quarterfinalist -- 13
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Lemons', partner2: 'Sene', points: 13, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Koehl', partner2: 'Meyer', points: 13, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Regis', partner1: 'Liew', partner2: 'Napoli', points: 13, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Regis', partner1: 'Pace', partner2: 'Quadras', points: 13, source: 'reported' },
  // semifinalist -- 17
  { tournament: 'Ridge Debates', school: 'Stuyvesant', partner1: 'Georgatos', partner2: 'Miller', points: 17, source: 'reported' },
  { tournament: 'Ridge Debates', school: 'Trinity', partner1: 'Patel', partner2: 'Squires', points: 17, source: 'reported' },
  // finalist -- 21
  { tournament: 'Ridge Debates', school: 'Hunter', partner1: 'Schonfeld', partner2: 'Wan', points: 21, source: 'reported' },
  // champion -- 27
  { tournament: 'Ridge Debates', school: 'Dalton', partner1: 'Gordon', partner2: 'Langdon', points: 27, source: 'reported' },
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
