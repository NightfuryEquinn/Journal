import type { DeviceIdentity } from './types';
import {
  createAccountSecrets,
  deriveAccountId,
  deriveAuthVerifier,
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
  type AuthResponse,
} from './api';

export const IDENTITY_KEY = 'journs.identity.v1';
export const LEGACY_ENTRIES_KEY = 'journs.entries.v1';
export const LEGACY_MERIDIAN_KEY = 'meridian.entries.v1';
export const LEGACY_PROGRESS_KEY = 'journs.progress.v1';

export {
  generateRecoveryPhrase,
  normalizePhrase,
  phraseToString,
  validateRecoveryWords,
} from './crypto';

/** Active session: JWT + in-memory DEK (never persisted). */
export interface AuthSession {
  token: string;
  dek: Uint8Array;
  identity: DeviceIdentity;
}

/** Load persisted device identity, or null if none. */
export function loadIdentity(): DeviceIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as DeviceIdentity;

    if (!parsed.accountId || !parsed.salt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** Persist device identity to localStorage (no DEK / passphrase). */
export function saveIdentity(identity: DeviceIdentity): void {
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

/** Build DeviceIdentity from auth response + local verifier cache. */
function identityFromAuth(
  auth: AuthResponse,
  authVerifier: string,
  createdAt?: string,
): DeviceIdentity {
  return {
    accountId: auth.accountId,
    operatorId: operatorCallsign(auth.accountId),
    salt: auth.salt,
    wrappedDekPass: auth.wrappedDekPass,
    authVerifier,
    createdAt: createdAt ?? auth.createdAt ?? new Date().toISOString(),
  };
}

/** Register on the server and return a live session. */
export async function registerAccount(
  words: string[],
  passphrase: string,
): Promise<AuthSession> {
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
  });
  const identity = identityFromAuth(auth, secrets.authVerifier);
  saveIdentity(identity);

  return { token: auth.token, dek: secrets.dek, identity };
}

/**
 * The passphrase did not unwrap the DEK under the salt we tried. Either the
 * passphrase is wrong or the salt is stale — only the server can say which.
 */
class SaltMismatchError extends Error {}

/** Derive under one salt and exchange the verifier for a session. */
async function unlockWithSalt(
  identity: DeviceIdentity,
  passphrase: string,
  salt: string,
): Promise<AuthSession> {
  const passKek = await derivePassKek(passphrase, salt);
  const authVerifier = await deriveAuthVerifier(passKek);

  // Cheap local reject for a typo, but only against the verifier this salt
  // produced — a cached verifier means nothing once the salt has rotated.
  if (salt === identity.salt && identity.authVerifier && authVerifier !== identity.authVerifier) {
    throw new SaltMismatchError();
  }

  let auth: AuthResponse;

  try {
    auth = await apiLogin({ accountId: identity.accountId, authVerifier });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new SaltMismatchError();
    }

    throw err;
  }

  let dek: Uint8Array;

  try {
    dek = await unwrapKey(passKek, auth.wrappedDekPass);
  } catch {
    throw new SaltMismatchError();
  }

  const next = identityFromAuth(auth, authVerifier, identity.createdAt);
  saveIdentity(next);

  return { token: auth.token, dek, identity: next };
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
      throw new Error('Bad passphrase');
    }

    throw err;
  }
}

/** Recover with mnemonic: unwrap DEK, set new passphrase, rotate server wraps. */
export async function recoverAccount(
  words: string[],
  newPassphrase: string,
): Promise<AuthSession> {
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
  });
  const identity = identityFromAuth(auth, secrets.authVerifier, bundle.createdAt);
  saveIdentity(identity);

  return { token: auth.token, dek: secrets.dek, identity };
}

/** Clear legacy plaintext localStorage keys (no longer used; source of truth is Atlas). */
export function clearLegacyLocalData(): void {
  localStorage.removeItem(LEGACY_ENTRIES_KEY);
  localStorage.removeItem(LEGACY_MERIDIAN_KEY);
  localStorage.removeItem(LEGACY_PROGRESS_KEY);
}
