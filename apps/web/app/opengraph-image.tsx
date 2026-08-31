import { ImageResponse } from 'next/og';
import { dbReady, getRatings, getRatingSummary, getSeasons, type RatingRow } from '@/lib/db';
import { displayName } from '@/lib/names';
import { currentSeason, seasonLabel } from '@/lib/season';

export const alt = 'parli-pulse — the ratings board';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Regenerated hourly. A card is cached hard by every platform anyway. */
export const revalidate = 3600;

/**
 * The card a link preview shows: the ratings page, drawn as the page.
 *
 * Not a designed card about the site. The masthead, the unofficial line, the
 * season bar, the section tabs and the board are laid out with the site's own
 * measurements and its own palette, so a preview is a window onto the page the
 * link opens rather than a poster advertising it. It clips at the bottom the
 * way a screenshot of the top of the page would.
 *
 * Everything is scaled by SCALE against the stylesheet's real values. A card is
 * shown at about half size in most clients, and the site's 14px table text
 * disappears there; this is the same page seen through a narrower window.
 *
 * Names come through `displayName`, so a withheld debater reads as "Name
 * withheld" here exactly as everywhere else -- a card is a place a name can
 * escape to, and suppression has to hold in it.
 */

/** Against the stylesheet: 1rem = 16px on the site, 16 * SCALE here. */
const SCALE = 1.3;
const px = (rem: number): number => Math.round(rem * 16 * SCALE);

const BG = '#f6f7f9';
const SURFACE = '#ffffff';
const TEXT = '#151a20';
const MUTED = '#59636f';
const FAINT = '#838d99';
const ACCENT = '#2f5d7c';
const BORDER = '#dde1e7';
const FIRM = '#c3cad3';

/** The wrap, at the site's 62rem capped to what the canvas can hold. */
const PAD = px(1.25);
const CONTENT = size.width - PAD * 2;

/** #, School, Partnership, Rounds, Rating, Raw estimate, XXI rank. */
const COLS = [50, 250, 396, 92, 112, 150, 90];

/**
 * The site's own faces, so the card is set in the type the page is.
 *
 * Google serves woff2 to a browser and TrueType to anything it does not
 * recognise, and Satori reads TrueType, so the request deliberately carries no
 * user agent. Best effort: a card in the wrong face is a small loss, and a card
 * that 500s because a font server was slow is a large one, so every failure
 * here falls back to Satori's default rather than propagating.
 */
