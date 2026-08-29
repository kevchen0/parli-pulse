import { ImageResponse } from 'next/og';

export const alt = 'parli-pulse — rankings for high school parliamentary debate';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The card image a link preview shows.
 *
 * Generated rather than a checked-in PNG, so the wording cannot drift from the
 * site and there is no binary to keep in step. Deliberately plain: the palette
 * is the site's ink and slate, and it names what the thing is rather than
 * decorating it.
 *
 * No custom font is loaded. `next/og` would have to fetch and embed the file at
 * build time, which is a network dependency in the build for a difference
 * nobody looking at a 1200x630 card will notice.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#f4f6f8',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, color: '#151a20', letterSpacing: '-0.03em' }}>
          parli-pulse
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 40, color: '#59636f', lineHeight: 1.3 }}>
          Rankings for high school parliamentary debate
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: '#838d99' }}>
          Article XXI points · Glicko-2 ratings · judge-adjusted speaks
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            paddingTop: 40,
            fontSize: 26,
            color: '#838d99',
            borderTop: '2px solid #dde2e8',
          }}
        >
          Unofficial. Not affiliated with the National Parliamentary Debate League.
        </div>
      </div>
    ),
    size,
  );
}
