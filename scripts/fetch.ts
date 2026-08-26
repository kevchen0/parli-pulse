/**
 * Refreshes the cached payloads a season is built from.
 *
 * **The league's spreadsheet decides what exists.** Its `Tournaments` tab has a
 * `Results` column holding a Tabroom URL, filled in as each tournament is
 * written up, and the id in that URL is the only thing `load.ts` will accept:
 * no sheet row, no link, no load, whatever happens to be sitting in the cache.
 * So discovery reads the sheet, and this fetches exactly what the sheet points
 * at.
 *
 * The circuit calendar is *not* used for discovery, though it looks like it
 * should be. Measured against 2025-26: the sheet's Results column yields 95
 * tournaments and the calendar yields 44, of which this would have fetched 37 --
 * missing 58 of the 95, including Jack Howe, Yale, Sid Fox, La Costa Canyon and
 * Ridge Debates. Circuit 179 only lists tournaments that registered themselves
 * with it, which most parli tournaments never do. It is kept as a lookahead,
 * reported at the end, because it does say what is coming before the league
 * writes it up.
 *
 * The manners are deliberate. One request at a time with a pause between,
 * payloads written only when their content hash moves, and tournaments
 * re-fetched only inside the correction window. The endpoint is undocumented and
 * unauthenticated and payloads reach 84MB.
 *
 *   SEASON=2026-27 npm run fetch            refresh what needs it
 *   SEASON=2026-27 npm run fetch -- --all   ignore the window, refetch everything
 *   npm run fetch -- --dry-run              report what would happen
 *
 * Exit code is non-zero only where the cache is left inconsistent. A tournament
 * that has published nothing is normal and is reported, not fatal.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  type OfficialTournament,
  fetchCalendar,
  fetchTournament,
  needsRefresh,
  LEGACY_SHEET_PATH,
  parseTournamentsTab,
  parseWorkbook,
  seasonStartYear,
  sheetIdFor,
  sheetPathFor,
} from '../packages/ingest/src/index.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const RAW_DIR = 'data/raw/tabroom';
const SHEET_DIR = 'data/raw/sheet';
const DELAY_MS = Number(process.env.FETCH_DELAY_MS ?? 1500);

const args = new Set(process.argv.slice(2));
const ALL = args.has('--all');
const DRY = args.has('--dry-run');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The sheet writes dates as `MM/DD/YY`, which `Date.parse` reads as American
 * where it reads them at all. Converted explicitly rather than guessed at, and
 * anything unrecognised returns null so the caller re-fetches rather than
 * assuming a tournament is old enough to ignore.
 */
