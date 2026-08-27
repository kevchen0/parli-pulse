import type { MetadataRoute } from 'next';

/**
 * Nothing is indexed while the site is being shown around.
 *
 * The pages name minors. Most of what they say is already on Tabroom, but a
 * search result is a different kind of exposure from a page someone navigated
 * to: it puts a debater's name and record in front of anyone who searches the
 * name for any reason at all. That is a decision to make deliberately rather
 * than by leaving the default in place, and the default is to allow.
 *
 * This blocks the whole site rather than the profile pages alone, because
 * during a demo the audience is people who were given the link.
 *
 * Reversing it is one file. If it is ever relaxed, `/<season>/debater/*` is
 * the part to keep disallowed, and the Privacy page has to say so first.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
