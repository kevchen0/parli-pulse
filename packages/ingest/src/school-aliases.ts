/**
 * Index of alternate registrations to the school the league credits.
 *
 * Debaters frequently enter under something other than their school: a private
 * academy or club ("Lucent Debate Academy" for Campolindo), a program-specific
 * registration ("Rodda's Disciples" for Stuyvesant), or a school-adjacent
 * independent entry ("Piedmont Independent"). Without this index one program's
 * season splits across several rows, and the school rankings understate it --
 * Stuyvesant lost roughly 90 points that way before this existed.
 *
 * Seeded from the 2025-26 data by `scripts/probe/discover-aliases.ts`, which
 * compares the school Tabroom recorded against the school the league credited
 * on the same result. Hybrid entries are excluded from that comparison: they
 * are filed under one partner's school in Tabroom and the other's in the
 * sheet, which looks identical to an alias but is not one.
 *
 * This file is meant to be edited by hand. The discovery script only sees
 * affiliations that actually appeared in a scored result, so anything new or
 * rare has to be added here.
 */

/** Alternate registration name -> the school it should be credited to. */
export const SCHOOL_ALIASES: Record<string, string> = {
  // Clubs and academies operating alongside a school program.
  "Rodda's Disciples": 'Stuyvesant High School',
  'Horace Mann Parliamentary Debate': 'Horace Mann School',
  'Papaya Valley': 'Evergreen Valley High School',
  'Blind Brook Debate Team': 'Blind Brook High School',
  'Brooklyn Technical High School Parliamentary Debate Team': 'Brooklyn Technical High School',
  'Heritage High Speech and Debate Club': 'Heritage High School',
  'Lucent Debate Academy': 'Campolindo High School',
  'Ivy Debate': 'Del Norte High School (San Diego)',
  'BOW Debate': 'Amity Regional High School',
  Bright: 'Del Norte High School (San Diego)',
  Bearden: 'Berkeley High School',

  // School-adjacent independent registrations.
  'EV Independent': 'Evergreen Valley High School',
  'Evergreen Valley Independent': 'Evergreen Valley High School',
  'Gunn High School Independent': 'Henry M. Gunn Senior High School',
  'Hopkins Independent': 'Hopkins School',
  'Manhattan Independent': 'Manhattan Village Academy',
  'Nest Independent': 'New Explorations into Science, Technology and Math High School',
  'Piedmont Independent': 'Piedmont High School',
  'Princeton Independent': 'Princeton High School',
  'Stuyvesant Independent': 'Stuyvesant High School',

  // Naming variants rather than separate registrations.
  'Gunn Sr High School': 'Henry M. Gunn Senior High School',
  'Lake Oswego Senior High School': 'Lake Oswego High School',
  'South High School': 'South High School (Torrance)',
  'The Webb Schools': 'Webb',
  'University High School Charter': 'University High School',
};

/**
 * Cases the discovery script could not settle, listed so they are not silently
 * dropped. Each needs someone who knows the circuit to confirm it.
 *
 *  - "Westfield" was credited once to Hopkins School and once to Watkinson
 *    School, so it is probably not one program at all.
 *  - "Flintridge Sacred Heart Academy" was credited once to Flintridge
 *    Preparatory School. They are genuinely different schools, so that single
 *    row looks like a data-entry slip rather than an affiliation.
 */
export const SCHOOL_ALIASES_UNRESOLVED = [
  'Westfield',
  'Flintridge Sacred Heart Academy',
] as const;
