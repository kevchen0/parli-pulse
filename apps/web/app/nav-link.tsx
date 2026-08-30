'use client';

import Link from 'next/link';
import { useLinkStatus } from 'next/link';

/**
 * A spinner inside whichever link is currently being waited on.
 *
 * `useLinkStatus` reports the pending state of the nearest enclosing `Link`, so
 * this has to be rendered as its child rather than beside it. It carries the
 * whole signal now: the boards no longer swap themselves for a placeholder on a
 * click, so between the click and the server answering, this spinner is the only
 * thing that moves.
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
