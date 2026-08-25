import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import SiteHeader from './site-header';

export const metadata: Metadata = {
  title: 'Parli Pulse — NPDL rankings',
  description:
    'Rankings for American high school parliamentary debate. Unofficial, not affiliated with the NPDL.',
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
            <p className="footlinks">
              <Link href="/about">About</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/feedback">Feedback</Link>
              <a href="https://github.com/kevchen0/parli-pulse">Source</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
