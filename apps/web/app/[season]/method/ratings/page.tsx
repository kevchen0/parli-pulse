import { permanentRedirect } from 'next/navigation';

/**
 * Where the rating specification used to live.
 *
 * It was under a season, which said the wrong thing: the method is the same
 * every year and only its measured parameters belong to one. The path has been
 * shared, so it keeps working rather than 404ing at whoever follows an old
 * link.
 *
 * Permanent, unlike `/rankings/*`: that one forwards to whichever season is
 * current and must not be cached, while this destination does not move.
 */
export default function MovedRatingMethod() {
  permanentRedirect('/method#rating');
}
