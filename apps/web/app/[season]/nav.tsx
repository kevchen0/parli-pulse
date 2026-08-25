'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SEASON_NAV, seasonHref, type SeasonId } from '@/lib/season';

/**
 * The section bar, and the sub-bar for whichever section is open.
 *
 * A client component only because marking the current page needs the path.
 * Everything it renders comes from `SEASON_NAV`, so the structure lives in one
 * place and cannot drift between the header and the routes it names.
 */
export default function SeasonNav({ season }: { season: SeasonId }) {
  const pathname = usePathname() ?? '';
  const within = (path: string): boolean => {
    const full = `/${season}${path}`;
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  // Longest match wins, so /points/debaters opens Points rather than matching
  // nothing and leaving the reader with no sense of where they are.
  const open = [...SEASON_NAV].sort((a, b) => b.path.length - a.path.length).find((s) => within(s.path));

  return (
    <>
      <nav className="sections" aria-label="Sections">
        {SEASON_NAV.map((item) => (
          <Link
            key={item.path}
            href={seasonHref(season, item.path)}
            data-current={item === open || undefined}
            aria-current={item === open ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {open?.children && (
        <nav className="subsections" aria-label={`${open.label} pages`}>
          {open.children.map((child) => {
            const full = `/${season}${child.path}`;
            const current = pathname === full;
            return (
              <Link
                key={child.path}
                href={seasonHref(season, child.path)}
                data-current={current || undefined}
                aria-current={current ? 'page' : undefined}
              >
                {child.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
