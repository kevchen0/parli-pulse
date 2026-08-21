/**
 * Loads a season into Postgres: normalized Tabroom data, the league's own
 * published figures, our Article XXI computation, and the disagreements
 * between the two.
 *
 * Rebuilds the season rather than merging into it. Deleting the season's
 * tournaments cascades through events, rounds, ballots and entries, so a
 * reload always reflects the current engine instead of leaving stale rows from
 * an older one behind.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import {
  buildSchoolIndex,
  buildStudentIndex,
  computeEntryPerformances,
  computeFieldStats,
  normalizeTournament,
  partitionElimRounds,
  parseTournamentsTab,
  parseWorkbook,
  type NormalizedEvent,
} from '../packages/ingest/src/index.ts';
import { computeSeason } from './lib/season.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const RAW_DIR = 'data/raw/tabroom';
const SHEET = 'data/raw/sheet/rankings.zip';

/** Postgres caps bound parameters per statement; insert in slices. */
async function insertAll<T extends Record<string, unknown>>(
  db: ReturnType<typeof createDb>['db'],
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  label: string,
): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]!).length || 1;
  const chunk = Math.max(1, Math.floor(60000 / columns));
  for (let i = 0; i < rows.length; i += chunk) {
    await db.insert(table).values(rows.slice(i, i + chunk) as never).onConflictDoNothing();
  }
  console.log(`  ${label.padEnd(26)} ${rows.length}`);
}

const divisionOf = (d: string): typeof t.divisionEnum.enumValues[number] =>
  (['open', 'jv', 'novice', 'middle', 'unknown'] as const).includes(d as never)
    ? (d as typeof t.divisionEnum.enumValues[number])
    : 'unknown';

