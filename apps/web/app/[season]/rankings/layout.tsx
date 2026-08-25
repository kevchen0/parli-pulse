import Link from 'next/link';
import { seasonHref, seasonLabel } from '@/lib/season';

const tabs = [
  { href: '/rankings', label: 'Teams' },
  { href: '/rankings/debaters', label: 'Debaters' },
  { href: '/rankings/schools', label: 'Schools' },
  { href: '/rankings/speakers', label: 'Speakers' },
  { href: '/rankings/ratings', label: 'Ratings' },
  { href: '/rankings/diagnostic', label: 'Diagnostic' },
] as const;

export default async function RankingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  return (
    <main>
      <h1>Rankings</h1>
      <p className="lede">
        Article XXI points for the {seasonLabel(season)} season, computed from publicly
        available Tabroom results. Where these differ from the league&rsquo;s published
        figures, the league&rsquo;s are correct. Speakers and Ratings are our own measures,
        which the league does not publish and Article XXI does not use.
      </p>
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.href} href={seasonHref(season, t.href)}>{t.label}</Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
