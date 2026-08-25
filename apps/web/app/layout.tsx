import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parli Pulse — NPDL rankings',
  description:
    'Rankings for American high school parliamentary debate. Unofficial, not affiliated with the NPDL.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          {/* The site shows the league's own numbers alongside our own metric,
              so it must never be mistaken for the league's own site. */}
          <p className="banner">
            <strong>Unofficial.</strong> Not affiliated with or endorsed by the National
            Parliamentary Debate League. Official rankings are published at{' '}
            <a href="https://www.parliamentarydebate.org/rankings">
              parliamentarydebate.org
            </a>
            .
          </p>
          {children}
          <footer>
            Points follow Article XXI of the NPDL League Rules. Results are derived from
            publicly available Tabroom data.
          </footer>
        </div>
      </body>
    </html>
  );
}
