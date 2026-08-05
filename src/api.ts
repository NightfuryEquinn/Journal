import type { JournalEntry, QuestProgress } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

/** Encrypted entry blob as stored on the server. */
export interface EncryptedEntryBlob {
  entryId: string;
  ciphertext: string;
  nonce: string;
  schemaVersion?: number;
  updatedAt?: string;
}

/** Auth response payload from register / login / recover. */
export interface AuthResponse {
  token: string;
  accountId: string;
  salt: string;
  wrappedDekPass: string;
  wrappedDekRecovery: string;
  createdAt?: string;
}

/** Recovery bundle (no auth) for mnemonic unlock. */
export interface RecoveryBundle {
  accountId: string;
  salt: string;
  wrappedDekRecovery: string;
  createdAt: string;
}

/** Failed API response, carrying the HTTP status for callers that branch on it. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Low-level JSON fetch against the Journs API. */
async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;

  if (!res.ok) {
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }

  return data;
}

/** Register a new account. */
export function apiRegister(body: {
  accountId: string;
  salt: string;
  wrappedDekPass: string;
  wrappedDekRecovery: string;
  authVerifier: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Login with account id + auth verifier. */
export function apiLogin(body: {
  accountId: string;
  authVerifier: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Rotate passphrase wraps after recovery. */
export function apiRecover(body: {
  accountId: string;
  salt: string;
  wrappedDekPass: string;
  wrappedDekRecovery: string;
  authVerifier: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Fetch recovery wrap by accountId. */
export function apiFetchBundle(accountId: string): Promise<RecoveryBundle> {
  return apiFetch<RecoveryBundle>(
    `/api/auth/bundle?accountId=${encodeURIComponent(accountId)}`,
  );
}

/** List encrypted entries. */
export function apiListEntries(token: string): Promise<{ entries: EncryptedEntryBlob[] }> {
  return apiFetch('/api/entries', { method: 'GET', token });
}

/** Upsert encrypted entries. */
export function apiPutEntries(
  token: string,
  entries: EncryptedEntryBlob[],
): Promise<{ ok: boolean }> {
  return apiFetch('/api/entries', {
    method: 'PUT',
    token,
    body: JSON.stringify({ entries }),
  });
}

/** Delete one encrypted entry. */
export function apiDeleteEntry(token: string, entryId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/entries/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
    token,
  });
}

/** Fetch quest progress (server may settle). */
export function apiGetProgress(token: string): Promise<{ progress: QuestProgress }> {
  return apiFetch('/api/quests', { method: 'GET', token });
}

/** Persist quest progress. */
export function apiPutProgress(
  token: string,
  progress: QuestProgress,
): Promise<{ progress: QuestProgress }> {
  return apiFetch('/api/quests', {
    method: 'PUT',
    token,
    body: JSON.stringify({ progress }),
  });
}

/** Register a Web Push subscription for this device. */
export function apiSubscribePush(
  token: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  timeZone: string,
): Promise<{ ok: boolean }> {
  return apiFetch('/api/push/subscription', {
    method: 'POST',
    token,
    body: JSON.stringify({ subscription, timeZone }),
  });
}

/** Drop a Web Push subscription. */
export function apiUnsubscribePush(token: string, endpoint: string): Promise<{ ok: boolean }> {
  return apiFetch(
    `/api/push/subscription?endpoint=${encodeURIComponent(endpoint)}`,
    { method: 'DELETE', token },
  );
}

/** Decrypt helper type for sync layer. */
export type DecryptFn = (
  ciphertext: string,
  nonce: string,
) => Promise<JournalEntry>;

/** Encrypt helper type for sync layer. */
export type EncryptFn = (
  entry: JournalEntry,
) => Promise<{ ciphertext: string; nonce: string }>;
