/**
 * Self-check for the two bits of push logic `tsc -b` cannot see:
 * reminder scheduling, and public/sw.js (plain JS, outside the project).
 * Run: `bun run check:push`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dueSlot,
  formatQuote,
  pickQuote,
  QUOTES,
  reminderBody,
  REMINDER_HOURS,
  sentKeyFor,
  WINDOW_MINUTES,
} from '../shared/push.js';

const at = (iso: string) => new Date(iso);

// 09:05 in Kuala Lumpur (UTC+8) is 01:05 UTC.
const kl = dueSlot(at('2026-08-05T01:05:00Z'), 'Asia/Kuala_Lumpur');
assert.equal(kl?.slot.hour, 9);
assert.equal(kl?.sentKey, '2026-08-05:9');

// Same instant is 01:05 UTC — no slot there.
assert.equal(dueSlot(at('2026-08-05T01:05:00Z'), 'UTC'), null);

// Half-hour zone: 09:05 IST is 03:35 UTC. This is the case a whole-hour
// window would fire 30 minutes late for.
assert.equal(dueSlot(at('2026-08-05T03:35:00Z'), 'Asia/Kolkata')?.slot.hour, 9);

// Three-quarter-hour zone: 17:05 NPT is 11:20 UTC.
assert.equal(dueSlot(at('2026-08-05T11:20:00Z'), 'Asia/Kathmandu')?.slot.hour, 17);

// Past the window: 09:20 local is too late.
assert.equal(dueSlot(at('2026-08-05T01:20:00Z'), 'Asia/Kuala_Lumpur'), null);
assert.equal(WINDOW_MINUTES, 15);

// Right hour, wrong hour-of-day.
assert.equal(dueSlot(at('2026-08-05T00:05:00Z'), 'Asia/Kuala_Lumpur'), null);

// All five slots resolve.
assert.deepEqual(REMINDER_HOURS, [9, 12, 17, 20, 23]);
assert.equal(dueSlot(at('2026-08-05T09:00:00Z'), 'UTC')?.slot.hour, 9);
assert.equal(dueSlot(at('2026-08-05T12:00:00Z'), 'UTC')?.slot.hour, 12);
assert.equal(dueSlot(at('2026-08-05T17:00:00Z'), 'UTC')?.slot.hour, 17);
assert.equal(dueSlot(at('2026-08-05T20:00:00Z'), 'UTC')?.slot.hour, 20);
assert.equal(dueSlot(at('2026-08-05T23:00:00Z'), 'UTC')?.slot.hour, 23);

// DST: 09:05 New York is 14:05 UTC in January but 13:05 UTC in July.
assert.equal(dueSlot(at('2026-01-15T14:05:00Z'), 'America/New_York')?.slot.hour, 9);
assert.equal(dueSlot(at('2026-01-15T13:05:00Z'), 'America/New_York'), null);
assert.equal(dueSlot(at('2026-07-15T13:05:00Z'), 'America/New_York')?.slot.hour, 9);
assert.equal(dueSlot(at('2026-07-15T14:05:00Z'), 'America/New_York'), null);

// Local day key follows the local date, not UTC: 23:05 in Auckland (UTC+12)
// on the 5th is 11:05 UTC on the 5th... but on the 6th local for a UTC
// evening. Pin the rollover explicitly.
const nz = dueSlot(at('2026-08-05T11:05:00Z'), 'Pacific/Auckland');
assert.equal(nz?.slot.hour, 23);
assert.equal(nz?.sentKey, '2026-08-05:23');

// Garbage zone must be skipped, not thrown.
assert.equal(dueSlot(at('2026-08-05T09:05:00Z'), 'Not/AZone'), null);
assert.equal(dueSlot(at('2026-08-05T09:05:00Z'), ''), null);

// sentKeyFor (the forced-slot path in the cron) must agree with dueSlot.
assert.equal(sentKeyFor(at('2026-08-05T01:05:00Z'), 'Asia/Kuala_Lumpur', 9), kl?.sentKey);
assert.equal(sentKeyFor(at('2026-08-05T11:05:00Z'), 'Pacific/Auckland', 23), nz?.sentKey);
// ...and it must work outside the window, since that is the whole point.
assert.equal(sentKeyFor(at('2026-08-05T20:47:00Z'), 'UTC', 17), '2026-08-05:17');
assert.equal(sentKeyFor(at('2026-08-05T20:47:00Z'), 'Not/AZone', 17), null);

// Quote copy is always `"text" — author`, never bound to a clock hour.
assert.equal(
  formatQuote({ text: 'Finish each day and be done with it.', author: 'Ralph Waldo Emerson' }),
  '"Finish each day and be done with it." — Ralph Waldo Emerson',
);
assert.equal(QUOTES.length > REMINDER_HOURS.length, true, 'quote pool must outgrow the slot list');
assert.equal(QUOTES.length, 46);

for (const quote of QUOTES) {
  assert.equal(quote.text.includes('"'), false, `quote text must not contain quotes: ${quote.text}`);
  assert.match(formatQuote(quote), /^".+" — .+$/);
}

assert.equal(
  new Set(QUOTES.map((quote) => `${quote.text}\0${quote.author}`)).size,
  QUOTES.length,
  'quote pool must not contain duplicates',
);

assert.equal(pickQuote('2026-08-05:9'), pickQuote('2026-08-05:9'));
assert.equal(reminderBody('2026-08-05:9'), formatQuote(pickQuote('2026-08-05:9')));

// A due slot's body is whatever the seed picks that day, not a hardcoded hour line.
const morning = dueSlot(at('2026-08-05T09:00:00Z'), 'UTC');
assert.equal(morning?.slot.body, reminderBody(morning!.sentKey));
assert.match(morning!.slot.body, /^".+" — .+$/);

const nextMorning = dueSlot(at('2026-08-06T09:00:00Z'), 'UTC');
assert.equal(nextMorning?.slot.hour, 9);
assert.equal(nextMorning?.slot.body, reminderBody(nextMorning!.sentKey));

const distinctBodies = new Set(
  ['2026-08-05:9', '2026-08-06:9', '2026-08-07:9', '2026-08-08:9', '2026-08-09:9'].map(reminderBody),
);
assert.equal(distinctBodies.size > 1, true, 'quote pool must rotate across days');

// --- public/sw.js -------------------------------------------------------
// Loaded into a stub `self` so the push and click handlers can be fired
// without a browser. Nothing else covers this file.

type SwHandler = (event: unknown) => void;
const handlers: Record<string, SwHandler> = {};
const shown: { title: string; options: Record<string, unknown> }[] = [];
let windowClients: { url: string; focus: () => Promise<void> }[] = [];
let openedUrl: string | null = null;

const selfStub = {
  location: { origin: 'https://journs.test' },
  addEventListener: (type: string, fn: SwHandler) => {
    handlers[type] = fn;
  },
  skipWaiting: () => undefined,
  registration: {
    showNotification: (title: string, options: Record<string, unknown>) => {
      shown.push({ title, options });

      return Promise.resolve();
    },
  },
  clients: {
    claim: () => Promise.resolve(),
    matchAll: () => Promise.resolve(windowClients),
    openWindow: (url: string) => {
      openedUrl = url;

      return Promise.resolve(null);
    },
  },
};

const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
new Function('self', 'URL', swSource)(selfStub, URL);

assert.ok(handlers.push, 'sw.js registered no push handler');
assert.ok(handlers.notificationclick, 'sw.js registered no notificationclick handler');

/** Fire a synthetic push event; pass undefined for a payload-less wake-up. */
async function firePush(data: unknown) {
  shown.length = 0;
  const waits: Promise<unknown>[] = [];
  handlers.push!({
    data: {
      json: () => {
        if (data === undefined) {
          throw new Error('no payload');
        }

        return data;
      },
    },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  await Promise.all(waits);

  return shown[0];
}

const eveningBody = reminderBody('2026-08-05:23');
const evening = await firePush({ hour: 23, body: eveningBody });
assert.equal(evening?.title, 'Adjourn to Journ');
assert.equal(evening?.options.body, eveningBody);
assert.equal(evening?.options.tag, 'journs-reminder-23');
assert.deepEqual(evening?.options.data, { url: '/' });

// Distinct slots must not collapse onto one another's tag.
assert.equal((await firePush({ hour: 9, body: 'x' }))?.options.tag, 'journs-reminder-9');

// A payload-less wake-up must still show something rather than throw —
// otherwise the browser shows its own "site updated in background" notice.
assert.equal((await firePush(undefined))?.options.body, 'Time to log.');

/** Fire a synthetic notification click; returns whether it was closed. */
async function fireClick() {
  const waits: Promise<unknown>[] = [];
  let closed = false;
  handlers.notificationclick!({
    notification: {
      close: () => {
        closed = true;
      },
    },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  await Promise.all(waits);

  return closed;
}

// An already-open tab is focused, never duplicated.
let didFocus = false;
windowClients = [
  {
    url: 'https://journs.test/',
    focus: async () => {
      didFocus = true;
    },
  },
];
openedUrl = null;
assert.equal(await fireClick(), true, 'notification was not closed');
assert.equal(didFocus, true, 'existing tab was not focused');
assert.equal(openedUrl, null, 'opened a duplicate window');

// With nothing open, a new window is created.
windowClients = [];
assert.equal(await fireClick(), true);
assert.equal(openedUrl, '/');

console.log('push-check ok');