async function main(): Promise<void> {
  const { db, close } = createDb();
  try {
    console.log(`loading season ${SEASON}\n`);

    const wb = parseWorkbook(new Uint8Array(readFileSync(SHEET)));
    const officialTournaments = parseTournamentsTab(wb.get('Tournaments')!);
    const schoolIndex = buildSchoolIndex(wb.get('SchoolList')!);

    // Scoring and sheet matching share the engine used by the backtests, so
    // what lands in the database is exactly what the reports measure.
    const season = computeSeason(SHEET);
    const caseByEntry = new Map(season.cases.map((c) => [c.entryId, c]));

    await db.insert(t.seasons).values({
      id: SEASON, startsOn: `${SEASON.slice(0, 4)}-08-01`,
      endsOn: `20${SEASON.slice(5)}-07-31`, archival: false,
    }).onConflictDoNothing();

    const existing = await db.select({ id: t.tournaments.id })
      .from(t.tournaments).where(eq(t.tournaments.seasonId, SEASON));
    if (existing.length) {
      console.log(`clearing ${existing.length} existing tournaments for ${SEASON}`);
      await db.delete(t.tournaments).where(eq(t.tournaments.seasonId, SEASON));
    }

    const cached = new Set(readdirSync(RAW_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));

    const rows = {
      tournaments: [] as Record<string, unknown>[],
      events: [] as Record<string, unknown>[],
      entries: [] as Record<string, unknown>[],
      entryDebaters: [] as Record<string, unknown>[],
      rounds: [] as Record<string, unknown>[],
      ballots: [] as Record<string, unknown>[],
      speakerScores: [] as Record<string, unknown>[],
      fieldStats: [] as Record<string, unknown>[],
      entryResults: [] as Record<string, unknown>[],
      officialStats: [] as Record<string, unknown>[],
      disagreements: [] as Record<string, unknown>[],
    };
    const debaters = new Map<string, Record<string, unknown>>();
    const judges = new Map<string, Record<string, unknown>>();
    const seenEntries = new Set<string>();

    for (const off of officialTournaments) {
      if (!off.tournId || !cached.has(off.tournId)) continue;
      const path = `${RAW_DIR}/${off.tournId}.json`;
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      const raw = JSON.parse(buf.toString('utf8'));
      const norm = normalizeTournament(raw);
      const students = buildStudentIndex(raw);

      rows.tournaments.push({
        id: off.tournId, seasonId: SEASON, tabroomId: off.tournId,
        name: norm.name, officialName: off.name,
        startsOn: norm.start?.slice(0, 10) ?? null, endsOn: norm.end?.slice(0, 10) ?? null,
        location: off.category === 'CHSSA' ? null : null,
        category: off.category || null, approval: off.approval || null,
        payloadHash: createHash('sha256').update(buf).digest('hex').slice(0, 32),
        fetchedAt: new Date(),
      });

      rows.officialStats.push({
        tournamentId: off.tournId, openField: off.openField, njvField: off.njvField,
        adjustedFieldSize: off.afs, openElimField: off.openElimField,
        prelimCount: off.prelimCount, breakingRecord: off.breakingRecord || null,
        prelimAdjustment: off.prelimAdjustment, breakPct: off.breakPct,
        breakPenalty: off.breakPenalty,
      });

      for (const ev of norm.events) {
        if (!ev.isParli) continue;
        const stats = computeFieldStats(ev);
        rows.events.push({
          id: ev.eventId, tournamentId: off.tournId, name: ev.name, abbr: ev.abbr,
          division: divisionOf(ev.division), isParli: ev.isParli, prelimCount: ev.prelimCount,
          // NYPDL declares 23-30; everything else uses the 25-30 convention.
          speakerScaleMin: off.category === 'NYPDL' ? 23 : 25, speakerScaleMax: 30,
        });
        rows.fieldStats.push({
          eventId: ev.eventId, rawEntries: stats.rawEntries, forfeitedOut: stats.forfeitedOut,
          fieldSize: stats.fieldSize, elimField: stats.elimField,
          adjustedFieldSize: ev.division === 'open' ? (off.afs ?? null) : null,
          breakPct: stats.fieldSize ? (100 * stats.elimField) / stats.fieldSize : null,
          unscored: stats.unscored,
        });
        loadEvent(ev, off.tournId!, students);
      }
    }

    function loadEvent(
      ev: NormalizedEvent,
      tournId: string,
      students: Map<string, { first: string; last: string }>,
    ): void {
      const perf = computeEntryPerformances(ev);
      const { consolation } = partitionElimRounds(ev.rounds);
      const consolationIds = new Set(consolation.map((r) => r.roundId));

      for (const [entryId, entry] of ev.entries) {
        if (seenEntries.has(entryId)) continue;
        seenEntries.add(entryId);
        const school = schoolIndex.resolve(entry.schoolName);
        const p = perf.get(entryId)!;
        rows.entries.push({
          id: entryId, eventId: ev.eventId, code: entry.code,
          schoolId: school?.id ?? null, hybridSchoolId: null,
          teamSize: entry.studentIds.length, dropped: entry.dropped,
          prelimWins: p.wins, prelimLosses: p.losses,
          prelimBallotsWon: p.prelimBallotsWon, prelimBallotsTotal: p.prelimBallotsTotal,
          elimLevel: p.elimLevel, wonFinal: p.wonFinal,
        });
        for (const sid of entry.studentIds) {
          const s = students.get(sid);
          if (!debaters.has(sid)) {
            debaters.set(sid, {
              id: sid, firstName: s?.first ?? null, lastName: s?.last ?? null,
              schoolId: school?.id ?? null, suppressed: false,
            });
          }
          rows.entryDebaters.push({ entryId, debaterId: sid, schoolId: school?.id ?? null });
        }

        const c = caseByEntry.get(entryId);
        if (c) {
          rows.entryResults.push({
            entryId, points: c.ours, basePoints: c.ourBase,
            prelimCountAdjustment: 0, breakPenalty: c.ourAdj, walkoverAdjustment: 0,
            floorApplied: null,
            excludedReason: entry.studentIds.length === 2 ? null : 'teamSize',
            countsTowardToc: true,
          });
          if (!c.matched) {
            rows.disagreements.push({
              id: `dis_${entryId}`, seasonId: SEASON, tournamentId: tournId, entryId,
              scope: 'entry_points', ourValue: c.ours, officialValue: c.theirs,
              detail: {
                tournament: c.tournament, school: c.school, matchTier: c.matchTier,
                ourBase: c.ourBase, theirBase: c.theirBase,
                ourAdjustment: c.ourAdj, theirAdjustment: c.theirAdj, broke: c.broke,
              },
              status: 'open',
            });
          }
        }
      }

      for (const r of ev.rounds) {
        if (!r.roundId) continue;
        rows.rounds.push({
          id: r.roundId, eventId: ev.eventId, name: r.name, tabroomType: r.type,
          kind: r.isPrelim ? 'prelim' : r.isElim ? 'elim' : 'other',
          elimLevel: r.elimLevel, isConsolation: consolationIds.has(r.roundId),
          sectionCount: r.sections.length,
        });
        for (const sec of r.sections) {
          for (const b of sec.ballots) {
            if (!b.ballotId || !b.entryId || !seenEntries.has(b.entryId)) continue;
            if (b.judgePersonId && !judges.has(b.judgePersonId)) {
              judges.set(b.judgePersonId, {
                id: b.judgePersonId,
                firstName: null, lastName: null,
              });
            }
            rows.ballots.push({
              id: b.ballotId, roundId: r.roundId, sectionId: sec.sectionId,
              entryId: b.entryId, judgeId: b.judgePersonId, side: b.side,
              won: b.won, isBye: sec.isBye,
            });
            b.speakerPoints.forEach((sp, i) => {
              rows.speakerScores.push({
                id: `${b.ballotId}_${i}`, ballotId: b.ballotId,
                debaterId: sp.debaterId && debaters.has(sp.debaterId) ? sp.debaterId : null,
                judgeId: b.judgePersonId, raw: sp.value,
                z: null, display: null,
                // 0.0 is a forfeit marker, not a score; held back from analysis.
                excluded: sp.value === 0, exclusionReason: sp.value === 0 ? 'sentinel' : null,
              });
            });
          }
        }
      }
    }

    // Judge names come from ballots, which carry them denormalized.
    for (const off of officialTournaments) {
      if (!off.tournId || !cached.has(off.tournId)) continue;
      const raw = JSON.parse(readFileSync(`${RAW_DIR}/${off.tournId}.json`, 'utf8'));
      for (const cat of raw.categories ?? []) {
        for (const ev of cat.events ?? []) {
          for (const r of ev.rounds ?? []) {
            for (const s of r.sections ?? []) {
              for (const b of s.ballots ?? []) {
                const jid = b.judge_person ? String(b.judge_person) : null;
                const j = jid ? judges.get(jid) : null;
                if (j && !j.lastName) { j.firstName = b.judge_first ?? null; j.lastName = b.judge_last ?? null; }
              }
            }
          }
        }
      }
    }

    console.log('\ninserting:');
    await insertAll(db, t.schools, [...schoolIndex.byId.values()].map((s) => ({
      id: s.id, name: s.name, shortName: s.shortName, region: s.region,
      tabroomChapterId: null, isMember: s.isMember,
    })), 'schools');
    await insertAll(db, t.tournaments, rows.tournaments, 'tournaments');
    await insertAll(db, t.events, rows.events, 'events');
    await insertAll(db, t.debaters, [...debaters.values()], 'debaters');
    await insertAll(db, t.judges, [...judges.values()], 'judges');
    await insertAll(db, t.entries, rows.entries, 'entries');
    await insertAll(db, t.entryDebaters, rows.entryDebaters, 'entry_debaters');
    await insertAll(db, t.rounds, rows.rounds, 'rounds');
    await insertAll(db, t.ballots, rows.ballots, 'ballots');
    await insertAll(db, t.speakerScores, rows.speakerScores, 'speaker_scores');
    await insertAll(db, t.eventFieldStats, rows.fieldStats, 'event_field_stats');
    await insertAll(db, t.entryResults, rows.entryResults, 'entry_results');
    await insertAll(db, t.officialTournamentStats, rows.officialStats, 'official_tournament_stats');
    await insertAll(db, t.disagreements, rows.disagreements, 'disagreements');

    console.log(`\nunmatched sheet rows: ${season.unmatched.length}, ambiguous: ${season.ambiguous.length}`);
    console.log('done');
  } finally {
    await close();
  }
}

await main();
