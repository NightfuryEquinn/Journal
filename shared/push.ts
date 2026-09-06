/** One scheduled reminder, at a fixed hour of the subscriber's local day. */
export interface ReminderSlot {
  hour: number;
  body: string;
}

/** A notification line in `"quote" — author` form. */
export interface Quote {
  text: string;
  author: string;
}

export const REMINDER_HOURS = [9, 12, 17, 20, 23];

export const QUOTES: Quote[] = [
  { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn' },
  { text: 'An hour of planning can save you ten hours of doing.', author: 'Dale Carnegie' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'Finish each day and be done with it.', author: 'Ralph Waldo Emerson' },
  { text: 'Small disciplines repeated with consistency lead to great achievements.', author: 'John C. Maxwell' },
  { text: 'Write it on your heart that every day is the best day in the year.', author: 'Ralph Waldo Emerson' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
  { text: 'You will never change your life until you change something you do daily.', author: 'John C. Maxwell' },
  { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Begin, be bold, and venture to be wise.', author: 'Horace' },
  { text: 'How we spend our days is, of course, how we spend our lives.', author: 'Annie Dillard' },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: 'We write to taste life twice.', author: 'Anaïs Nin' },
  { text: 'Either write something worth reading or do something worth writing.', author: 'Benjamin Franklin' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'If you wish to be a writer, write.', author: 'Epictetus' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
  { text: 'Little by little, one travels far.', author: 'J.R.R. Tolkien' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'There is no substitute for hard work.', author: 'Thomas Edison' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
  { text: 'A goal without a plan is just a wish.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'What we fear doing most is usually what we most need to do.', author: 'Tim Ferriss' },
  { text: 'Fill your paper with the breathings of your heart.', author: 'William Wordsworth' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: 'The best time to plant a tree was twenty years ago. The second best time is now.', author: 'Chinese proverb' },
  { text: 'Journal writing is a voyage to the interior.', author: 'Christina Baldwin' },
  { text: 'The faintest ink is more powerful than the strongest memory.', author: 'Chinese proverb' },
];

/**
 * How long after the top of the hour a slot still counts as due.
 * Must stay >= the cron cadence or slots get skipped entirely.
 * 15 (not 60) is what makes :30 and :45 offset zones — Asia/Kolkata,
 * Asia/Kathmandu, Pacific/Chatham — fire at :00 local rather than :30 off.
 */
export const WINDOW_MINUTES = 15;

/** Format a quote as `"text" — author`. */
export function formatQuote(quote: Quote): string {
  return `"${quote.text}" — ${quote.author}`;
}

/** Stable 32-bit FNV-1a hash so the same seed always maps to the same quote. */
function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/** Pick a quote from the pool using a stable seed (typically the sentKey). */
export function pickQuote(seed: string): Quote {
  return QUOTES[hashSeed(seed) % QUOTES.length]!;
}

/** Notification body for a given dedup key. */
export function reminderBody(sentKey: string): string {
  return formatQuote(pickQuote(sentKey));
}

/** Hour plus the quote body seeded by the dedup key. */
export function reminderSlot(hour: number, sentKey: string): ReminderSlot {
  return { hour, body: reminderBody(sentKey) };
}

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

  const hour = REMINDER_HOURS.find((slotHour) => slotHour === local.hour);

  if (hour === undefined) {
    return null;
  }

  const sentKey = `${local.day}:${hour}`;

  return { slot: reminderSlot(hour, sentKey), sentKey };
}
