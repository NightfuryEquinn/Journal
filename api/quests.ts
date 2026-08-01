import type { VercelRequest, VercelResponse } from './_lib/vercel.js';
import { settleAura } from '../shared/quests.js';
import { questProgressSchema } from './_lib/schemas.js';
import { questProgressCol, touchActive } from './_lib/db.js';
import { handleOptions, sendError, sendJson, verifySession } from './_lib/http.js';

/** Fetch or replace quest progress for the authenticated account. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  const accountId = await verifySession(req);

  if (!accountId) {
    sendError(res, 401, 'Unauthorized');

    return;
  }

  const col = await questProgressCol();

  if (req.method === 'GET') {
    const doc = await col.findOne({ accountId });

    if (!doc) {
      sendError(res, 404, 'Progress not found');

      return;
    }

    const settled = settleAura({
      aura: doc.aura,
      claimedTags: doc.claimedTags,
      period: doc.period,
      lastSettledAt: doc.lastSettledAt,
    });

    if (
      settled.aura !== doc.aura ||
      settled.period.dayKey !== doc.period.dayKey ||
      settled.period.weekKey !== doc.period.weekKey ||
      settled.lastSettledAt !== doc.lastSettledAt
    ) {
      const now = new Date();
      await col.updateOne(
        { accountId },
        { $set: { ...settled, updatedAt: now } },
      );
    }

    await touchActive(accountId);
    sendJson(res, 200, { progress: settled });

    return;
  }

  if (req.method === 'PUT') {
    const parsed = questProgressSchema.safeParse(req.body?.progress ?? req.body);

    if (!parsed.success) {
      sendError(res, 400, 'Invalid progress body');

      return;
    }

    const progress = settleAura(parsed.data);
    const now = new Date();

    await col.updateOne(
      { accountId },
      {
        $set: {
          accountId,
          ...progress,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    await touchActive(accountId);
    sendJson(res, 200, { progress });

    return;
  }

  sendError(res, 405, 'Method not allowed');
}
