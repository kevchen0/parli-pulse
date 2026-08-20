/** What is still unmatched after the matcher runs, and why. */
import { existsSync, readFileSync } from 'node:fs';
import { buildStudentIndex, computeFieldStats, normalizeTournament } from '../packages/ingest/src/normalize.ts';
import { matchTeams, peopleFromEntryLabel, type EntryCandidate } from '../packages/ingest/src/matching.ts';
import { parseEntryTab, parseTournamentsTab, parseWorkbook } from '../packages/ingest/src/sheet.ts';

const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const tourns = parseTournamentsTab(wb.get('Tournaments')!);
const entries = parseEntryTab(wb.get('Entry')!);

let noPayload = 0, unmatched = 0, matched = 0, ambiguous = 0;
const byTourn = new Map<string, number>();
const examples: string[] = [];

for (const off of tourns) {
  const rows = entries.filter((e) => e.tournament === off.name);
  if (!rows.length) continue;
  const p = off.tournId ? `data/raw/tabroom/${off.tournId}.json` : '';
  if (!p || !existsSync(p)) { noPayload += rows.length; byTourn.set(`${off.name} (no payload)`, rows.length); continue; }
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const t = normalizeTournament(raw);
  const students = buildStudentIndex(raw);
  const opens = t.events.filter((e) => e.isParli && e.division === 'open' && !computeFieldStats(e).phantom);
  if (!opens.length) { noPayload += rows.length; byTourn.set(`${off.name} (no open event)`, rows.length); continue; }

  const candidates: EntryCandidate[] = [];
  for (const ev of opens) {
    for (const [entryId, entry] of ev.entries) {
      const people = entry.studentIds.map((s) => students.get(s)).filter((x): x is { first: string; last: string } => !!x && !!x.last);
      const resolved = people.length ? people : peopleFromEntryLabel(entry.name, entry.code);
      if (resolved.length) candidates.push({ entryId, schoolName: entry.schoolName, people: resolved });
    }
  }
  const teams = rows.map((r) => ({ partner1: r.partner1, partner2: r.partner2, school: r.school1 }));
  const res = matchTeams(teams, candidates);
  matched += res.matches.size;
  ambiguous += res.ambiguous.length;
  unmatched += res.unmatched.length;
  if (res.unmatched.length) byTourn.set(off.name, res.unmatched.length);
  for (const i of res.unmatched.slice(0, 2)) {
    if (examples.length < 20) {
      const r = rows[i]!;
      examples.push(`${off.name.slice(0,20).padEnd(20)} ${r.school1.slice(0,16).padEnd(16)} ${r.partner1} & ${r.partner2}   (candidates: ${candidates.length})`);
    }
  }
}
console.log(`matched ${matched}  ambiguous ${ambiguous}  unmatched ${unmatched}  rows in tournaments with no usable payload ${noPayload}`);
console.log('\n-- unmatched by tournament --');
for (const [n, c] of [...byTourn].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${n.slice(0,44).padEnd(44)} ${c}`);
console.log('\n-- examples --');
for (const e of examples) console.log('  ' + e);
