/**
 * The Tabroom side of ingestion: which tournaments exist, and their results.
 *
 * Two undocumented, unauthenticated endpoints. That imposes the manners in this
 * file rather than any rate limit telling us to: requests go one at a time with
 * a pause between them, failures back off rather than retrying immediately, and
 * a tournament whose payload has not changed is never asked for twice. Payloads
 * reach 84MB, so the cost of being careless lands on someone else's server.
 *
 *   calendar.mhtml?circuit_id=179&year=<start year>   what ran, and when
 *   download_data.mhtml?tourn_id=<id>                 everything about one
 *
 * The calendar is HTML and is parsed with regular expressions, which is fragile
 * by nature. `parseCalendar` therefore throws when it finds no rows at all: a
 * markup change should stop the pipeline and be fixed, not quietly produce an
 * empty season that looks like a quiet week.
 */

/** NPDL's circuit on Tabroom. */
export const NPDL_CIRCUIT_ID = 179;

const BASE = 'https://www.tabroom.com';

/**
 * Identifies the project to whoever reads the logs. An unauthenticated scraper
 * that will not say what it is deserves to be blocked.
 */
export const USER_AGENT =
  'parli-pulse/0.1 (NPDL rankings mirror; +https://github.com/kevchen0/parli-pulse)';

export interface CalendarEntry {
  tournId: string;
  name: string;
  location: string | null;
  /** ISO date, from the row's machine-readable attribute rather than its text. */
  startsOn: string | null;
  endsOn: string | null;
  /** Event abbreviations the tournament advertised, e.g. ['Parli', 'VLD']. */
  events: string[];
}

/**
 * Does this tournament advertise a parliamentary division?
 *
 * The circuit spells it several ways -- `Parli`, `NParli` and `OParli` for
 * novice and open, `PAR` at the Cal Invitational, `NPDA` at college-run events.
 * Matching a bare `PF` would be wrong: that is Public Forum.
 */
export const runsParli = (e: CalendarEntry): boolean =>
  e.events.some((x) => /parli/i.test(x) || /^par[no]?$/i.test(x.trim()) || /^npda$/i.test(x.trim()));

/**
 * Event codes that are definitely not parliamentary. Used only to decide
 * whether a list is informative: a tournament advertising nothing but Lincoln-
 * Douglas and Public Forum can be skipped, and one advertising "Novice, Open"
 * has told us its divisions rather than its events and cannot be.
 */
const KNOWN_NON_PARLI =
  /^(j?v?ld|ld[nmof]{2}|[jvmns]*pf[nof]*|cx[no]?|[nots]cx|di[no]?|duo[no]?|ext[no]?|hi[no]?|imp[no]?|info{1,2}[no]?|oo[no]?|poi[no]?|[hm]?con[no]?|dec[no]?|ws?d|opp[no]?|congress|ie|speech)$/i;

/**
 * Should the payload be fetched?
 *
 * A tournament that lists no events has not said either way -- registration may
 * not have opened -- and it is on NPDL's own circuit calendar, so the default is
 * to fetch. A missed tournament is a hole in the season that nobody notices
 * until the standings are wrong; a wasted request is a wasted request.
 */
export const worthFetching = (e: CalendarEntry): boolean => {
  if (runsParli(e)) return true;
  // Nothing recognisable means the list describes divisions, not events, and
  // says nothing about whether parli ran.
  return !e.events.some((x) => KNOWN_NON_PARLI.test(x.trim()));
};

const stripTags = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&ndash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Reads the circuit calendar.
 *
 * The date cell carries `data-text="YYYY-MM-DD HH:MM:SS"`, which is taken in
 * preference to the human text beside it -- "Sat Sep 5-6, 2026" needs a parser
 * and a guess about the year at a season boundary, and the attribute needs
 * neither. The end date is recovered from the display range, since only the
 * start has an attribute.
 */
