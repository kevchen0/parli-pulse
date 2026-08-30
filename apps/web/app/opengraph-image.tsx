import { ImageResponse } from 'next/og';
import { dbReady, getRatings, getSeasons } from '@/lib/db';
import { displayName } from '@/lib/names';
import { currentSeason, seasonLabel } from '@/lib/season';

export const alt = 'parli-pulse — the top of the ratings board';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Regenerated hourly. A card is cached hard by every platform anyway. */
export const revalidate = 3600;

/**
 * Rows that fit without the footer colliding with the table.
 *
 * Measured rather than guessed: eight overflowed 630px, a long pairing wrapped
 * to two lines, and the footer sat on top of row six. Six fits with a long name
 * on one line and room to spare.
 */
const ROWS = 6;

/**
 * The card a link preview shows: the actual top of the ratings board.
 *
 * Read from the database rather than drawn, so the card is the thing the site
 * is rather than a description of it, and cannot go stale against the page it
 * links to. Names come through `displayName`, so a withheld debater reads as
 * "Name withheld" here exactly as everywhere else -- a card is a place a name
 * can escape to, and suppression has to hold in it.
 *
 * Falls back to the wordmark and a line of text when there is nothing to show,
 * which is the state of a season before its first tournament is scored.
 */
export default async function OpengraphImage() {
  const seasons = dbReady() ? await getSeasons() : [];
  const season = seasons.find((s) => s.tournaments > 0)?.id ?? currentSeason();
  const rows = dbReady() ? (await getRatings(season)).slice(0, ROWS) : [];

  const ink = '#151a20';
  const muted = '#59636f';
  const faint = '#838d99';
  const line = '#dde2e8';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#f4f6f8',
          padding: '54px 64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: ink, letterSpacing: '-0.02em' }}>
            parli-pulse
          </div>
          <div style={{ display: 'flex', fontSize: 27, color: muted }}>
            {rows.length > 0 ? `Ratings · ${seasonLabel(season)}` : 'NPDL rankings'}
          </div>
        </div>

        {rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                color: faint,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                paddingBottom: 10,
                borderBottom: `2px solid ${line}`,
              }}
            >
              <div style={{ display: 'flex', width: 60 }}>#</div>
              <div style={{ display: 'flex', width: 540 }}>Partnership</div>
              <div style={{ display: 'flex', width: 290 }}>School</div>
              <div style={{ display: 'flex', width: 140, justifyContent: 'flex-end' }}>Est.</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.subjectId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 26,
                  color: ink,
                  padding: '13px 0',
                  borderBottom: `1px solid ${line}`,
                }}
              >
                <div style={{ display: 'flex', width: 60, color: faint }}>{i + 1}</div>
                <div
                  style={{
                    display: 'flex',
                    width: 540,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    // Clip inside the cell, so the longest pairing does not run
                    // up against the school beside it.
                    paddingRight: 22,
                  }}
                >
                  {`${displayName(r.debater1)} & ${displayName(r.debater2)}`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: 290,
                    color: muted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    paddingRight: 16,
                  }}
                >
                  {r.school ?? '—'}
                </div>
                <div style={{ display: 'flex', width: 140, justifyContent: 'flex-end', fontWeight: 600 }}>
                  {Math.round(Number(r.shrunk ?? r.rating))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', marginTop: 36, fontSize: 36, color: muted, lineHeight: 1.35 }}>
            Rankings for high school parliamentary debate. Article XXI points,
            Glicko-2 ratings and judge-adjusted speaker points.
          </div>
        )}

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            paddingTop: 22,
            fontSize: 21,
            color: faint,
          }}
        >
          Unofficial. Not affiliated with the National Parliamentary Debate League.
        </div>
      </div>
    ),
    size,
  );
}
