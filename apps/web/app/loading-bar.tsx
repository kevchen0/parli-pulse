/**
 * A bar where content is about to appear.
 *
 * Not a skeleton. A skeleton has to invent a width for every cell it draws, and
 * those widths are guesses: they do not fall where the real figures fall, so the
 * table appears to shift as it fills and the reader spends the wait reading a
 * diagram of a page that never existed. This says the one thing that is actually
 * known -- something is coming -- and says nothing else.
 *
 * The boards have no `loading.tsx`, so clicking a section leaves the table you
 * are on up, with the spinner in the link you clicked, until the next one is
 * ready. This is for the cold load: the heading and the lede stream first, and
 * the bar holds the place of the rows.
 */
export default function LoadingBar({ label = 'Loading' }: { label?: string }) {
  return (
    <p className="loading" role="status" aria-live="polite">
      <span className="loadingtrack" aria-hidden />
      {/* Shown rather than hidden where motion is off, since a bar that cannot
          move has no way to say it is working. */}
      <span className="sr-only">{label}</span>
    </p>
  );
}
