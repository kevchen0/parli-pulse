'use client';

/**
 * A superscript that scrolls to its footnote instead of navigating to it.
 *
 * A bare `<a href="#fn2">` works, but it puts `#fn2` in the address bar, so the
 * reader's next Back press returns them to the same page rather than where they
 * came from, and a copied link carries a fragment nobody meant to share. The
 * click is handled instead: prevent the default, scroll the footnote into view,
 * leave the URL alone.
 *
 * Still a real anchor underneath, so the browser's own affordances survive --
 * middle-click, open in a new tab, keyboard focus, and the destination shown on
 * hover. A reader without JavaScript gets the plain jump, which is the correct
 * fallback rather than a dead element.
 */
export default function FootnoteRef({ notes }: { notes: (string | number)[] }) {
  return (
    <sup className="fnref">
      {notes.map((n, i) => (
        <span key={n}>
          {i > 0 ? ' ' : ''}
          <a
            href={`#fn${n}`}
            onClick={(e) => {
              const target = document.getElementById(`fn${n}`);
              if (!target) return; // Let the browser try the jump.
              e.preventDefault();
              const from = window.scrollY;
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Some engines ignore the animation and then do nothing at all,
              // rather than falling back to an instant scroll as the spec says
              // they should -- which would leave the click looking broken. If
              // the page has not moved shortly after, jump instead. Harmless
              // when the footnote was already on screen and nothing needed to.
              setTimeout(() => {
                if (window.scrollY === from) target.scrollIntoView({ block: 'center' });
              }, 250);
            }}
          >
            {n}
          </a>
        </span>
      ))}
    </sup>
  );
}
