import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { pushSubscribeBodySchema, pushUnsubscribeBodySchema } from '../_lib/schemas.js';
import { pushSubsCol, touchActive } from '../_lib/db.js';
import { handleOptions, sendError, sendJson, verifySession } from '../_lib/http.js';

/** Register or drop a Web Push subscription for the authenticated account. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  const accountId = await verifySession(req);

  if (!accountId) {
    sendError(res, 401, 'Unauthorized');

    return;
  }

  const col = await pushSubsCol();

  if (req.method === 'POST') {
    const parsed = pushSubscribeBodySchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, 'Invalid subscription body');

      return;
    }

    const { subscription, timeZone } = parsed.data;
    const now = new Date();

    // Keyed on endpoint, not accountId: one account can have several devices,
    // and re-subscribing the same device must be idempotent.
    await col.updateOne(
      { endpoint: subscription.endpoint },
      {
        $set: {
          accountId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          timeZone,
          updatedAt: now,
        },
        $setOnInsert: { lastSentKey: null, createdAt: now },
      },
      { upsert: true },
    );

    await touchActive(accountId);
    sendJson(res, 200, { ok: true });

    return;
  }

  if (req.method === 'DELETE') {
    const raw = req.query.endpoint;
    const parsed = pushUnsubscribeBodySchema.safeParse({
      endpoint: Array.isArray(raw) ? raw[0] : raw,
    });

    if (!parsed.success) {
      sendError(res, 400, 'Invalid endpoint');

      return;
    }

    // Scoped by accountId so one account cannot drop another's subscription.
    const { deletedCount } = await col.deleteOne({
      endpoint: parsed.data.endpoint,
      accountId,
    });

    sendJson(res, 200, { ok: true, deleted: deletedCount });

    return;
  }

  sendError(res, 405, 'Method not allowed');
}
