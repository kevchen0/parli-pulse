import type { MetadataRoute } from 'next';

/**
 * Search engines are excluded; link-preview bots are not.
 *
 * These do different things. A search crawler builds an index, so a debater's
 * name becomes a result for anyone who searches that name for any reason. A
 * preview bot fetches one page because somebody deliberately pasted its link,
 * and renders a card in that conversation. Blocking the first is the privacy
 * decision; blocking the second only means a link somebody chose to share looks
 * broken.
 *
 * Debater profiles stay closed to both. A card naming one person, generated
 * from a link, is the same exposure this exists to avoid.
 *
 * `noindex` in the root layout is unaffected and still covers everything, so a
 * preview bot that also indexes is told not to.
 */
const PREVIEW_BOTS = [
  'LinkedInBot',
  'Twitterbot',
  'facebookexternalhit',
  'Slackbot-LinkExpanding',
  'Discordbot',
  'WhatsApp',
  'TelegramBot',
  'redditbot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...PREVIEW_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: '/*/debater/',
      })),
      { userAgent: '*', disallow: '/' },
    ],
  };
}
