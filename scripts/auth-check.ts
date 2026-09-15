/**
 * Self-check for the auth logic that must not silently regress: the
 * DEK-possession verifier that closes the unauthenticated recover-takeover
 * hole, and the CORS origin allowlist.
 * Run: `bun run check:auth`
 */
import assert from 'node:assert/strict';
import { applyCors, checkRecoverAuth } from '../api/_lib/http.js';
import { deriveDekVerifier, randomDek } from '../src/crypto.js';
import type { VercelRequest, VercelResponse } from '../api/_lib/vercel.js';

// --- deriveDekVerifier ---------------------------------------------------

const dekA = randomDek();
const dekB = randomDek();

const verifierA1 = await deriveDekVerifier(dekA);
const verifierA2 = await deriveDekVerifier(dekA);
const verifierB = await deriveDekVerifier(dekB);

assert.equal(verifierA1, verifierA2, 'same DEK must yield the same verifier');
assert.notEqual(verifierA1, verifierB, 'different DEKs must yield different verifiers');
assert.match(verifierA1, /^[0-9a-f]{64}$/, 'verifier must be a SHA-256 hex digest');

// --- checkRecoverAuth ------------------------------------------------------

// Legacy account: no stored verifier yet, however plausible the claim looks.
assert.equal(checkRecoverAuth(undefined, verifierA1), 'legacy');

// Wrong verifier — an attacker who only knows the accountId, not the DEK.
assert.equal(checkRecoverAuth(verifierA1, verifierB), 'mismatch');

// Correct verifier — the caller actually unwrapped this account's DEK.
assert.equal(checkRecoverAuth(verifierA1, verifierA1), 'ok');

// --- applyCors --------------------------------------------------------

/** Minimal VercelResponse capturing setHeader calls. */
function stubRes(): VercelResponse & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};

  return {
    headers,
    setHeader: (name, value) => {
      headers[name] = value;
    },
    status: () => stubRes(),
    json: () => undefined,
    end: () => undefined,
  };
}

const stubReq = (origin?: string): VercelRequest => ({
  query: {},
  headers: origin ? { origin } : {},
});

// No ALLOWED_ORIGINS set: only the documented localhost dev default is echoed.
delete process.env.ALLOWED_ORIGINS;
const devRes = stubRes();
applyCors(stubReq('http://localhost:5173'), devRes);
assert.equal(devRes.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');

const foreignRes = stubRes();
applyCors(stubReq('https://evil.example'), foreignRes);
assert.equal(foreignRes.headers['Access-Control-Allow-Origin'], undefined);

// ALLOWED_ORIGINS set: only a listed origin is echoed, never a foreign one.
process.env.ALLOWED_ORIGINS = 'https://journs.app, https://staging.journs.app';
const allowedRes = stubRes();
applyCors(stubReq('https://journs.app'), allowedRes);
assert.equal(allowedRes.headers['Access-Control-Allow-Origin'], 'https://journs.app');

const blockedRes = stubRes();
applyCors(stubReq('https://evil.example'), blockedRes);
assert.equal(blockedRes.headers['Access-Control-Allow-Origin'], undefined);
delete process.env.ALLOWED_ORIGINS;

console.log('auth-check ok');
