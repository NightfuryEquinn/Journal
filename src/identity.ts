import type { DeviceIdentity } from './types';
import {
  createAccountSecrets,
  deriveAccountId,
  deriveAuthVerifier,
  deriveDekVerifier,
  derivePassKek,
  deriveRecoveryKek,
  mnemonicSeed,
  operatorCallsign,
  rotatePassphraseSecrets,
  unwrapKey,
  validateRecoveryWords,
  type AccountSecrets,
} from './crypto';
import {
  ApiError,
  apiFetchBundle,
  apiLogin,
  apiRecover,
  apiRegister,
  apiSetDekVerifier,
  type AuthResponse,
} from './api';
import { clearFaceId, faceIdPassKek } from './faceid';

const IDENTITY_KEY = 'journs.identity.v1';
const LEGACY_ENTRIES_KEY = 'journs.entries.v1';
const LEGACY_MERIDIAN_KEY = 'meridian.entries.v1';
const LEGACY_PROGRESS_KEY = 'journs.progress.v1';

export { generateRecoveryPhrase } from './crypto';

/** Active session: JWT + in-memory DEK + passphrase KEK (never persisted). */
export interface AuthSession {
  token: string;
  dek: Uint8Array;
  /** Wraps the DEK; kept in memory so Profile can enroll Face ID without re-asking the passphrase. */
  passKek: Uint8Array;
  identity: DeviceIdentity;
}

/** Load persisted device identity, or null if none. */
export function loadIdentity(): DeviceIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as DeviceIdentity & { wrappedDekPass?: string };

    if (!parsed.accountId || !parsed.salt) {
      return null;
    }

    // Older builds cached wrappedDekPass here — a wrapped-DEK oracle sitting
    // in localStorage enables offline passphrase brute-force. Strip it from
    // any device that still has it.
    if ('wrappedDekPass' in parsed) {
      const { wrappedDekPass: _drop, ...clean } = parsed;
      saveIdentity(clean);

      return clean;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** Persist device identity to localStorage (no DEK / passphrase). */
function saveIdentity(identity: DeviceIdentity): void {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

/**
 * Ask the browser to exempt this origin from storage eviction. Losing the
 * identity drops the device back to a 12-word recovery, and script-written
 * localStorage is evictable by default — Safari caps it at seven days without
 * interaction. Best effort only: Firefox prompts, Chrome decides on engagement
 * heuristics, and a browser may refuse or not implement it at all.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist || !navigator.storage.persisted) {
      return false;
    }

    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** Build DeviceIdentity from an auth response. */
function identityFromAuth(auth: AuthResponse, createdAt?: string): DeviceIdentity {
  return {
    accountId: auth.accountId,
    operatorId: operatorCallsign(auth.accountId),
    salt: auth.salt,
    createdAt: createdAt ?? auth.createdAt ?? new Date().toISOString(),
  };
}

/** Register on the server and return a live session. */
export async function registerAccount(words: string[], passphrase: string): Promise<AuthSession> {
  const err = validateRecoveryWords(words);

  if (err) {
    throw new Error(err);
  }

  const secrets = await createAccountSecrets(words, passphrase);
  const auth = await apiRegister({
    accountId: secrets.accountId,
    salt: secrets.salt,
    wrappedDekPass: secrets.wrappedDekPass,
    wrappedDekRecovery: secrets.wrappedDekRecovery,
    authVerifier: secrets.authVerifier,
    dekVerifier: secrets.dekVerifier,
  });
  const identity = identityFromAuth(auth);
  saveIdentity(identity);

  return { token: auth.token, dek: secrets.dek, passKek: secrets.passKek, identity };
}

/**
 * The passphrase did not unwrap the DEK under the salt we tried. Either the
 * passphrase is wrong or the salt is stale — only the server can say which.
 */
class SaltMismatchError extends Error {}

/**
 * Whether an error from sessionFromPassKek means "this key is wrong" — a 401
 * from apiLogin, or a DOMException from unwrapKey's AES-GCM tag check — as
 * opposed to a network/server error that should propagate as-is.
 */
function isWrongKeyError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 401;
  }

  return err instanceof DOMException;
}

/**
 * Log in with an already-derived passKek (from a passphrase, or unwrapped via
 * Face ID), unwrap the DEK, and persist the resulting identity. Throws
 * ApiError(401) on a wrong/stale passKek — callers decide what that means.
 */
