/**
 * Shapes returned by Tabroom's bulk tournament export:
 *   GET https://www.tabroom.com/api/download_data.mhtml?tourn_id=<N>
 *
 * The endpoint is undocumented and unauthenticated. These types cover the
 * fields we rely on; the payload carries considerably more. Numeric ids arrive
 * inconsistently as strings or numbers depending on the field and the
 * tournament, so everything id-shaped is typed loosely and normalized on read.
 */

export type TabroomId = string | number;

export interface TabroomScore {
  tag?: string;
  value?: string | number;
  id?: TabroomId;
}

export interface TabroomBallot {
  id?: TabroomId;
  entry?: TabroomId;
  side?: string | number;
  /** Judge record for this tournament. */
  judge?: TabroomId;
  /** Stable person id, shared across tournaments. Prefer this for identity. */
  judge_person?: TabroomId;
  judge_first?: string;
  judge_last?: string;
  entry_code?: string;
  entry_name?: string;
  panel?: TabroomId;
  scores?: TabroomScore[];
}

export interface TabroomSection {
  id?: TabroomId;
  letter?: string;
  flight?: string | number;
  round?: TabroomId;
  room?: string;
  ballots?: TabroomBallot[];
}

export interface TabroomRound {
  id?: TabroomId;
  /** Usually the round number, but tournaments do use labels. */
  name?: string | number;
  /** 'prelim' | 'highlow' | 'elim' | 'final' and other tab-specific values. */
  type?: string;
  protocol_name?: string;
  start_time?: string;
  flights?: number;
  sections?: TabroomSection[];
}

export interface TabroomResultValue {
  result_key?: TabroomId;
  protocol?: TabroomId;
  priority?: number;
  value?: string | number;
}

export interface TabroomResult {
  entry?: TabroomId;
  rank?: string | number;
  place?: string;
  percentile?: string;
  round?: TabroomId;
  values?: TabroomResultValue[];
}

export interface TabroomResultKey {
  id?: TabroomId;
  tag?: string;
  description?: string;
  sort_desc?: string | number | null;
  no_sort?: string | number | null;
}

export interface TabroomResultSet {
  label?: string;
  /** 'seed' | 'bracket' | 'final' and others. */
  tag?: string;
  bracket?: string | number;
  published?: string | number;
  generated?: string;
  result_keys?: TabroomResultKey[];
  results?: TabroomResult[];
}

export interface TabroomEvent {
  id?: TabroomId;
  name?: string;
  abbr?: string;
  type?: string;
  rounds?: TabroomRound[];
  result_sets?: TabroomResultSet[];
}

export interface TabroomCategory {
  id?: TabroomId;
  name?: string;
  abbr?: string;
  events?: TabroomEvent[];
}

export interface TabroomEntry {
  id?: TabroomId;
  code?: string;
  name?: string;
  event?: TabroomId;
  school?: TabroomId;
  /** Student ids; length is the two-person test of XXI.1.G. */
  students?: TabroomId[];
  hybrid?: string | number | null;
  dropped?: string | number;
  active?: string | number;
  waitlist?: string | number;
  unconfirmed?: string | number;
}

export interface TabroomStudent {
  id?: TabroomId;
  chapter?: TabroomId;
  first?: string;
  last?: string;
}

export interface TabroomSchool {
  id?: TabroomId;
  /** Persistent program id across seasons; `id` is per-tournament. */
  chapter?: TabroomId;
  name?: string;
  code?: string;
  entries?: TabroomEntry[];
  students?: TabroomStudent[];
}

export interface TabroomTournament {
  id?: TabroomId;
  name?: string;
  webname?: string;
  start?: string;
  end?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  public?: string | number;
  hidden?: string | number;
  categories?: TabroomCategory[];
  schools?: TabroomSchool[];
}
