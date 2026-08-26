/**
 * Reader for the official NPDL rankings spreadsheet.
 *
 * The whole workbook is fetched in one request as
 * `.../export?format=zip`, which yields one HTML file per tab. That is more
 * robust than per-tab `gid` CSV exports, which require knowing gids that change
 * when tabs are reordered.
 */
import { unzipSync } from 'fflate';

export type SheetRow = string[];

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

/** Parses one exported tab into rows of cell text. */
export function parseSheetHtml(html: string): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cells: string[] = [];
    for (const m of tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)) {
      cells.push(decodeEntities(m[1]!.replace(/<[^>]+>/g, '')).replace(/ /g, ' ').trim());
    }
    rows.push(cells);
  }
  return rows;
}

export type Workbook = Map<string, SheetRow[]>;

/** Unpacks an exported workbook zip into tab name -> rows. */
export function parseWorkbook(zip: Uint8Array): Workbook {
  const files = unzipSync(zip);
  const out: Workbook = new Map();
  const decoder = new TextDecoder();
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.endsWith('.html')) continue;
    const tab = path.replace(/\.html$/, '');
    out.set(tab, parseSheetHtml(decoder.decode(bytes)));
  }
  return out;
}

/**
 * Exported tabs carry two header rows: a spreadsheet column ruler (A, B, C...)
 * and then the real headers. This finds the real header row and indexes it.
 */
export function indexHeaders(rows: SheetRow[]): {
  header: SheetRow;
  headerIndex: number;
  col: (name: string) => number;
} {
  let headerIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i] ?? [];
    const isRuler = r.filter(Boolean).every((c) => /^[A-Z]{1,2}$/.test(c));
    if (!isRuler && r.filter(Boolean).length > 1) {
      headerIndex = i;
      break;
    }
  }
  const header = rows[headerIndex] ?? [];
  const lookup = new Map<string, number>();
  header.forEach((h, i) => {
    if (h && !lookup.has(h)) lookup.set(h, i);
  });
  return {
    header,
    headerIndex,
    col: (name: string) => {
      const i = lookup.get(name);
      if (i === undefined) throw new Error(`column not found: ${name}`);
      return i;
    },
  };
}

const pct = (s: string): number | null => {
  const m = s.match(/(-?[\d.]+)\s*%/);
  return m ? Number(m[1]) : null;
};
const int = (s: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * The league's rankings workbook, per season.
 *
 * A new document each year, so this cannot be a constant. Reading last season's
 * sheet for this season is worse than reading none: it reports a full slate of
 * tournaments, every one of them finished and irrelevant, and nothing about the
 * output looks wrong. `sheetIdFor` therefore throws on an unknown season rather
 * than falling back to the most recent one.
 */
export const SHEET_IDS: Record<string, string> = {
  '2025-26': '1oz6E9Bxw7d__DmNWJykS3VcRvJivffX7y_Jqtw7YxcU',
  '2026-27': '1Ro8hjOVL0OApCafrvQtF2F1Tr3Lm_6liz68TDgEM7DE',
};

export function sheetIdFor(season: string): string {
  const id = process.env.SHEET_ID ?? SHEET_IDS[season];
  if (!id) {
    throw new Error(
      `no rankings sheet known for ${season}. Add its document id to SHEET_IDS in ` +
        'packages/ingest/src/sheet.ts, or pass SHEET_ID= for a one-off run. ' +
        "Using another season's sheet would look like it worked.",
    );
  }
  return id;
}

/**
 * Where a season's workbook is cached. Season-scoped, so fetching one season
 * cannot overwrite another's ground truth; the unsuffixed name is honoured for
 * 2025-26, whose cache predates this.
 */
export const LEGACY_SHEET_PATH = 'data/raw/sheet/rankings.zip';

export const sheetPathFor = (season: string): string =>
  `data/raw/sheet/rankings-${season}.zip`;

export interface OfficialTournament {
  row: number;
  name: string;
  tournId: string | null;
  startDate: string;
  endDate: string;
  approval: string;
  category: string;
  openField: number | null;
  njvField: number | null;
  afs: number | null;
  openElimField: number | null;
  prelimCount: number | null;
  breakingRecord: string;
  prelimAdjustment: number | null;
  breakPct: number | null;
  breakPenalty: number | null;
  tocQual: boolean;
}

/** Reads the `Tournaments` tab: per-tournament field sizes and adjustments. */
export function parseTournamentsTab(rows: SheetRow[]): OfficialTournament[] {
  const { headerIndex, col } = indexHeaders(rows);
  const c = {
    name: col('Tournament'),
    start: col('Start Date'),
    end: col('End Date'),
    approval: col('Approval'),
    category: col('Category'),
    results: col('Results'),
    openField: col('Open Field'),
    njv: col('N/JV Field'),
    afs: col('AFS'),
    elim: col('Open Elim Field'),
    prelims: col('Prelim #'),
    breakingRecord: col('Breaking Record'),
    prelimAdj: col('Prelim Adjustment'),
    breakPct: col('Break %'),
    breakPenalty: col('Break % Penalty'),
    tocQual: col('TOC Qual'),
  };
  const at = (r: SheetRow, i: number): string => r[i] ?? '';

  const out: OfficialTournament[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i]!;
    const name = at(r, c.name);
    if (!name) continue;
    out.push({
      row: i,
      name,
      tournId: at(r, c.results).match(/tourn_id=(\d+)/)?.[1] ?? null,
      startDate: at(r, c.start),
      endDate: at(r, c.end),
      approval: at(r, c.approval),
      category: at(r, c.category),
      openField: int(at(r, c.openField)),
      njvField: int(at(r, c.njv)),
      afs: int(at(r, c.afs)),
      openElimField: int(at(r, c.elim)),
      prelimCount: int(at(r, c.prelims)),
      breakingRecord: at(r, c.breakingRecord),
      prelimAdjustment: int(at(r, c.prelimAdj)),
      breakPct: pct(at(r, c.breakPct)),
      breakPenalty: int(at(r, c.breakPenalty)),
      tocQual: at(r, c.tocQual).toUpperCase() === 'TRUE',
    });
  }
  return out;
}

