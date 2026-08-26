'use client';

import Link from 'next/link';
import { useLinkStatus } from 'next/link';

/**
 * A spinner inside whichever link is currently being waited on.
 *
 * `useLinkStatus` reports the pending state of the nearest enclosing `Link`, so
 * this has to be rendered as its child rather than beside it. Without it a click
 * on a section is silent until the server answers -- the skeleton covers the
 * page body, but the thing the reader actually clicked gives no sign it heard
 * them.
 */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="navspinner" aria-hidden /> : null;
}

/** A link that shows it has been clicked. */
export default function NavLink({
  href,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  return (
    <Link href={href} {...rest}>
      {children}
      <Pending />
    </Link>
  );
}
