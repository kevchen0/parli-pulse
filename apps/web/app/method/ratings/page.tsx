import { permanentRedirect } from 'next/navigation';

/**
 * The rating specification, now a section of the method page.
 *
 * It was a separate page because it was the only method written down. With
 * Article XXI and the speaker figures documented to the same depth, three
 * pages describing one pipeline is a worse structure than one page with three
 * sections -- a reader comparing how the numbers are made had to navigate
 * between them.
 *
 * The path has been shared, so it redirects rather than 404ing.
 */
export default function MovedRatingMethod() {
  permanentRedirect('/method#rating');
}
