/**
 * Shared season computation for the backtests: score every entry we can match
 * to a row in the official sheet, and expose the results keyed both by
 * tournament and by partnership.
 *
 * Partnership identity comes from the *sheet* side (school + surname pair)
 * rather than ours, so linking a team across tournaments does not also depend
 * on reconciling Tabroom's school-name variants.
 */
import { existsSync, readFileSync } from 'node:fs';
import { scoreEntry, scoreToc, type ElimLevel } from '../../packages/rules/src/index.ts';
import {
  buildStudentIndex,
  computeEntryPerformances,
  computeFieldStats,
  normalizeTournament,
} from '../../packages/ingest/src/normalize.ts';
import {
  parseEntryTab,
  parseTournamentsTab,
  parseWorkbook,
  type OfficialEntry,
  type OfficialTournament,
  type SheetRow,
} from '../../packages/ingest/src/sheet.ts';

export const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/^[a-z]\.\s*/, '').replace(/[^a-z]/g, '');

export const pairKey = (a: string, b: string): string => [norm(a), norm(b)].sort().join('|');

/** Season-stable identity for a partnership: school plus its surname pair. */
export const teamKey = (school: string, a: string, b: string): string =>
  `${norm(school)}::${pairKey(a, b)}`;

export interface EntryCase {
  tournament: string;
  category: string;
  tournId: string;
  school: string;
  team: string;
  pair: string;
  ours: number;
  theirs: number;
  matched: boolean;
  broke: boolean;
  hybrid: boolean;
  ourBase: number | null;
  theirBase: number | null;
  ourAdj: number;
  theirAdj: number | null;
}

export interface SeasonResult {
  cases: EntryCase[];
  /** Sheet rows we could not tie to a Tabroom entry. */
  unmatched: { tournament: string; team: string }[];
  /** Sheet tournaments with no usable Tabroom payload. */
  skippedTournaments: string[];
  workbook: Map<string, SheetRow[]>;
  officialTournaments: OfficialTournament[];
  officialEntries: OfficialEntry[];
}

const parseRecord = (s: string): { wins: number; losses: number } | undefined => {
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  return m ? { wins: Number(m[1]), losses: Number(m[2]) } : undefined;
};

export function computeSeason(zipPath = 'data/raw/sheet/rankings.zip'): SeasonResult {
  const workbook = parseWorkbook(new Uint8Array(readFileSync(zipPath)));
  const officialTournaments = parseTournamentsTab(workbook.get('Tournaments')!);
  const officialEntries = parseEntryTab(workbook.get('Entry')!);

  const cases: EntryCase[] = [];
  const unmatched: { tournament: string; team: string }[] = [];
  const skippedTournaments: string[] = [];

  for (const off of officialTournaments) {
    const sheetRows = officialEntries.filter((e) => e.tournament === off.name);
    if (!sheetRows.length) continue;
    const path = off.tournId ? `data/raw/tabroom/${off.tournId}.json` : '';
    if (!path || !existsSync(path)) { skippedTournaments.push(off.name); continue; }

    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const t = normalizeTournament(raw);
    const students = buildStudentIndex(raw);
    const opens = t.events.filter(
      (e) => e.isParli && e.division === 'open' && !computeFieldStats(e).phantom,
    );
    if (!opens.length) { skippedTournaments.push(off.name); continue; }

    // Use the sheet's published field figures so a points mismatch is never
    // just a field-size mismatch wearing a disguise.
    const stats = opens.map(computeFieldStats);
    const openField = off.openField ?? stats.reduce((a, s) => a + s.fieldSize, 0);
    const afs = off.afs ?? openField;
    const elimField = off.openElimField ?? stats.reduce((a, s) => a + s.elimField, 0);
    const breakPct = off.breakPct ?? (openField ? (100 * elimField) / openField : 0);
    const prelimCount = off.prelimCount ?? Math.max(...stats.map((s) => s.prelimCount));
    const ctx = { afs, breakPct, prelimCount, breakingRecord: parseRecord(off.breakingRecord) };

    interface Mine {
      wins: number; losses: number; elimLevel: ElimLevel | null;
      size: boolean; prelimBallotsWon: number; elimWins: number;
    }
    const ours = new Map<string, Mine>();
    for (const ev of opens) {
      const perf = computeEntryPerformances(ev);
      const ballotsWon = new Map<string, number>();
      for (const r of ev.rounds) {
        if (!r.isPrelim) continue;
        for (const sec of r.sections) {
          for (const b of sec.ballots) {
            if (b.entryId && b.won === true) ballotsWon.set(b.entryId, (ballotsWon.get(b.entryId) ?? 0) + 1);
          }
        }
      }
      for (const [entryId, entry] of ev.entries) {
        const names = entry.studentIds.map((s) => students.get(s)?.last ?? '').filter(Boolean);
        if (names.length !== 2) continue;
        const p = perf.get(entryId)!;
        const elimRoundWins = ev.rounds.filter((r) => r.isElim).filter((r) =>
          r.sections.some((sec) => {
            const mineB = sec.ballots.filter((b) => b.entryId === entryId);
            return mineB.length > 0 && mineB.filter((b) => b.won === true).length * 2 > mineB.length;
          }),
        ).length;
        ours.set(pairKey(names[0]!, names[1]!), {
          wins: p.wins, losses: p.losses, elimLevel: p.elimLevel,
          size: entry.eligibleTeamSize,
          prelimBallotsWon: ballotsWon.get(entryId) ?? 0,
          elimWins: elimRoundWins,
        });
      }
    }

    for (const row of sheetRows) {
      const key = pairKey(row.partner1, row.partner2);
      const team = teamKey(row.school1, row.partner1, row.partner2);
      const mine = ours.get(key);
      if (!mine) { unmatched.push({ tournament: off.name, team }); continue; }

      const isQualifier = (off.category === 'CHSSA' || off.category === 'OSAA')
        ? ({ qual: 8, alt: 4 } as Record<string, number>)[row.result.toLowerCase()]
        : undefined;
      const isToc = /NPDL-TOC/i.test(off.name);
      const sb = isQualifier !== undefined
        ? { points: isQualifier, basePoints: isQualifier, prelimCountAdjustment: 0, breakPenalty: 0,
            walkoverAdjustment: 0, floorApplied: 'none' as const, excluded: null, broke: false }
        : isToc
          ? scoreToc({
              prelimBallotsWon: mine.prelimBallotsWon,
              broke: mine.elimLevel !== null,
              elimWins: mine.elimWins,
              champion: mine.elimLevel === 'first',
            }, breakPct)
          : scoreEntry({
              wins: mine.wins, losses: mine.losses, elimLevel: mine.elimLevel,
              eligibleTeamSize: mine.size, walkoverAdjustment: row.walkoverAdjustment ?? 0,
            }, ctx);

      cases.push({
        tournament: off.name,
        category: off.category || '(none)',
        tournId: off.tournId!,
        school: row.school1,
        team,
        pair: key,
        ours: sb.points,
        theirs: row.calcPoints ?? 0,
        matched: sb.points === (row.calcPoints ?? 0),
        broke: mine.elimLevel !== null,
        hybrid: row.hybrid,
        ourBase: sb.basePoints,
        theirBase: row.basePoints,
        ourAdj: sb.prelimCountAdjustment + sb.breakPenalty,
        theirAdj: row.breakPrelimAdjustment,
      });
    }
  }

  return { cases, unmatched, skippedTournaments, workbook, officialTournaments, officialEntries };
}
