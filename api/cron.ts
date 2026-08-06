import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from './_lib/vercel.js';
import { dueSlot, REMINDER_SLOTS, sentKeyFor } from '../shared/push.js';
import { settleAura } from '../shared/quests.js';
import { pushSubsCol, questProgressCol } from './_lib/db.js';
import { applyCors, bearerToken, handleOptions, safeEqual, sendError, sendJson } from './_lib/http.js';

/** Settle daily/weekly quests for all users. */
async function runSettle(now: Date) {
  const col = await questProgressCol();
  const cursor = col.find({});
  let scanned = 0;
  let updated = 0;

  for await (const doc of cursor) {
    scanned++;
    const before = {
      aura: doc.aura,
      claimedTags: doc.claimedTags,
      period: doc.period,
      lastSettledAt: doc.lastSettledAt,
    };
    const settled = settleAura(before, now);
    const changed =
      settled.aura !== before.aura ||
      settled.period.dayKey !== before.period.dayKey ||
      settled.period.weekKey !== before.period.weekKey ||
      JSON.stringify(settled.period.dailyDone) !== JSON.stringify(before.period.dailyDone) ||
      JSON.stringify(settled.period.weeklyDone) !== JSON.stringify(before.period.weeklyDone);

    if (changed) {
      await col.updateOne(
        { accountId: doc.accountId },
        { $set: { ...settled, updatedAt: now } },
      );
      updated++;
    }
  }

  return { scanned, updated };
}

/**
 * Fire journal reminders for every subscriber whose local clock just hit a slot.
 * `forcedHour` is the test hook: force a slot so the whole path can be exercised
 * outside 09/12/17/20/23 local. Dedup still applies, so a forced re-run is a no-op.
 */
async function runPush(now: Date, forcedHour: number) {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const forced = REMINDER_SLOTS.find((s) => s.hour === forcedHour) ?? null;
  const col = await pushSubsCol();
  const cursor = col.find({});
  let scanned = 0;
  let sent = 0;
  let pruned = 0;
  let failed = 0;

  for await (const doc of cursor) {
    scanned++;
    let due = dueSlot(now, doc.timeZone);

    if (forced) {
      const sentKey = sentKeyFor(now, doc.timeZone, forced.hour);
      due = sentKey ? { slot: forced, sentKey } : null;
    }

    if (!due || doc.lastSentKey === due.sentKey) {
      continue;
    }

    // Claim before sending: a retried or overlapping cron run cannot
    // double-push. At-most-once beats at-least-once for a nudge.
    const claim = await col.updateOne(
      { endpoint: doc.endpoint, lastSentKey: { $ne: due.sentKey } },
      { $set: { lastSentKey: due.sentKey, updatedAt: now } },
    );

    if (claim.modifiedCount !== 1) {
      continue;
    }

    try {
      await webpush.sendNotification(
        { endpoint: doc.endpoint, keys: doc.keys },
        JSON.stringify({ hour: due.slot.hour, body: due.slot.body }),
        // A reminder landing hours late is noise; let it expire instead.
        { TTL: 3600, urgency: 'normal' },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;

      // 404/410 mean the endpoint is permanently gone — app uninstalled,
      // permission revoked, or the browser rotated it.
      if (status === 404 || status === 410) {
        await col.deleteOne({ endpoint: doc.endpoint });
        pruned++;
      } else {
        console.error('push send failed', status, err);
        failed++;
      }
    }
  }

  return { scanned, sent, pruned, failed };
}

/** Unwrap an allSettled result into the response body. */
function outcome(result: PromiseSettledResult<object>) {
  if (result.status === 'fulfilled') {
    return { ok: true, ...result.value };
  }

  console.error('cron job failed', result.reason);

  return { ok: false, error: String((result.reason as Error)?.message ?? result.reason) };
}

/**
 * Single scheduled entry point: settles quest periods and sends due reminders.
 * Intended to be called only by cron-job.org with CRON_SECRET — not Vercel Cron.
 * Cadence must be at least as often as WINDOW_MINUTES or push slots get skipped.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');

    return;
  }

  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 16) {
    sendError(res, 500, 'CRON_SECRET not configured');

    return;
  }

  if (!safeEqual(bearerToken(req), secret)) {
    sendError(res, 401, 'Unauthorized');

    return;
  }

  const rawHour = req.query.hour;
  const forcedHour = Number(Array.isArray(rawHour) ? rawHour[0] : rawHour);
  const now = new Date();

  // Independent jobs: a Mongo failure in settlement must not swallow reminders.
  const [settle, push] = await Promise.allSettled([runSettle(now), runPush(now, forcedHour)]);
  const body = { settle: outcome(settle), push: outcome(push) };

  applyCors(res);
  sendJson(res, body.settle.ok && body.push.ok ? 200 : 500, {
    ok: body.settle.ok && body.push.ok,
    ...body,
    at: now.toISOString(),
  });
}
