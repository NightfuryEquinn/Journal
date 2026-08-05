/**
 * Self-check for the two bits of push logic `tsc -b` cannot see:
 * reminder scheduling, and public/sw.js (plain JS, outside the project).
 * Run: `bun run check:push`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dueSlot, REMINDER_SLOTS, sentKeyFor, WINDOW_MINUTES } from '../shared/push.js';

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

// All three slots resolve.
assert.equal(dueSlot(at('2026-08-05T09:00:00Z'), 'UTC')?.slot.hour, 9);
assert.equal(dueSlot(at('2026-08-05T17:00:00Z'), 'UTC')?.slot.hour, 17);
assert.equal(dueSlot(at('2026-08-05T22:00:00Z'), 'UTC')?.slot.hour, 22);

// DST: 09:05 New York is 14:05 UTC in January but 13:05 UTC in July.
assert.equal(dueSlot(at('2026-01-15T14:05:00Z'), 'America/New_York')?.slot.hour, 9);
assert.equal(dueSlot(at('2026-01-15T13:05:00Z'), 'America/New_York'), null);
assert.equal(dueSlot(at('2026-07-15T13:05:00Z'), 'America/New_York')?.slot.hour, 9);
assert.equal(dueSlot(at('2026-07-15T14:05:00Z'), 'America/New_York'), null);

// Local day key follows the local date, not UTC: 22:05 in Auckland (UTC+12)
// on the 5th is 10:05 UTC on the 5th... but on the 6th local for a UTC
// evening. Pin the rollover explicitly.
const nz = dueSlot(at('2026-08-05T10:05:00Z'), 'Pacific/Auckland');
assert.equal(nz?.slot.hour, 22);
assert.equal(nz?.sentKey, '2026-08-05:22');

// Garbage zone must be skipped, not thrown.
assert.equal(dueSlot(at('2026-08-05T09:05:00Z'), 'Not/AZone'), null);
assert.equal(dueSlot(at('2026-08-05T09:05:00Z'), ''), null);

// sentKeyFor (the forced-slot path in the cron) must agree with dueSlot.
assert.equal(sentKeyFor(at('2026-08-05T01:05:00Z'), 'Asia/Kuala_Lumpur', 9), kl?.sentKey);
assert.equal(sentKeyFor(at('2026-08-05T10:05:00Z'), 'Pacific/Auckland', 22), nz?.sentKey);
// ...and it must work outside the window, since that is the whole point.
assert.equal(sentKeyFor(at('2026-08-05T20:47:00Z'), 'UTC', 17), '2026-08-05:17');
assert.equal(sentKeyFor(at('2026-08-05T20:47:00Z'), 'Not/AZone', 17), null);

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

const evening = await firePush({ hour: 22, body: REMINDER_SLOTS[2]!.body });
assert.equal(evening?.title, 'JOURNS');
assert.equal(evening?.options.body, REMINDER_SLOTS[2]!.body);
assert.equal(evening?.options.tag, 'journs-reminder-22');
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
