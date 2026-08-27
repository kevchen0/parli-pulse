/**
 * Where a reader reaches a person.
 *
 * One constant rather than the address typed into each page, for the reason
 * the suppression fragment in db.ts is one constant: a thing that has to be
 * remembered at several call sites gets missed at one of them, and the one
 * that matters here is the removal path. If this address ever changes, a page
 * still carrying the old one is a removal request that goes nowhere.
 *
 * A project address rather than a personal one, so it survives whoever is
 * maintaining the site and can be handed on with it. The Privacy page promises
 * a removal route with no expiry date; that promise outlives any one inbox.
 */
export const CONTACT = 'parlipulse@gmail.com';
