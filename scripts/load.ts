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
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../packages/db/src/client.ts';
import * as t from '../packages/db/src/schema.ts';
import {
  buildSchoolIndex,
  buildStudentIndex,
  peopleFromEntryLabel,
  schoolKey,
  computeEntryPerformances,
  computeFieldStats,
  normalizeTournament,
  partitionElimRounds,
  indexHeaders,
  parseTournamentsTab,
  parseWorkbook,
  resolveSheetPath,
  type NormalizedEvent,
} from '../packages/ingest/src/index.ts';
import { openEventFilter } from '../packages/ingest/src/event-selection.ts';
import { computeSeason } from './lib/season.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const RAW_DIR = 'data/raw/tabroom';
/**
 * The season's own workbook, falling back to the unsuffixed name for 2025-26,
 * whose cache predates seasons having one each. A new document is published
 * every year, so a shared filename would let one season's fetch overwrite
 * another season's ground truth.
 */
const SHEET = resolveSheetPath(SEASON, existsSync);

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
    // The league's own School tab is its member list; SchoolList is merely
    // every school seen. XXI.9.A ranks members only.
    const schoolTab = wb.get('School')!;
    const schoolHeader = indexHeaders(schoolTab);
    const memberNames = schoolTab
      .slice(schoolHeader.headerIndex + 1)
      .map((r) => (r[schoolHeader.col('School')] ?? '').trim())
      .filter(Boolean);
    const schoolIndex = buildSchoolIndex(wb.get('SchoolList')!, memberNames);

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

    // A season whose payloads have never been fetched has an empty cache, not a
    // missing one. The directory is absent on a fresh checkout and at the start
    // of every season, which is exactly when this runs.
    const cached = new Set(
      (existsSync(RAW_DIR) ? readdirSync(RAW_DIR) : [])
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5)),
    );

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

      const selectOpen = openEventFilter(off.name);
      for (const ev of norm.events) {
        // Load every parli division for field sizes, but only the events this
        // league tournament actually owns can carry its results.
        if (!ev.isParli && !selectOpen(ev)) continue;
        const stats = computeFieldStats(ev);
        // An event claimed by an override is the open division of its league
        // tournament by definition -- "Round Robin" says nothing about either
        // the format or the level, so the name-based classifier cannot see it.
        const claimedByOverride = selectOpen(ev) && !ev.isParli;
        rows.events.push({
          id: ev.eventId, tournamentId: off.tournId, name: ev.name, abbr: ev.abbr,
          division: claimedByOverride ? 'open' : divisionOf(ev.division),
          isParli: ev.isParli || claimedByOverride, prelimCount: ev.prelimCount,
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
        const matched = caseByEntry.get(entryId);
        // The league credits a result to the debater's actual school, not to
        // whatever club or independent registration it was entered under --
        // Stuyvesant's top team also competed as "Rodda's Disciples". The
        // sheet's own school column is that mapping, so prefer it where a row
        // matched, and fall back to the Tabroom name otherwise.
        const school = schoolIndex.resolve(matched?.school ?? entry.schoolName)
          ?? schoolIndex.resolve(entry.schoolName);
        // Hybrid membership comes from the league's own row: Tabroom files a
        // hybrid under one school, so the second is not recoverable from it.
        const hybridSchool = matched?.hybridSchool
          ? schoolIndex.resolve(matched.hybridSchool)
          : null;
        const p = perf.get(entryId)!;
        // Tournaments that publish no student records leave entries with no
        // debaters at all. Their points scored correctly but then vanished
        // from every rollup, because standings group by debater. Recover the
        // names from the entry label and give them stable synthetic ids, keyed
        // on school and name so the same person recurs across tournaments.
        const linked: { id: string; first: string | null; last: string | null }[] =
          entry.studentIds.length > 0
            ? entry.studentIds.map((sid) => ({
                id: sid,
                first: students.get(sid)?.first ?? null,
                last: students.get(sid)?.last ?? null,
              }))
            : peopleFromEntryLabel(entry.name, entry.code).map((p) => ({
                id: `lbl_${schoolKey(school?.name ?? 'unknown')}_${schoolKey(p.last)}${p.first ? `_${schoolKey(p.first)}` : ''}`,
                first: p.first || null,
                last: p.last,
              }));

        rows.entries.push({
          id: entryId, eventId: ev.eventId, code: entry.code,
          schoolId: school?.id ?? null, hybridSchoolId: hybridSchool?.id ?? null,
          // Count the debaters we actually resolved, not the student records.
          // Entries known only from ballots have no student records at all, and
          // reading that as a zero-person team wrongly failed XXI.1.G and
          // dropped genuine results out of every standing.
          teamSize: linked.length, dropped: entry.dropped,
          prelimWins: p.wins, prelimLosses: p.losses,
          prelimBallotsWon: p.prelimBallotsWon, prelimBallotsTotal: p.prelimBallotsTotal,
          elimLevel: p.elimLevel, wonFinal: p.wonFinal,
        });
        for (const person of linked) {
          if (!debaters.has(person.id)) {
            debaters.set(person.id, {
              id: person.id, firstName: person.first, lastName: person.last,
              schoolId: school?.id ?? null, suppressed: false,
            });
          }
          rows.entryDebaters.push({ entryId, debaterId: person.id, schoolId: school?.id ?? null });
        }

        const c = matched;
        if (c) {
          rows.entryResults.push({
            entryId, points: c.ours, basePoints: c.ourBase,
            prelimCountAdjustment: 0, breakPenalty: c.ourAdj, walkoverAdjustment: 0,
            floorApplied: null,
            excludedReason: linked.length === 2 ? null : 'teamSize',
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

    // Results with no Tabroom entry behind them -- hand-entered from another
    // platform, or scored from the league's own record at a prelim-only
    // tournament -- still need rows, or they score correctly and then never
    // reach a standing.
    const synthetic = season.cases.filter((c) => !seenEntries.has(c.entryId));
    if (synthetic.length) {
      const madeTournaments = new Set(rows.tournaments.map((t) => t.id as string));
      for (const c of synthetic) {
        const tournId = c.tournId || `manual_${c.tournament}`.replace(/\s+/g, '_');
        if (!madeTournaments.has(tournId)) {
          madeTournaments.add(tournId);
          rows.tournaments.push({
            id: tournId, seasonId: SEASON, tabroomId: c.tournId || null,
            name: c.tournament, officialName: c.tournament,
            startsOn: null, endsOn: null, location: null,
            category: c.category === '(none)' ? null : c.category,
            approval: null, payloadHash: null, fetchedAt: new Date(),
          });
        }
        const eventId = `${tournId}_manual`;
        if (!rows.events.some((e) => e.id === eventId)) {
          rows.events.push({
            id: eventId, tournamentId: tournId, name: 'Open Parli (entered by hand)',
            abbr: null, division: 'open', isParli: true, prelimCount: 0,
            speakerScaleMin: null, speakerScaleMax: null,
          });
        }
        const school = schoolIndex.resolve(c.school);
        const hybrid = c.hybridSchool ? schoolIndex.resolve(c.hybridSchool) : null;
        // The league's own spelling, not the normalized key: "Cassel Engen"
        // must not become "casselengen", or it will never tie back to the
        // student record that carries the space.
        const surnames = [c.partner1, c.partner2].filter(Boolean);
        seenEntries.add(c.entryId);
        rows.entries.push({
          id: c.entryId, eventId, code: `${c.school} ${surnames.join(' & ')}`,
          schoolId: school?.id ?? null, hybridSchoolId: hybrid?.id ?? null,
          teamSize: surnames.length, dropped: false,
          prelimWins: 0, prelimLosses: 0, prelimBallotsWon: 0, prelimBallotsTotal: 0,
          elimLevel: null, wonFinal: false,
        });
        for (const surname of surnames) {
          const id = `lbl_${schoolKey(school?.name ?? c.school)}_${schoolKey(surname)}`;
          if (!debaters.has(id)) {
            debaters.set(id, {
              id, firstName: null, lastName: surname, schoolId: school?.id ?? null, suppressed: false,
            });
          }
          rows.entryDebaters.push({ entryId: c.entryId, debaterId: id, schoolId: school?.id ?? null });
        }
        rows.entryResults.push({
          entryId: c.entryId, points: c.ours, basePoints: c.ourBase,
          prelimCountAdjustment: 0, breakPenalty: 0, walkoverAdjustment: 0,
          floorApplied: null, excludedReason: surnames.length === 2 ? null : 'teamSize',
          countsTowardToc: true,
        });
      }
      console.log(`  synthesized ${synthetic.length} results with no Tabroom entry`);
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
    // Schools are not season-scoped and so are never cleared; they must be
    // updated in place or a corrected membership flag silently does nothing.
    const schoolRows = [...schoolIndex.byId.values()].map((s) => ({
      id: s.id, name: s.name, shortName: s.shortName, region: s.region,
      tabroomChapterId: null, isMember: s.isMember,
    }));
    for (let i = 0; i < schoolRows.length; i += 500) {
      await db.insert(t.schools).values(schoolRows.slice(i, i + 500)).onConflictDoUpdate({
        target: t.schools.id,
        set: {
          name: sql`excluded.name`, shortName: sql`excluded.short_name`,
          region: sql`excluded.region`, isMember: sql`excluded.is_member`,
        },
      });
    }
    console.log(`  ${'schools'.padEnd(26)} ${schoolRows.length}`);
    await insertAll(db, t.tournaments, rows.tournaments, 'tournaments');
    await insertAll(db, t.events, rows.events, 'events');
    // Debaters are not season-scoped either, so they must be updated in place.
    // Inserting with onConflictDoNothing leaves an existing row pointing at
    // whatever school it resolved to on an earlier run -- which is how
    // "Brooklyn Technical High School Parliamentary Debate Team" survived as a
    // school of its own after the alias for it was added.
    const debaterRows = [...debaters.values()];
    for (let i = 0; i < debaterRows.length; i += 500) {
      await db.insert(t.debaters).values(debaterRows.slice(i, i + 500) as never).onConflictDoUpdate({
        target: t.debaters.id,
        set: {
          firstName: sql`excluded.first_name`, lastName: sql`excluded.last_name`,
          schoolId: sql`excluded.school_id`,
        },
      });
    }
    console.log(`  ${'debaters'.padEnd(26)} ${debaterRows.length}`);
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
