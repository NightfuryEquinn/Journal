import { apiSubscribePush, apiUnsubscribePush } from './api';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';

/** Whether this browser can do Web Push at all. */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Whether the build shipped a VAPID key. Distinct from browser support so a
 *  missing env var does not masquerade as an unsupported browser. */
export function pushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

/** Current notification permission, or 'denied' where unsupported. */
export function pushPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied';
}

/** base64url VAPID key → Uint8Array, the form every browser accepts. */
function applicationServerKey(): Uint8Array {
  const padded = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(VAPID_PUBLIC_KEY.length / 4) * 4,
    '=',
  );
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

/** Read this device's existing subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported() || !pushConfigured()) {
    return null;
  }

  const reg = await navigator.serviceWorker.ready;

  return reg.pushManager.getSubscription();
}

/** Send a subscription to the server along with this device's IANA zone. */
async function upsert(token: string, sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Incomplete push subscription');
  }

  await apiSubscribePush(
    token,
    { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
}

/**
 * Ask for permission and subscribe. Must be called from a user gesture —
 * Notification.requestPermission() is ignored otherwise.
 */
export async function enablePush(token: string): Promise<NotificationPermission> {
  if (!pushSupported() || !pushConfigured()) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return permission;
  }

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true, // mandatory in Chrome
      applicationServerKey: applicationServerKey(),
    }));

  await upsert(token, sub);

  return 'granted';
}

/** Unregister this device. Server first, so a local failure strands nothing. */
export async function disablePush(token: string): Promise<void> {
  const sub = await currentSubscription();

  if (!sub) {
    return;
  }

  await apiUnsubscribePush(token, sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Re-send the current subscription on boot. Cheap because the server upsert is
 * keyed on endpoint, and it is how endpoint rotation and travel (timezone
 * change) get picked up — the service worker has no session token of its own,
 * so it cannot re-register itself.
 */
export async function syncPush(token: string): Promise<void> {
  if (pushPermission() !== 'granted') {
    return;
  }

  const sub = await currentSubscription();

  if (sub) {
    await upsert(token, sub);
  }
}