async function siteFont(family: string, weight: number): Promise<{
  name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal';
} | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`,
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return { name: family, data, weight: weight as 400 | 600, style: 'normal' };
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const seasons = dbReady() ? await getSeasons() : [];
  // The newest season that actually has a board. A season with a tournament in
  // it but nothing past the round gate -- which is every season until its
  // fourth or fifth weekend -- would otherwise pick itself and render empty.
  let season = currentSeason();
  let rows: RatingRow[] = [];
  if (dbReady()) {
    for (const s of seasons) {
      const r = await getRatings(s.id);
      if (r.length > 0) { season = s.id; rows = r; break; }
    }
  }
  const summary = rows.length > 0 && dbReady() ? await getRatingSummary(season) : null;
  const here = seasons.find((s) => s.id === season);

  const cell = (i: number, extra: Record<string, unknown> = {}) => ({
    display: 'flex',
    width: COLS[i],
    ...(i >= 3 ? { justifyContent: 'flex-end' } : {}),
    ...extra,
  });

  const fonts = (await Promise.all([
    siteFont('Public Sans', 400),
    siteFont('Public Sans', 600),
    siteFont('Source Serif 4', 600),
  ])).filter((f): f is NonNullable<typeof f> => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: BG,
          color: TEXT,
          overflow: 'hidden',
          fontFamily: 'Public Sans',
        }}
      >
        {/* masthead */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: SURFACE,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: `${px(0.85)}px ${PAD}px ${px(0.7)}px`,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'Source Serif 4',
                fontSize: px(1.15),
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              parli-pulse
            </div>
            <div style={{ display: 'flex', gap: px(1.1), fontSize: px(0.875), color: MUTED }}>
              <div style={{ display: 'flex' }}>Rankings</div>
              <div style={{ display: 'flex' }}>Method</div>
              <div style={{ display: 'flex' }}>Feedback</div>
              <div style={{ display: 'flex' }}>Privacy</div>
              <div style={{ display: 'flex' }}>About</div>
            </div>
          </div>
          <div style={{ display: 'flex', padding: `0 ${PAD}px ${px(0.7)}px`, fontSize: px(0.75), color: FAINT }}>
            Not affiliated with the National Parliamentary Debate League, whose official
            rankings are at parliamentarydebate.org.
          </div>
        </div>

        {/* season bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: px(0.75),
            padding: `${px(0.8)}px ${PAD}px 0`,
            fontSize: px(0.8125),
            color: MUTED,
          }}
        >
          <div style={{ display: 'flex' }}>Season</div>
          <div
            style={{
              display: 'flex',
              padding: `${px(0.25)}px ${px(0.6)}px`,
              border: `1px solid ${FIRM}`,
              borderRadius: 4,
              background: SURFACE,
              color: TEXT,
            }}
          >
            {seasonLabel(season)} · complete
          </div>
          <div style={{ display: 'flex' }}>
            {here?.lastResultOn
              ? `Complete, last results ${new Date(`${here.lastResultOn.slice(0, 10)}T00:00:00Z`)
                  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`
              : 'Complete'}
          </div>
        </div>

        {/* section tabs */}
        <div
          style={{
            display: 'flex',
            gap: px(1.4),
            padding: `0 ${PAD}px`,
            marginTop: px(0.75),
            borderBottom: `1px solid ${BORDER}`,
            fontSize: px(0.9),
          }}
        >
          <div style={{ display: 'flex', padding: `${px(0.4)}px 0 ${px(0.5)}px`, color: MUTED }}>Points</div>
          <div
            style={{
              display: 'flex',
              padding: `${px(0.4)}px 0 ${px(0.5)}px`,
              color: TEXT,
              fontWeight: 500,
              borderBottom: `2px solid ${ACCENT}`,
            }}
          >
            Ratings
          </div>
          <div style={{ display: 'flex', padding: `${px(0.4)}px 0 ${px(0.5)}px`, color: MUTED }}>Speakers</div>
        </div>

        {/* the page */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: `${px(1.1)}px ${PAD}px 0` }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Source Serif 4',
              fontSize: px(1.9),
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Ratings
          </div>
          {rows.length === 0 ? (
            <div style={{ display: 'flex', marginTop: px(0.8), fontSize: px(1.15), color: MUTED, maxWidth: CONTENT }}>
              Rankings for high school parliamentary debate. Article XXI points, Glicko-2
              ratings and judge-adjusted speaker points.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', marginTop: px(0.35), fontSize: px(1), color: MUTED }}>
                Glicko-2 rating adjusted for deviation.
              </div>
              {summary ? (
                <div style={{ display: 'flex', gap: px(1.25), marginTop: px(0.9), fontSize: px(0.8125), color: MUTED }}>
                  <div style={{ display: 'flex' }}>{summary.ranked} partnerships with 10 or more rounds</div>
                  <div style={{ display: 'flex' }}>{summary.rankedRounds.toLocaleString()} rounds behind them</div>
                  <div style={{ display: 'flex' }}>{summary.periods} tournaments rated</div>
                </div>
              ) : null}

              {/* the board */}
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: px(0.9) }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: px(0.75),
                    color: MUTED,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: `${px(0.6)}px 0`,
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <div style={cell(0)}>#</div>
                  <div style={cell(1)}>School</div>
                  <div style={cell(2)}>Partnership</div>
                  <div style={cell(3)}>Rounds</div>
                  <div style={cell(4)}>Rating</div>
                  <div style={cell(5)}>Raw estimate</div>
                  <div style={cell(6)}>XXI rank</div>
                </div>
                {rows.slice(0, 6).map((r, i) => (
                  <div
                    key={r.subjectId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: px(0.875),
                      padding: `${px(0.55)}px 0`,
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={cell(0, { color: MUTED })}>{i + 1}</div>
                    <div style={cell(1, { color: TEXT, paddingRight: 14, overflow: 'hidden', whiteSpace: 'nowrap' })}>
                      {r.school ?? '—'}
                      {/* Satori trims a leading space in a nested span, so the
                          separator is spaced with padding rather than text. */}
                      {r.region ? (
                        <span style={{ color: MUTED, paddingLeft: 6 }}>{`· ${r.region}`}</span>
                      ) : null}
                    </div>
                    <div style={cell(2, { paddingRight: 14, overflow: 'hidden', whiteSpace: 'nowrap' })}>
                      {`${displayName(r.debater1)} & ${displayName(r.debater2)}`}
                    </div>
                    <div style={cell(3, { color: MUTED })}>{r.rounds}</div>
                    <div style={cell(4, { fontWeight: 600 })}>{Math.round(Number(r.shrunk ?? r.rating))}</div>
                    <div style={cell(5)}>
                      {Math.round(Number(r.rating))}
                      <span style={{ color: MUTED, fontSize: px(0.7), paddingLeft: 4 }}>
                        {`± ${Math.round(Number(r.deviation))}`}
                      </span>
                    </div>
                    <div style={cell(6, { color: MUTED })}>{r.pointsRank ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
