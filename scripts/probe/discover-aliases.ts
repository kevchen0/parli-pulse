/**
 * Derives the independent-academy index: which club, academy, and independent
 * registrations the league credits to which school.
 *
 * Every matched entry where Tabroom's school name differs from the school the
 * league credited is an observed alias. Emitted for review rather than applied
 * blindly -- see packages/ingest/src/school-aliases.ts.
 */
import { readFileSync } from 'node:fs';
import { buildSchoolIndex, parseWorkbook, schoolKey } from '../../packages/ingest/src/index.ts';
import { computeSeason, sourceFromEnv } from '../lib/season.ts';
import { existsSync } from 'node:fs';
import { normalizeTournament } from '../../packages/ingest/src/normalize.ts';

const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const index = buildSchoolIndex(wb.get('SchoolList')!);
const season = computeSeason(undefined, { source: sourceFromEnv() });

// entryId -> tabroom school name
const tabroomSchool = new Map<string, string>();
const seenTourn = new Set<string>();
for (const c of season.cases) {
  if (seenTourn.has(c.tournId)) continue;
  seenTourn.add(c.tournId);
  const p = `data/raw/tabroom/${c.tournId}.json`;
  if (!existsSync(p)) continue;
  const t = normalizeTournament(JSON.parse(readFileSync(p, 'utf8')));
  for (const ev of t.events) {
    for (const [id, e] of ev.entries) if (e.schoolName) tabroomSchool.set(id, e.schoolName);
  }
}

interface Observed { alias: string; school: string; count: number }
const observed = new Map<string, Observed>();
for (const c of season.cases) {
  // Hybrid entries are filed under one partner's school in Tabroom and the
  // other's in the sheet, which looks exactly like an alias but is not one.
  if (c.hybrid || c.hybridSchool) continue;
  const raw = tabroomSchool.get(c.entryId);
  if (!raw) continue;
  const credited = index.resolve(c.school);
  if (!credited) continue;
  // Only interesting when the names genuinely disagree.
  if (schoolKey(raw) === schoolKey(credited.name)) continue;
  if (credited.shortName && schoolKey(raw) === schoolKey(credited.shortName)) continue;
  const key = `${schoolKey(raw)}|${credited.id}`;
  const e = observed.get(key) ?? { alias: raw.split('/')[0]!.trim(), school: credited.name, count: 0 };
  e.count++;
  observed.set(key, e);
}

const rows = [...observed.values()].sort((a, b) => b.count - a.count || a.alias.localeCompare(b.alias));
console.log(`observed ${rows.length} school aliases\n`);
console.log(`${'registration name'.padEnd(46)} ${'credited to'.padEnd(30)} rows`);
for (const r of rows) {
  console.log(`${r.alias.slice(0, 46).padEnd(46)} ${r.school.slice(0, 30).padEnd(30)} ${r.count}`);
}

// --- emit a curated seed file -------------------------------------------
// "Independent" is the absence of an affiliation, not one, so those rows are
// dropped. An alias pointing at more than one real school is almost always a
// hybrid artefact rather than a club, so it is listed for review instead.
const byAlias = new Map<string, Observed[]>();
for (const r of rows) {
  if (r.school === 'Independent') continue;
  const l = byAlias.get(r.alias) ?? [];
  l.push(r);
  byAlias.set(r.alias, l);
}
const confident = [...byAlias.entries()].filter(([, v]) => v.length === 1)
  .map(([alias, v]) => ({ alias, school: v[0]!.school, count: v[0]!.count }))
  .sort((a, b) => b.count - a.count || a.alias.localeCompare(b.alias));
const ambiguous = [...byAlias.entries()].filter(([, v]) => v.length > 1);

console.log(`\n\n// confident: ${confident.length}, ambiguous: ${ambiguous.length}`);
for (const c of confident) console.log(`  ${JSON.stringify(c.alias)}: ${JSON.stringify(c.school)}, // ${c.count}`);
console.log('\n// ambiguous, needs a human:');
for (const [alias, v] of ambiguous) console.log(`//   ${alias} -> ${v.map((x) => `${x.school} (${x.count})`).join(' | ')}`);
