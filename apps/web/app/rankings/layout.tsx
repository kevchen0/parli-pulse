import Link from 'next/link';
import { CURRENT_SEASON } from '@/lib/season';

const tabs = [
  { href: '/rankings', label: 'Teams' },
  { href: '/rankings/debaters', label: 'Debaters' },
  { href: '/rankings/schools', label: 'Schools' },
  { href: '/rankings/diagnostic', label: 'Diagnostic' },
] as const;

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <h1>Rankings</h1>
      <p className="lede">
        Article XXI points for the {CURRENT_SEASON} season, computed from publicly available
        Tabroom results. Where these differ from the league&rsquo;s published figures, the
        league&rsquo;s are correct.
      </p>
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}>{t.label}</Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