function isoDate(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(value.trim());
  if (!m) return null;
  const [, mm, dd, yy] = m;
  const year = Number(yy) < 100 ? 2000 + Number(yy) : Number(yy);
  const iso = `${year}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  return Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) ? iso : null;
}

interface Outcome {
  tournId: string;
  name: string;
  status: 'new' | 'changed' | 'unchanged' | 'empty' | 'skipped' | 'failed';
  note?: string;
}

/**
 * The spreadsheet, as a zip of one HTML file per tab.
 *
 * Requested whole rather than tab by tab: per-tab ids change when someone
 * reorders the workbook, and a single archive either arrives complete or does
 * not arrive at all.
 */
async function fetchSheet(path: string): Promise<'changed' | 'unchanged' | 'failed'> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetIdFor(SEASON)}/export?format=zip`;
  try {
    const res = await fetch(url, { headers: { accept: '*/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    // A short body is an error page, and writing it over the cache would take
    // the season's ground truth with it.
    if (body.length < 10_000) throw new Error(`suspiciously small response (${body.length} bytes)`);
    if (body.subarray(0, 2).toString() !== 'PK') throw new Error('response was not a zip');
    const before = existsSync(path) ? sha(readFileSync(path).toString('base64')) : null;
    const after = sha(body.toString('base64'));
    if (before === after) return 'unchanged';
    if (!DRY) {
      mkdirSync(SHEET_DIR, { recursive: true });
      writeFileSync(path, body);
    }
    return 'changed';
  } catch (err) {
    console.error(`  sheet: ${(err as Error).message}`);
    return 'failed';
  }
}

async function refreshTournament(t: OfficialTournament & { tournId: string }): Promise<Outcome> {
  const path = `${RAW_DIR}/${t.tournId}.json`;
  const cached = existsSync(path);
  const base = { tournId: t.tournId, name: t.name };
  const endsOn = isoDate(t.endDate) ?? isoDate(t.startDate);

  if (!ALL && !needsRefresh({ endsOn }, cached)) {
    return { ...base, status: 'skipped' };
  }
  if (DRY) return { ...base, status: cached ? 'changed' : 'new', note: 'dry run' };

  let body: string | null;
  try {
    body = await fetchTournament(t.tournId, { delayMs: DELAY_MS });
  } catch (err) {
    return { ...base, status: 'failed', note: (err as Error).message };
  }
  if (body === null) return { ...base, status: 'empty', note: 'nothing published' };

  const before = cached ? sha(readFileSync(path, 'utf8')) : null;
  if (before === sha(body)) return { ...base, status: 'unchanged' };

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(path, body);
  return { ...base, status: cached ? 'changed' : 'new' };
}

/** What the circuit knows about that the sheet has not written up yet. */
async function reportLookahead(known: ReadonlySet<string>): Promise<void> {
  try {
    const cal = await fetchCalendar(seasonStartYear(SEASON), { delayMs: DELAY_MS });
    const ahead = cal.filter((c) => !known.has(c.tournId));
    if (ahead.length === 0) return;
    console.log(`\non the circuit calendar, not yet in the sheet (${ahead.length}):`);
    for (const c of ahead.slice(0, 12)) {
      console.log(`  ${c.tournId.padEnd(6)} ${(c.startsOn ?? '????-??-??')}  ${c.name}`);
    }
    if (ahead.length > 12) console.log(`  ... and ${ahead.length - 12} more`);
  } catch (err) {
    // Informational only; it must never fail the run.
    console.log(`\nlookahead unavailable: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  console.log(`fetching ${SEASON}${DRY ? ' -- dry run' : ''}`);

  // The sheet comes first: it is what decides which tournaments exist. The
  // unsuffixed filename is honoured for 2025-26, whose cache predates seasons
  // having their own.
  const seasonPath = sheetPathFor(SEASON);
  const cachedPath = existsSync(seasonPath)
    ? seasonPath
    : SEASON === '2025-26' && existsSync(LEGACY_SHEET_PATH)
      ? LEGACY_SHEET_PATH
      : seasonPath;

  const sheet = await fetchSheet(seasonPath);
  if (sheet === 'failed' && !existsSync(cachedPath)) {
    throw new Error('no rankings sheet, cached or fetched; cannot tell which tournaments exist');
  }
  if (sheet === 'failed') console.log('  sheet: using the cached copy');
  else console.log(`  sheet: ${sheet}`);

  const readFrom = existsSync(seasonPath) ? seasonPath : cachedPath;
  const workbook = parseWorkbook(new Uint8Array(readFileSync(readFrom)));
  const tab = workbook.get('Tournaments');
  if (!tab) throw new Error('the workbook has no Tournaments tab');

  const rows = parseTournamentsTab(tab);
  const linked = rows.filter((r): r is OfficialTournament & { tournId: string } => Boolean(r.tournId));
  const unlinked = rows.length - linked.length;
  console.log(
    `  sheet lists ${rows.length} tournaments, ${linked.length} with a results link` +
      `${unlinked ? `, ${unlinked} awaiting one` : ''}`,
  );
  if (linked.length === 0) {
    console.log('\nNothing to fetch yet. Tournaments appear here as the league posts results links.');
    return;
  }

  const outcomes: Outcome[] = [];
  for (const t of linked) {
    const outcome = await refreshTournament(t);
    outcomes.push(outcome);
    if (outcome.status !== 'skipped') {
      console.log(
        `  ${outcome.status.padEnd(9)} ${outcome.tournId.padEnd(6)}  ${outcome.name}` +
          `${outcome.note ? ` (${outcome.note})` : ''}`,
      );
      if (!DRY) await sleep(DELAY_MS);
    }
  }

  const count = (s: Outcome['status']) => outcomes.filter((o) => o.status === s).length;
  const moved = count('new') + count('changed');
  console.log(
    `\n${moved} payload${moved === 1 ? '' : 's'} written ` +
      `(${count('new')} new, ${count('changed')} changed), ${count('unchanged')} unchanged, ` +
      `${count('skipped')} outside the window, ${count('empty')} published nothing, ` +
      `${count('failed')} failed`,
  );
  if (moved > 0 || sheet === 'changed') {
    console.log('run `npm run load` to rebuild the season from the cache');
  }

  await reportLookahead(new Set(linked.map((t) => t.tournId)));

  // A failure means the cache no longer reflects the season, which a scheduled
  // run must surface rather than swallow.
  if (count('failed') > 0) process.exitCode = 1;
}

await main();