export function parseCalendar(html: string): CalendarEntry[] {
  const rows = html.split(/<tr[\s>]/i).slice(1);
  const out: CalendarEntry[] = [];

  for (const row of rows) {
    const link = /href="[^"]*tourn_id=(\d+)"[^>]*>([\s\S]*?)<\/a>/i.exec(row);
    if (!link) continue;
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 3) continue;

    // Cells are identified by position relative to the date, not by what they
    // contain. The events cell was previously found by looking for known event
    // names in it, which missed "NParli, OParli" -- the novice and open
    // divisions at a tournament called Cal Parli Invitational.
    const dateIndex = cells.findIndex((c) => /data-text="\d{4}-\d{2}-\d{2}/.test(c[1]!));
    const dateCell = dateIndex >= 0 ? cells[dateIndex] : undefined;
    const startsOn = dateCell
      ? /data-text="(\d{4}-\d{2}-\d{2})/.exec(dateCell[1]!)?.[1] ?? null
      : null;
    const isPlain = (i: number) =>
      i >= 0 && i < cells.length && !/data-text=/.test(cells[i]![1]!);

    // "Sat Sep 5-6, 2026" -> the 6th. A single-day tournament ends when it starts.
    let endsOn = startsOn;
    if (startsOn && dateCell) {
      const span = /(\d{1,2})\s*-\s*(\d{1,2}),/.exec(stripTags(dateCell[2]!));
      if (span) {
        const last = Number(span[2]);
        const first = Number(span[1]);
        const d = new Date(`${startsOn}T00:00:00Z`);
        // A range crossing a month boundary counts forward from the start rather
        // than substituting a day number the month may not have.
        d.setUTCDate(d.getUTCDate() + (last >= first ? last - first : 1));
        endsOn = d.toISOString().slice(0, 10);
      }
    }

    const text = cells.map((c) => stripTags(c[2]!));
    // Location sits immediately before the date, events immediately after.
    const location = isPlain(dateIndex - 1) ? text[dateIndex - 1] ?? null : null;
    const eventCell = isPlain(dateIndex + 1) ? text[dateIndex + 1] ?? '' : '';

    out.push({
      tournId: link[1]!,
      name: stripTags(link[2]!),
      location: location && location !== '' ? location : null,
      startsOn,
      endsOn,
      events: eventCell.split(',').map((s) => s.trim()).filter(Boolean),
    });
  }

  if (out.length === 0) {
    throw new Error('circuit calendar produced no rows; the page markup has probably changed');
  }
  return out;
}

export interface FetchOptions {
  /** Milliseconds between requests. The endpoint is nobody's public API. */
  delayMs?: number;
  /** Attempts per URL before giving up, doubling the wait each time. */
  attempts?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One request, with backoff. Retries a transport failure or a 5xx; a 404 is an
 * answer rather than an error and is returned as null.
 */
export async function getText(url: string, options: FetchOptions = {}): Promise<string | null> {
  const attempts = options.attempts ?? 4;
  let wait = 2000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
        signal: options.signal ?? null,
      });
      if (res.status === 404) return null;
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`HTTP ${res.status}`);
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      } else {
        return await res.text();
      }
    } catch (err) {
      if (options.signal?.aborted) throw err;
      lastError = err;
    }
    if (attempt < attempts - 1) {
      await sleep(wait);
      wait *= 2;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`failed to fetch ${url}`);
}

/** The circuit's tournaments for a season, keyed by its starting year. */
export async function fetchCalendar(
  startYear: number,
  options: FetchOptions = {},
): Promise<CalendarEntry[]> {
  const url = `${BASE}/index/circuit/calendar.mhtml?circuit_id=${NPDL_CIRCUIT_ID}&year=${startYear}`;
  const html = await getText(url, options);
  if (html === null) throw new Error(`circuit calendar returned 404 for year ${startYear}`);
  return parseCalendar(html);
}

/**
 * One tournament's full published data. Returns null where the tournament
 * exists but has published nothing, which is common enough not to be an error.
 */
export async function fetchTournament(
  tournId: string,
  options: FetchOptions = {},
): Promise<string | null> {
  const body = await getText(`${BASE}/api/download_data.mhtml?tourn_id=${tournId}`, options);
  if (body === null) return null;
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return null;
  return trimmed;
}

/** "2026-27" -> 2026, the year the calendar is keyed by. */
export function seasonStartYear(season: string): number {
  const year = Number(season.slice(0, 4));
  if (!Number.isFinite(year)) throw new Error(`unrecognised season label: ${season}`);
  return year;
}

/**
 * Should this tournament be re-fetched?
 *
 * Results are corrected for about thirty days after a tournament, and tab staff
 * fix things later than that. Forty-five days of slack covers it; beyond that a
 * tournament is finished and re-reading an 84MB payload teaches nothing.
 */
export function needsRefresh(
  entry: Pick<CalendarEntry, 'endsOn'>,
  cached: boolean,
  today = new Date(),
  windowDays = 45,
): boolean {
  if (!cached) return true;
  if (!entry.endsOn) return true;
  const ended = Date.parse(`${entry.endsOn}T00:00:00Z`);
  if (!Number.isFinite(ended)) return true;
  const days = (today.getTime() - ended) / 86_400_000;
  // A tournament that has not happened yet is worth watching; one long finished
  // is not.
  return days <= windowDays;
}
