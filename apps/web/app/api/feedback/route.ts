import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CONTACT } from '@/lib/contact';
import { dbReady, saveFeedback, recentFeedbackCount } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Longest message accepted. Long enough for a detailed report of a wrong figure. */
const MAX_MESSAGE = 4000;
const MAX_NAME = 120;
const MAX_EMAIL = 200;

/** Messages one sender may send per hour, and per day. */
const PER_HOUR = 3;
const PER_DAY = 10;

/**
 * A stable, non-reversible handle for a sender.
 *
 * The address is hashed with a salt and never stored, because the only thing
 * the form needs is to count submissions from the same origin. Without a salt
 * a hash of an IPv4 address is trivially reversed: the whole space is four
 * billion entries and a laptop enumerates it in minutes.
 *
 * Falls back to a fixed string when no address is present, which makes every
 * such request share one bucket. That is the safe direction to fail: an
 * unidentifiable sender gets the tightest limit rather than none.
 */
function senderHash(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.FEEDBACK_SALT ?? 'parli-pulse-feedback';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Hands the message to an email provider, if one is configured.
 *
 * Returns the failure rather than throwing. A message that is stored but not
 * emailed is a message that still reached us; a submission rejected because a
 * third party was unavailable is a reader turned away, and for a removal
 * request that is the wrong outcome.
 */
async function deliver(
  body: { name: string | null; email: string | null; message: string },
): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'no email provider configured';

  const from = process.env.FEEDBACK_FROM ?? 'Parli Pulse <onboarding@resend.dev>';
  const who = body.name ?? 'someone';
  const reply = body.email ?? undefined;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [CONTACT],
        subject: `Parli Pulse feedback from ${who}`,
        // reply_to only when they gave an address, so hitting reply either
        // reaches them or does nothing, and never reaches a stranger.
        ...(reply ? { reply_to: reply } : {}),
        text: [
          `Name:  ${body.name ?? '(not given)'}`,
          `Email: ${body.email ?? '(not given)'}`,
          '',
          body.message,
        ].join('\n'),
      }),
    });
    if (!res.ok) return `provider returned ${res.status}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'send failed';
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!dbReady()) {
    return NextResponse.json({ error: 'Messages are unavailable right now. Try again shortly.' }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'That message could not be read.' }, { status: 400 });
  }

  // A field hidden from people and filled in by anything that submits every
  // input it finds. Accepted and discarded, so a bot sees success and does not
  // look for the check it failed.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';

  if (message.length < 10) {
    return NextResponse.json(
      { error: 'That message is too short.' },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE || name.length > MAX_NAME || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: 'That message is too long.' }, { status: 400 });
  }
  // Deliberately permissive: the field is optional, and rejecting an unusual
  // but valid address is worse than accepting one that bounces.
  if (email !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That email address is not valid.' }, { status: 400 });
  }

  const sender = senderHash(request);
  const [hour, day] = await Promise.all([
    recentFeedbackCount(sender, '1 hour'),
    recentFeedbackCount(sender, '1 day'),
  ]);
  if (hour >= PER_HOUR || day >= PER_DAY) {
    return NextResponse.json(
      { error: `Too many messages from here recently. Email ${CONTACT} instead.` },
      { status: 429 },
    );
  }

  const row = {
    id: randomUUID(),
    name: name || null,
    email: email || null,
    message,
    senderHash: sender,
  };
  const error = await deliver(row);
  await saveFeedback({ ...row, deliveryError: error, deliveredAt: error ? null : new Date() });

  // Stored either way, so the reader is told it arrived either way.
  return NextResponse.json({ ok: true });
}

export function GET(): NextResponse {
  return NextResponse.json({ error: 'Send a message from the feedback page.' }, { status: 405 });
}
