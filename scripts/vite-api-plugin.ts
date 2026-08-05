import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getDb } from '../api/_lib/db.js';
import type { VercelRequest, VercelResponse } from '../api/_lib/vercel.js';
import registerHandler from '../api/auth/register.js';
import loginHandler from '../api/auth/login.js';
import recoverHandler from '../api/auth/recover.js';
import bundleHandler from '../api/auth/bundle.js';
import entriesHandler from '../api/entries/index.js';
import entryByIdHandler from '../api/entries/[id].js';
import questsHandler from '../api/quests.js';
import cronHandler from '../api/cron.js';
import pushSubscriptionHandler from '../api/push/subscription.js';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

const ROUTES: Record<string, Handler> = {
  '/api/auth/register': registerHandler,
  '/api/auth/login': loginHandler,
  '/api/auth/recover': recoverHandler,
  '/api/auth/bundle': bundleHandler,
  '/api/entries': entriesHandler,
  '/api/quests': questsHandler,
  '/api/cron': cronHandler,
  '/api/push/subscription': pushSubscriptionHandler,
};

/** Buffer the Node request body. */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/** Build the VercelRequest shape Vercel hands to a serverless function. */
async function toVercelRequest(
  req: IncomingMessage,
  url: URL,
  params: Record<string, string>,
): Promise<VercelRequest> {
  const query: Record<string, string | string[]> = { ...params };

  for (const key of url.searchParams.keys()) {
    const all = url.searchParams.getAll(key);
    query[key] = all.length > 1 ? all : all[0]!;
  }

  const method = req.method || 'GET';
  let body: unknown;

  if (method !== 'GET' && method !== 'HEAD') {
    const raw = await readBody(req);

    if (raw.length > 0) {
      // Vercel pre-parses JSON bodies; mirror that so handlers see an object.
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        body = raw.toString('utf8');
      }
    }
  }

  return { method, body, query, headers: req.headers };
}

/** Adapt a Node ServerResponse to the VercelResponse shape. */
function toVercelResponse(res: ServerResponse): VercelResponse {
  const adapter: VercelResponse = {
    status(code) {
      res.statusCode = code;

      return adapter;
    },
    json(payload) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    },
    end() {
      res.end();
    },
    setHeader(name, value) {
      res.setHeader(name, value);
    },
  };

  return adapter;
}

/**
 * Vite plugin: serve `/api/*` in-process during `vite` by invoking the same
 * handlers Vercel deploys, so local dev and production cannot drift.
 */
export function journsApiPlugin(): Plugin {
  return {
    name: 'journs-api',
    configureServer(server) {
      let ready: Promise<void> | null = null;

      server.middlewares.use(async (req, res, next) => {
        const host = req.headers.host || 'localhost';
        const url = new URL(req.url ?? '/', `http://${host}`);
        const { pathname } = url;

        // Only real HTTP API routes — never Vite modules under /api/_lib, etc.
        if (!/^\/api\/(auth|entries|quests|cron|push)(\/|$)/.test(pathname)) {
          next();

          return;
        }

        const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);
        const handler = entryMatch ? entryByIdHandler : ROUTES[pathname];

        if (!handler) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not found' }));

          return;
        }

        try {
          if (!ready) {
            ready = getDb().then(() => {
              server.config.logger.info('[journs-api] Mongo connected · /api in-process');
            });
          }

          await ready;

          const params: Record<string, string> = entryMatch
            ? { id: decodeURIComponent(entryMatch[1]!) }
            : {};
          await handler(await toVercelRequest(req, url, params), toVercelResponse(res));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Server error',
            }),
          );
        }
      });
    },
  };
}
