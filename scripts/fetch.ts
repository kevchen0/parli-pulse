/**
 * Refreshes the cached payloads a season is built from.
 *
 * Three sources, none of them ours: the circuit calendar for what ran, one
 * payload per tournament for the results, and the league's own spreadsheet for
 * the official figures we check ourselves against. Everything lands in
 * `data/raw/`, which is gitignored, so the whole site can be rebuilt offline
 * from a cache and a fresh clone cannot until this has run.
 *
 * The manners here are deliberate. Requests go one at a time with a pause
 * between them, a tournament whose payload is byte-identical is written once
 * and skipped thereafter, and only tournaments inside the correction window are
 * asked for again. Payloads reach 84MB and the endpoint is undocumented and
 * unauthenticated; the cost of carelessness lands on Tabroom, not here.
 *
 *   SEASON=2026-27 npm run fetch          refresh what needs it
 *   SEASON=2026-27 npm run fetch -- --all ignore the window, refetch everything
 *   npm run fetch -- --dry-run            report what would happen
 *
 * Exit code is non-zero only on a failure that leaves the cache inconsistent.
 * A tournament that has published nothing is normal and is reported, not fatal.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  fetchCalendar,
  fetchTournament,
  getText,
  needsRefresh,
  runsParli,
  worthFetching,
  seasonStartYear,
  type CalendarEntry,
} from '../packages/ingest/src/index.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const RAW_DIR = 'data/raw/tabroom';
const SHEET_DIR = 'data/raw/sheet';
/** The league's published rankings workbook, all tabs in one request. */
const SHEET_ID = process.env.SHEET_ID ?? '1oz6E9Bxw7d__DmNWJykS3VcRvJivffX7y_Jqtw7YxcU';
const DELAY_MS = Number(process.env.FETCH_DELAY_MS ?? 1500);

const args = new Set(process.argv.slice(2));
const ALL = args.has('--all');
const DRY = args.has('--dry-run');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
 * not arrive.
 */
async function fetchSheet(): Promise<'changed' | 'unchanged' | 'failed'> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=zip`;
  const path = `${SHEET_DIR}/rankings.zip`;
  try {
    const res = await fetch(url, { headers: { accept: '*/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length < 1024) throw new Error(`suspiciously small response (${body.length} bytes)`);
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

async function refreshTournament(entry: CalendarEntry): Promise<Outcome> {
  const path = `${RAW_DIR}/${entry.tournId}.json`;
  const cached = existsSync(path);
  const base = { tournId: entry.tournId, name: entry.name };

  if (!ALL && !needsRefresh(entry, cached)) {
    return { ...base, status: 'skipped', note: 'outside the correction window' };
  }
  if (DRY) return { ...base, status: cached ? 'changed' : 'new', note: 'dry run' };

  let body: string | null;
  try {
    body = await fetchTournament(entry.tournId, { delayMs: DELAY_MS });
  } catch (err) {
    return { ...base, status: 'failed', note: (err as Error).message };
  }
  if (body === null) return { ...base, status: 'empty', note: 'nothing published' };

  const before = cached ? sha(readFileSync(path, 'utf8')) : null;
  const after = sha(body);
  if (before === after) return { ...base, status: 'unchanged' };

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(path, body);
  return { ...base, status: cached ? 'changed' : 'new' };
}

async function main(): Promise<void> {
  const year = seasonStartYear(SEASON);
  console.log(`fetching ${SEASON} (circuit calendar year ${year})${DRY ? ' -- dry run' : ''}`);

  const calendar = await fetchCalendar(year, { delayMs: DELAY_MS });
  const parli = calendar.filter(worthFetching);
  const advertised = calendar.filter(runsParli).length;
  console.log(
    `  calendar: ${calendar.length} tournaments, ${advertised} advertising a parli division, ` +
      `${parli.length - advertised} not saying`,
  );
  if (parli.length === 0) {
    // A circuit calendar with no parli is not a quiet season, it is a bug, and
    // continuing would clear the cache's reason to exist.
    throw new Error('no parliamentary tournaments on the calendar; refusing to continue');
  }

  const outcomes: Outcome[] = [];
  for (const entry of parli) {
    const outcome = await refreshTournament(entry);
    outcomes.push(outcome);
    const shown = outcome.status === 'skipped' ? '' : `  ${entry.name}`;
    if (outcome.status !== 'skipped') {
      console.log(
        `  ${outcome.status.padEnd(9)} ${entry.tournId.padEnd(6)}${shown}` +
          `${outcome.note ? ` (${outcome.note})` : ''}`,
      );
    }
    // Only pause after a request that actually went out.
    if (!DRY && outcome.status !== 'skipped') await sleep(DELAY_MS);
  }

  const sheet = await fetchSheet();
  console.log(`  sheet:    ${sheet}`);

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

  // A failure means the cache no longer reflects the season, which a scheduled
  // run must surface rather than swallow.
  if (count('failed') > 0 || sheet === 'failed') process.exitCode = 1;
}

await main();
