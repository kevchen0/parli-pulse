import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import SiteHeader from './site-header';
import { Analytics } from '@vercel/analytics/next';
import { SITE_NAV } from '@/lib/season';

export const metadata: Metadata = {
  title: 'Parli Pulse — NPDL rankings',
  description:
    'Rankings for American high school parliamentary debate. Unofficial, not affiliated with the NPDL.',
  /**
   * Belt and braces with app/robots.ts, which do different jobs: robots.txt
   * asks a crawler not to fetch, and this tells one that fetched anyway not to
   * index. A page nobody crawls can still be indexed from an inbound link, so
   * the header is the half that actually keeps a debater's name out of a
   * search result.
   */
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap"
        />
      </head>
      <body>
        <SiteHeader />
        {children}
        <div className="wrap">
          <footer>
            <p>
              Points follow Article XXI of the NPDL League Rules. Results are derived from
              publicly available Tabroom data. Ratings and speaker figures are our own and
              are not published by the league.
            </p>
            {/*
              Rendered from the same list as the masthead, so the two orders
              cannot drift. They already had: the header ran Method, Feedback,
              Privacy, About and the footer ran the reverse of it, without
              Method at all.
            */}
            <p className="footlinks">
              {SITE_NAV.map((item) => (
                <Link key={item.path} href={item.path as never}>{item.label}</Link>
              ))}
              <a href="https://github.com/kevchen0/parli-pulse">Source</a>
            </p>
          </footer>
        </div>
        {/*
          Vercel Web Analytics: page counts only, no cookies, and no identifier
          that survives the day. Described on /privacy, which committed to
          saying so before anything shipped.
        */}
        <Analytics />
      </body>
    </html>
  );
}
