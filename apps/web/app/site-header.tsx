import Link from 'next/link';
import { SITE_NAV, currentSeason } from '@/lib/season';

/**
 * The masthead, on every page.
 *
 * Flat, on a hairline rule, carrying the wordmark and the pages that are not
 * about a season. Section navigation belongs to the season below it, so the
 * two rows answer different questions: which site, and which part of it.
 *
 * The unofficial notice lives here as one quiet line rather than in a box at
 * the top of every page. It has to be present everywhere and does not have to
 * be the loudest thing anywhere -- a warning nobody stops seeing is a warning
 * that has stopped working.
 */
export default function SiteHeader() {
  return (
    <header className="masthead">
      <div className="mastrow">
        <Link href="/" className="wordmark">parli-pulse</Link>
        <nav className="sitenav" aria-label="About this site">
          <Link href={`/${currentSeason()}/points` as never}>Rankings</Link>
          {SITE_NAV.map((item) => (
            <Link key={item.path} href={item.path as never}>{item.label}</Link>
          ))}
        </nav>
      </div>
      <p className="unofficial">
        Not affiliated with the National Parliamentary Debate League, whose official
        rankings are at{' '}
        <a href="https://www.parliamentarydebate.org/rankings">parliamentarydebate.org</a>.
      </p>
    </header>
  );
}