export interface OfficialEntry {
  school1: string;
  school2: string;
  partner1: string;
  partner2: string;
  tournament: string;
  result: string;
  afs: number | null;
  basePoints: number | null;
  walkoverAdjustment: number | null;
  breakPrelimAdjustment: number | null;
  manualAdjustment: number | null;
  calcPoints: number | null;
  hybrid: boolean;
  incorrectTeamSize: boolean;
  tocQual: boolean;
}

/** Reads the `Entry` tab: per-team, per-tournament results and adjustments. */
export function parseEntryTab(rows: SheetRow[]): OfficialEntry[] {
  const { headerIndex, col } = indexHeaders(rows);
  const c = {
    school1: col('school 1'),
    school2: col('school 2 (if hybrid)'),
    p1: col('partner 1'),
    p2: col('partner 2'),
    tournament: col('tournament'),
    result: col('result'),
    afs: col('AFS'),
    base: col('base_points'),
    walkover: col('walkover_adjustment'),
    breakAdj: col('prelim/break percentage adj'),
    manual: col('manual_adj'),
    calc: col('calc_points'),
    hybrid: col('hybrid'),
    size: col('Incorrect Team Size?'),
    toc: col('toc_qual'),
  };
  const at = (r: SheetRow, i: number): string => r[i] ?? '';

  const out: OfficialEntry[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (!at(r, c.school1)) continue;
    out.push({
      school1: at(r, c.school1),
      school2: at(r, c.school2),
      partner1: at(r, c.p1),
      partner2: at(r, c.p2),
      tournament: at(r, c.tournament),
      result: at(r, c.result),
      afs: int(at(r, c.afs)),
      basePoints: int(at(r, c.base)),
      walkoverAdjustment: int(at(r, c.walkover)),
      breakPrelimAdjustment: int(at(r, c.breakAdj)),
      manualAdjustment: int(at(r, c.manual)),
      calcPoints: int(at(r, c.calc)),
      hybrid: at(r, c.hybrid).toUpperCase() === 'TRUE',
      incorrectTeamSize: at(r, c.size).toUpperCase() === 'TRUE',
      tocQual: at(r, c.toc).toUpperCase() === 'TRUE',
    });
  }
  return out;
}
