/**
 * Bun polyfill: bson calls v8.startupSnapshot.isBuildingSnapshot() at import time,
 * which throws NotImplementedError on Bun. Return false (same as Node when not snapshotting).
 * Use: bun --preload ./scripts/bun-v8-patch.ts …
 */
try {
  const v8 = globalThis.process?.getBuiltinModule?.('v8') as
    | { startupSnapshot?: { isBuildingSnapshot?: () => boolean } }
    | undefined;

  if (v8) {
    Object.defineProperty(v8, 'startupSnapshot', {
      value: {
        isBuildingSnapshot: () => false,
      },
      configurable: true,
      writable: true,
    });
  }
} catch {
  /* ignore */
}
