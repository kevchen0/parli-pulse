'use client';

import { useEffect } from 'react';

/**
 * A search field over the table below it.
 *
 * Filters as you type. The board it sits above holds the query, filters its own
 * rows against it and passes back how many are left, so the field is the same
 * control on every board and each board keeps its own idea of what a row
 * matches -- a partnership matches on either debater, a school on its region.
 *
 * The query is written back to `?q=` with `replaceState` rather than a
 * navigation. A search stays shareable and survives a reload, which is what the
 * form this replaced was for, without a round trip to the server between one
 * keystroke and the next.
 */
export default function TableSearch({
  value,
  onChange,
  placeholder,
  shown,
  total,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Rows left after the current query. */
  shown: number;
  /** Rows there are altogether. */
  total: number;
}) {
  const query = value.trim();

  useEffect(() => {
    // Debounced: replaceState on every keystroke fills nothing up, but the URL
    // rewriting itself mid-word is visible and the address bar flickers.
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set('q', query);
      else url.searchParams.delete('q');
      window.history.replaceState(null, '', url);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="tablesearch">
      <svg className="searchicon" viewBox="0 0 16 16" aria-hidden focusable="false">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10.4" y1="10.4" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {/* autoComplete off: the browser would otherwise remember every search
          and offer them back on the next visit. Those are other people's names,
          and a shared school computer should not hand the last person's search
          to the next one. */}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
      />
      {/* Only while searching. Idle, it would repeat the count the meta line
          above the table already gives. */}
      <span className="searchcount" role="status">
        {query ? `${shown} of ${total}` : ''}
      </span>
    </div>
  );
}
