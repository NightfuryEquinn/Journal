import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getDb } from '../api/_lib/db';
import { handleApiRequest } from './api-router';

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

/** Convert a Connect IncomingMessage into a Fetch Request. */
async function toWebRequest(req: IncomingMessage, absoluteUrl: string): Promise<Request> {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }

    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const method = req.method || 'GET';
  const init: RequestInit = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    const body = await readBody(req);

    if (body.length > 0) {
      init.body = body;
    }
  }

  return new Request(absoluteUrl, init);
}

/** Write a Fetch Response onto a Node ServerResponse. */
async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') {
      return;
    }

    res.setHeader(key, value);
  });

  if (response.status === 204) {
    res.end();

    return;
  }

  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

/**
 * Vite plugin: serve `/api/*` in-process during `vite` / `vite preview` (middleware mode).
 */
export function journsApiPlugin(): Plugin {
  return {
    name: 'journs-api',
    configureServer(server) {
      let ready: Promise<void> | null = null;

      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';

        // Only real HTTP API routes — never Vite modules under /api/_lib, etc.
        if (!/^\/api\/(auth|entries|quests|cron)(\/|$)/.test(path)) {
          next();

          return;
        }

        try {
          if (!ready) {
            ready = getDb().then(() => {
              server.config.logger.info('[journs-api] Mongo connected · /api in-process');
            });
          }

          await ready;

          const host = req.headers.host || 'localhost';
          const absoluteUrl = `http://${host}${req.url}`;
          const webReq = await toWebRequest(req, absoluteUrl);
          const webRes = await handleApiRequest(webReq);
          await writeWebResponse(res, webRes);
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
