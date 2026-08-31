import { readFileSync } from 'node:fs';
import { buildStudentIndex, computeEntryPerformances, computeFieldStats, normalizeTournament } from '../../packages/ingest/src/normalize.ts';
import { parseEntryTab, parseTournamentsTab, parseWorkbook } from '../../packages/ingest/src/sheet.ts';
const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const sheetName = process.argv[2]!;
const off = parseTournamentsTab(wb.get('Tournaments')!).find((t) => t.name === sheetName)!;
const rows = parseEntryTab(wb.get('Entry')!).filter((e) => e.tournament === sheetName);
const raw = JSON.parse(readFileSync(`data/raw/tabroom/${off.tournId}.json`, 'utf8'));
const t = normalizeTournament(raw);
const students = buildStudentIndex(raw);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^[a-z]\.\s*/, '').replace(/[^a-z]/g, '');
const key = (a: string, b: string) => [norm(a), norm(b)].sort().join('|');
const ev = t.events.filter((e) => e.isParli && e.division === 'open' && !computeFieldStats(e).phantom)[0]!;
const perf = computeEntryPerformances(ev);
const mine = new Map<string, { rec: string; lvl: string; code: string }>();
for (const [eid, entry] of ev.entries) {
  const names = entry.studentIds.map((s) => students.get(s)?.last ?? '').filter(Boolean);
  if (names.length !== 2) continue;
  const p = perf.get(eid)!;
  mine.set(key(names[0]!, names[1]!), { rec: `${p.wins}-${p.losses}`, lvl: p.elimLevel ?? '-', code: entry.code ?? '' });
}
console.log(`${sheetName}: sheet prelim#=${off.prelimCount}, ours=${ev.prelimCount}`);
console.log(`rounds: ${ev.rounds.map((r) => `${r.name}:${r.type}(${r.sections.length})`).join(' ')}\n`);
console.log(`${'team'.padEnd(30)} ${'sheetRec'.padStart(8)} ${'ourRec'.padStart(7)} ${'ourElim'.padStart(9)} ${'sheet'.padStart(5)}`);
let shown = 0;
for (const r of rows) {
  const m = mine.get(key(r.partner1, r.partner2));
  if (!m) continue;
  const disagree = m.rec !== r.result;
  if (!disagree && shown > 6) continue;
  if (shown++ > 24) break;
  console.log(`${`${r.school1} ${r.partner1}&${r.partner2}`.slice(0,30).padEnd(30)} ${r.result.padStart(8)} ${m.rec.padStart(7)} ${m.lvl.padStart(9)} ${String(r.calcPoints).padStart(5)} ${disagree ? '  <-- record differs' : ''}`);
}