async function sessionFromPassKek(
  identity: DeviceIdentity,
  passKek: Uint8Array,
): Promise<AuthSession> {
  const authVerifier = await deriveAuthVerifier(passKek);
  const auth = await apiLogin({ accountId: identity.accountId, authVerifier });
  const dek = await unwrapKey(passKek, auth.wrappedDekPass);

  if (auth.needsDekVerifier) {
    // Legacy account predating the recovery-takeover fix — backfill now that
    // a passphrase login just proved DEK possession. Best-effort: a failure
    // here just means recover.ts asks again next time, not a broken login.
    try {
      await apiSetDekVerifier(auth.token, await deriveDekVerifier(dek));
    } catch {
      // Ignored — see comment above.
    }
  }

  const next = identityFromAuth(auth, identity.createdAt);
  saveIdentity(next);

  return { token: auth.token, dek, passKek, identity: next };
}

/** Derive under one salt and exchange the verifier for a session. */
async function unlockWithSalt(
  identity: DeviceIdentity,
  passphrase: string,
  salt: string,
): Promise<AuthSession> {
  const passKek = await derivePassKek(passphrase, salt);

  try {
    return await sessionFromPassKek(identity, passKek);
  } catch (err) {
    if (isWrongKeyError(err)) {
      throw new SaltMismatchError();
    }

    throw err;
  }
}

/**
 * Unlock via platform passkey (Face ID / Touch ID / Windows Hello). The
 * server is never told this happened — it just sees a normal passphrase-KEK
 * login, because Face ID only unwraps the same passKek the passphrase would.
 */
export async function unlockWithFaceId(identity: DeviceIdentity): Promise<AuthSession> {
  const passKek = await faceIdPassKek(identity.accountId);

  try {
    return await sessionFromPassKek(identity, passKek);
  } catch (err) {
    // A stale wrap (passphrase rotated elsewhere since enrollment, so this
    // passKek no longer matches the server's salt/wraps) can't be retried —
    // drop the local enrollment and send the user back to the passphrase.
    if (isWrongKeyError(err)) {
      clearFaceId();
      throw new Error('Face ID is out of date — unlock with your passphrase once.', { cause: err });
    }

    throw err;
  }
}

/**
 * Unlock an existing device identity with passphrase.
 *
 * Recovery rotates the salt server-side, so a device that sat out the recovery
 * holds a salt that can no longer derive the KEK. On mismatch we re-read the
 * live salt (public material) and retry once, which re-syncs this device
 * instead of forcing the user through recovery again.
 */
export async function unlockAccount(
  identity: DeviceIdentity,
  passphrase: string,
): Promise<AuthSession> {
  try {
    return await unlockWithSalt(identity, passphrase, identity.salt);
  } catch (err) {
    if (!(err instanceof SaltMismatchError)) {
      throw err;
    }
  }

  const bundle = await apiFetchBundle(identity.accountId);

  if (bundle.salt === identity.salt) {
    throw new Error('Bad passphrase');
  }

  try {
    return await unlockWithSalt(identity, passphrase, bundle.salt);
  } catch (err) {
    if (err instanceof SaltMismatchError) {
      throw new Error('Bad passphrase', { cause: err });
    }

    throw err;
  }
}

/** Recover with mnemonic: unwrap DEK, set new passphrase, rotate server wraps. */
export async function recoverAccount(words: string[], newPassphrase: string): Promise<AuthSession> {
  const err = validateRecoveryWords(words);

  if (err) {
    throw new Error(err);
  }

  const seed = await mnemonicSeed(words);
  const accountId = await deriveAccountId(seed);
  const bundle = await apiFetchBundle(accountId);
  const recoveryKek = await deriveRecoveryKek(seed);
  let dek: Uint8Array;

  try {
    dek = await unwrapKey(recoveryKek, bundle.wrappedDekRecovery);
  } catch {
    throw new Error('Recovery phrase does not unlock this account.');
  }

  const secrets: AccountSecrets = await rotatePassphraseSecrets(words, newPassphrase, dek);
  const auth = await apiRecover({
    accountId: secrets.accountId,
    salt: secrets.salt,
    wrappedDekPass: secrets.wrappedDekPass,
    wrappedDekRecovery: secrets.wrappedDekRecovery,
    authVerifier: secrets.authVerifier,
    dekVerifier: secrets.dekVerifier,
  });
  const identity = identityFromAuth(auth, bundle.createdAt);
  saveIdentity(identity);

  return { token: auth.token, dek: secrets.dek, passKek: secrets.passKek, identity };
}

/** Clear legacy plaintext localStorage keys (no longer used; source of truth is Atlas). */
export function clearLegacyLocalData(): void {
  localStorage.removeItem(LEGACY_ENTRIES_KEY);
  localStorage.removeItem(LEGACY_MERIDIAN_KEY);
  localStorage.removeItem(LEGACY_PROGRESS_KEY);
}
