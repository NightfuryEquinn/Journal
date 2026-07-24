import type { VercelRequest, VercelResponse } from '../_lib/vercel';
import { settleAura } from '../../shared/quests';
import { questProgressCol } from '../_lib/db';
import { applyCors, handleOptions, safeEqual, sendError, sendJson } from '../_lib/http';

/**
 * Settle daily/weekly quests for all users.
 * Intended to be called only by cron-job.org with CRON_SECRET — not Vercel Cron.
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

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!safeEqual(token, secret)) {
    sendError(res, 401, 'Unauthorized');

    return;
  }

  const col = await questProgressCol();
  const cursor = col.find({});
  let scanned = 0;
  let updated = 0;
  const now = new Date();

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

  applyCors(res);
  sendJson(res, 200, { ok: true, scanned, updated, at: now.toISOString() });
}
