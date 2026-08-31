/**
 * Agreement with the league's published standings at the top of the table.
 *
 * Compares what the site serves -- the rollup in Postgres, with identity
 * merging and the affiliation index applied -- against `team_calc` and
 * `School`. Tolerances are relative as well as absolute, since a point matters
 * far more to a team on 12 than to one on 80.
 */
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { createDb } from '../../packages/db/src/client.ts';
import { indexHeaders, parseWorkbook } from '../../packages/ingest/src/sheet.ts';
import { schoolKey } from '../../packages/ingest/src/schools.ts';
import { loadOurTeams, pairStandings, type OfficialTeam } from '../lib/standings.ts';

const SEASON = process.env.SEASON ?? '2025-26';
const TOP = Number(process.env.TOP ?? 100);
const wb = parseWorkbook(new Uint8Array(readFileSync('data/raw/sheet/rankings.zip')));
const num = (s?: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const tRows = wb.get('team_calc')!;
const tc = indexHeaders(tRows);
const officialTeams: OfficialTeam[] = [];
for (let i = tc.headerIndex + 1; i < tRows.length; i++) {
  const r = tRows[i]!;
  const school = r[tc.col('School')] ?? '', p1 = r[tc.col('Debater 1')] ?? '', p2 = r[tc.col('Debater 2')] ?? '';
  const rank = num(r[tc.col('Rank')]), points = num(r[tc.col('Points')]);
  if (!school || !p1 || !p2 || rank === null || points === null) continue;
  officialTeams.push({ rank, points, school, partner1: p1, partner2: p2, label: `${school} ${p1} & ${p2}` });
}

const sRows = wb.get('School')!;
const sc = indexHeaders(sRows);
const officialSchools: { rank: number; points: number; name: string }[] = [];
for (let i = sc.headerIndex + 1; i < sRows.length; i++) {
  const r = sRows[i]!;
  const name = r[sc.col('School')] ?? '';
  const rank = num(r[sc.col('Rank')]), points = num(r[sc.col('Points')]);
  if (name && rank !== null && points !== null) officialSchools.push({ rank, points, name });
}

const { db, close } = createDb();
const ourTeams = await loadOurTeams(db, SEASON);
const ourSchools = new Map<string, number>();
for (const row of (await db.execute(sql`
  select coalesce(s.short_name, s.name) as name, ss.points
  from school_season_totals ss join schools s on s.id = ss.school_id
  where ss.season_id = ${SEASON}`)).rows as unknown as { name: string; points: number }[]) {
  ourSchools.set(schoolKey(row.name), Number(row.points));
}
await close();

const pct = (k: number, n: number): string => `${String(k).padStart(3)}/${String(n).padEnd(3)} (${((100 * k) / n).toFixed(0)}%)`;

function report(
  label: string,
  items: { label: string; official: number; ours: number | null }[],
): void {
  const n = items.length;
  let exact = 0, p05 = 0, p2 = 0, a05 = 0, a2 = 0, missing = 0;
  const gaps: { label: string; official: number; ours: number; d: number }[] = [];
  for (const it of items) {
    if (it.ours === null) { missing++; continue; }
    const d = Math.abs(it.ours - it.official);
    const rel = it.official === 0 ? (d === 0 ? 0 : Infinity) : (100 * d) / it.official;
    if (d < 0.051) exact++;
    if (rel <= 0.5) p05++;
    if (rel <= 2) p2++;
    if (d <= 0.5) a05++;
    if (d <= 2) a2++;
    if (d >= 0.051) gaps.push({ label: it.label, official: it.official, ours: it.ours, d: it.ours - it.official });
  }
  console.log(`\n=== ${label} — official rank 1..${TOP} ===`);
  console.log(`  compared         ${n}   (unmatched: ${missing})`);
  console.log(`  exact            ${pct(exact, n)}`);
  console.log(`  within 0.5%      ${pct(p05, n)}`);
  console.log(`  within 2%        ${pct(p2, n)}`);
  console.log(`  within 0.5 pts   ${pct(a05, n)}`);
  console.log(`  within 2 pts     ${pct(a2, n)}`);
  if (gaps.length) {
    console.log('  largest gaps:');
    for (const g of gaps.sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8)) {
      console.log(`    ${g.label.slice(0, 40).padEnd(40)} official ${g.official.toFixed(1).padStart(6)}  ours ${g.ours.toFixed(1).padStart(6)}  ${(g.d > 0 ? '+' : '') + g.d.toFixed(1)}`);
    }
  }
}

const paired = pairStandings(officialTeams.filter((t) => t.rank <= TOP), ourTeams);
report('TEAMS', paired.map((p) => ({ label: p.official.label, official: p.official.points, ours: p.ours?.points ?? null })));
report('SCHOOLS', officialSchools.filter((s) => s.rank <= TOP)
  .map((s) => ({ label: s.name, official: s.points, ours: ourSchools.get(schoolKey(s.name)) ?? null })));
