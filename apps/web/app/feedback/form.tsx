'use client';

import { useState } from 'react';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * The contact form.
 *
 * Name and email are optional. A reader reporting a wrong figure does not need
 * to identify themselves, and requiring it would cost reports from the people
 * least willing to be named, who are often the ones the report is about.
 *
 * The message is stored server-side whether or not the email provider accepts
 * it, so a success here means the message arrived, not that a third party was
 * reachable.
 */
export default function FeedbackForm() {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'That did not send. Please try again.');
        setState('error');
        return;
      }
      setState('sent');
      setMessage('');
      setName('');
      setEmail('');
    } catch {
      setError('That did not send. Check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <p className="sent" role="status">
        Sent. If you left an address I will reply to it.
      </p>
    );
  }

  return (
    <form className="feedbackform" onSubmit={submit}>
      <label htmlFor="fb-message">
        <span className="lbl">Message</span>
        <textarea
          id="fb-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Which page, which figure, and what you think it should be."
        />
      </label>

      <div className="two">
        <label htmlFor="fb-name">
          <span className="lbl">Name <span className="opt">optional</span></span>
          <input
            id="fb-name"
            name="name"
            type="text"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label htmlFor="fb-email">
          <span className="lbl">Email <span className="opt">optional</span></span>
          <input
            id="fb-email"
            name="email"
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
      </div>

      {/* Hidden from people, filled in by anything submitting every field. */}
      <div className="hp" aria-hidden>
        <label htmlFor="fb-website">Website</label>
        <input
          id="fb-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="actions">
        <button type="submit" disabled={state === 'sending' || message.trim().length < 10}>
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <span className="note">A reply needs an address. Without one the report still arrives.</span>
      </div>

      {state === 'error' ? (
        <p className="formerror" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
