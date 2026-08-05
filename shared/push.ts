/** One scheduled reminder, at a fixed hour of the subscriber's local day. */
export interface ReminderSlot {
  hour: number;
  body: string;
}

export const REMINDER_SLOTS: ReminderSlot[] = [
  { hour: 9, body: 'Morning log. Set the day down before it starts.' },
  { hour: 17, body: 'Evening checkpoint. What actually happened?' },
  { hour: 22, body: 'Close the day. Log it before sleep.' },
];

/**
 * How long after the top of the hour a slot still counts as due.
 * Must stay >= the cron cadence or slots get skipped entirely.
 * 15 (not 60) is what makes :30 and :45 offset zones — Asia/Kolkata,
 * Asia/Kathmandu, Pacific/Chatham — fire at :00 local rather than :30 off.
 */
export const WINDOW_MINUTES = 15;

/** Local wall-clock parts for an IANA zone. Intl handles DST for us. */
function localParts(now: Date, timeZone: string): { day: string; hour: number; minute: number } {
  // en-CA yields YYYY-MM-DD, so the day part is sortable and matches dayKey().
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    // Intl can emit hour "24" for midnight in some locales/zones; normalise it.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

/** Dedup key for a slot on the subscriber's local day, or null on a bad zone. */
export function sentKeyFor(now: Date, timeZone: string, hour: number): string | null {
  try {
    return `${localParts(now, timeZone).day}:${hour}`;
  } catch {
    return null;
  }
}

/**
 * Which reminder is due for this subscriber right now, plus the dedup key.
 * Returns null when nothing is due, or when the stored zone is unusable —
 * one bad row must never abort the whole cron sweep.
 */
export function dueSlot(
  now: Date,
  timeZone: string,
): { slot: ReminderSlot; sentKey: string } | null {
  let local: { day: string; hour: number; minute: number };

  try {
    local = localParts(now, timeZone);
  } catch {
    // Intl throws RangeError on an unknown time zone.
    return null;
  }

  if (local.minute >= WINDOW_MINUTES) {
    return null;
  }

  const slot = REMINDER_SLOTS.find((s) => s.hour === local.hour);

  return slot ? { slot, sentKey: `${local.day}:${slot.hour}` } : null;
}
