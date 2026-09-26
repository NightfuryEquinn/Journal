import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { TrashIcon, XIcon } from '@phosphor-icons/react';
import type { AppView, DeviceIdentity, JournalEntry, ListLayout, QuestProgress } from './types';
import { DecodeText, Bracket, Panel, Btn, TopBar, Backdrop, ErrorBoundary } from './hud';
import { SoundManager } from './sound';
import {
  clearLegacyLocalData,
  loadIdentity,
  requestPersistentStorage,
  type AuthSession,
} from './identity';
import { countJournaledDays, emptyProgress, settleAura } from './quests';
import { decryptEntry, encryptEntry } from './crypto';
import {
  apiDeleteEntry,
  apiGetProgress,
  apiListEntries,
  apiPutEntries,
  apiPutProgress,
} from './api';
import { syncPush } from './push';
import { LoginScreen } from './login';
import { ListScreen } from './list';
import { ReaderScreen } from './reader';
import { ComposerScreen } from './composer';
import { ProfileScreen } from './profile';
import { TransparencyScreen } from './transparency';
import { maybeStartTour, resetTour, TOUR_KEY } from './tours';

const LandingScreen = lazy(() => import('./landing').then((m) => ({ default: m.LandingScreen })));

const SOUND_KEY = 'journs.sound';

/** Root shell: auth session, E2EE sync, view routing, chrome. */
export default function App() {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(() => loadIdentity());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [view, setView] = useState<AppView>(() =>
    loadIdentity() ? { name: 'login' } : { name: 'landing' },
  );
  const [listLayout, setListLayout] = useState<ListLayout>('stack');
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) === '1');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [progress, setProgress] = useState<QuestProgress>(() => emptyProgress());
  const [confirmDel, setConfirmDel] = useState<JournalEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const pendingTour = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    clearLegacyLocalData();
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
    SoundManager.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    SoundManager.pageLoad();
  }, [view.name]);

  // A view change (archive → reader, profile → transparency, …) should land
  // at the top, not carry over whatever scroll position the last screen left.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [view.name]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (confirmDel && !dialog.open) {
      dialog.showModal();
    } else if (!confirmDel && dialog.open) {
      dialog.close();
    }
  }, [confirmDel]);

  useEffect(() => {
    if (confirmDel) {
      SoundManager.delete();
    }
  }, [confirmDel]);

  /** Kick off tour once the archive list is painted (esp. after signup). */
  useEffect(() => {
    if (view.name !== 'list' || loadingArchive || !pendingTour.current) {
      return;
    }

    pendingTour.current = false;

    return maybeStartTour({ force: true });
  }, [view, loadingArchive]);

  /** After auth: pull ciphertext from Atlas, decrypt, load quests. */
  const bootstrapSession = async (next: AuthSession, options?: { isNewUser?: boolean }) => {
    setSession(next);
    setIdentity(next.identity);
    setSyncError(null);
    setLoadingArchive(true);
    setEntries([]);
    clearLegacyLocalData();
    // Auth is the strongest engagement signal we get, so it is the best moment
    // to ask the browser to keep the identity around.
    void requestPersistentStorage();
    // Same moment, same reason: refresh the push endpoint and timezone in case
    // the browser rotated one or the user travelled.
    void syncPush(next.token).catch(() => {
      /* reminders are best-effort; never block the archive on them */
    });

    if (options?.isNewUser) {
      pendingTour.current = true;
      resetTour();
    }

    try {
      const { entries: blobs } = await apiListEntries(next.token);
      const decrypted: JournalEntry[] = [];

      for (const blob of blobs) {
        try {
          decrypted.push(await decryptEntry(next.dek, blob.ciphertext, blob.nonce));
        } catch {
          /* skip corrupt blob */
        }
      }

      decrypted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(decrypted);

      const { progress: remote } = await apiGetProgress(next.token);
      setProgress(settleAura(remote));
      setView({ name: 'list' });

      if (!options?.isNewUser && localStorage.getItem(TOUR_KEY) !== '1') {
        pendingTour.current = true;
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      setSession(null);
      setEntries([]);
      pendingTour.current = false;
      throw err;
    } finally {
      setLoadingArchive(false);
    }
  };

  /** Authenticate and enter the archive. */
  const onAuth = async (next: AuthSession, options?: { isNewUser?: boolean }) => {
    await bootstrapSession(next, options);
  };

  /** Clear in-memory session (identity stays on device). */
  const signOut = () => {
    setSession(null);
    setEntries([]);
    setProgress(emptyProgress());
    setView({ name: 'login' });
  };

  /** Persist quest updates to the server. */
  const onProgressChange = async (next: QuestProgress) => {
    setProgress(next);

    if (!session) {
      return;
    }

    try {
      const { progress: saved } = await apiPutProgress(session.token, next);
      setProgress(saved);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Quest sync failed');
    }
  };

  /** Open profile and refresh settled progress from server. */
  const openProfile = async () => {
    if (session) {
      try {
        const { progress: remote } = await apiGetProgress(session.token);
        setProgress(settleAura(remote));
      } catch {
        setProgress((p) => settleAura(p));
      }
    }

    setView({ name: 'profile' });
  };

  /** Open the transparency diagram, remembering where Back should return to. */
  const openTransparency = (from: 'landing' | 'profile') => setView({ name: 'transparency', from });

  /** Open an entry in the reader. */
  const openEntry = (e: JournalEntry) => setView({ name: 'read', entry: e });

  /** Open the composer for a new entry. */
  const newEntry = () => setView({ name: 'compose', existing: null });

  /** Open the composer to edit an existing entry. */
  const editEntry = (e: JournalEntry) => setView({ name: 'compose', existing: e });

  /** Encrypt + upsert entry, then open reader. Rejects on failure so the composer can show it. */
  const saveEntry = async (e: JournalEntry) => {
    if (!session) {
      return;
    }

    const { ciphertext, nonce } = await encryptEntry(session.dek, e);
    await apiPutEntries(session.token, [{ entryId: e.id, ciphertext, nonce, schemaVersion: 1 }]);

    setEntries((prev) => {
      const i = prev.findIndex((x) => x.id === e.id);

      if (i === -1) {
        return [e, ...prev];
      }

      const cp = prev.slice();
      cp[i] = e;

      return cp;
    });
    setView({ name: 'read', entry: e });
  };

  /** Prompt for delete confirmation. */
  const requestDelete = (e: JournalEntry) => {
    setDeleteError(null);
    setConfirmDel(e);
  };

  /** Confirm and purge entry remotely + locally. Stays open with an error on failure. */
  const confirmDelete = async () => {
    const e = confirmDel;

    if (!e || !session) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await apiDeleteEntry(session.token, e.id);
      setEntries((prev) => prev.filter((x) => x.id !== e.id));
      setConfirmDel(null);
      SoundManager.deny();
      setView({ name: 'list' });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'purge failed');
      SoundManager.deny();
    } finally {
      setDeleteBusy(false);
    }
  };

  /** Merge imported plaintext entries and re-encrypt to server. */
  const importEntries = async (incoming: JournalEntry[]) => {
    if (!session) {
      return;
    }

    const byId = new Map(entries.map((e) => [e.id, e]));

    for (const e of incoming) {
      byId.set(e.id, e);
    }

    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const encrypted = await Promise.all(
      incoming.map(async (e) => {
        const { ciphertext, nonce } = await encryptEntry(session.dek, e);

        return { entryId: e.id, ciphertext, nonce, schemaVersion: 1 };
      }),
    );
    await apiPutEntries(session.token, encrypted);
    setEntries(merged);
  };

  const currentRead =
    view.name === 'read' ? entries.find((x) => x.id === view.entry.id) || view.entry : null;

  const userLabel = session && identity ? identity.operatorId : '—';
  const authed = Boolean(session);
  const showTopBar = view.name !== 'landing';

  return (
    <div className="fixed inset-0 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <Backdrop />

      {showTopBar && (
        <TopBar
          user={userLabel}
          onSignOut={authed ? signOut : null}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((s) => !s)}
          onOpenProfile={authed ? openProfile : null}
          journaledDays={authed ? countJournaledDays(entries) : null}
        />
      )}

      {authed && syncError && view.name !== 'login' && (
        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-bad/40 bg-[color-mix(in_oklab,var(--bad)_10%,var(--bg))] px-4 py-2 font-mono text-meta text-bad">
          <span>// sync error · {syncError}</span>
          <button
            type="button"
            className="tap-target shrink-0 p-1"
            onClick={() => setSyncError(null)}
            aria-label="Dismiss"
          >
            <XIcon className="size-3.5" weight="bold" />
          </button>
        </div>
      )}

      <div
        id="app-scroller"
        ref={scrollerRef}
        className="relative z-5 min-h-0 flex-1 overflow-auto"
      >
        <ErrorBoundary>
          {view.name === 'landing' && (
            <Suspense fallback={<div className="h-full bg-bg" />}>
              <LandingScreen
                hasIdentity={Boolean(identity)}
                onEnter={(intent) => setView({ name: 'login', intent })}
                onOpenTransparency={() => openTransparency('landing')}
              />
            </Suspense>
          )}
          {view.name === 'login' && (
            <LoginScreen
              onAuth={onAuth}
              identity={identity}
              syncError={syncError}
              intent={view.intent}
              onAbout={identity ? undefined : () => setView({ name: 'landing' })}
            />
          )}
          {view.name === 'list' && (
            <ListScreen
              entries={entries}
              onOpen={openEntry}
              onNew={newEntry}
              layout={listLayout}
              onLayoutChange={setListLayout}
              onDelete={requestDelete}
              loading={loadingArchive}
            />
          )}
          {view.name === 'read' && currentRead && (
            <ReaderScreen
              entry={currentRead}
              onBack={() => setView({ name: 'list' })}
              onEdit={editEntry}
              onDelete={requestDelete}
            />
          )}
          {view.name === 'compose' && (
            <ComposerScreen
              existing={view.existing}
              onSave={saveEntry}
              onCancel={() =>
                setView(view.existing ? { name: 'read', entry: view.existing } : { name: 'list' })
              }
              onDelete={requestDelete}
            />
          )}
          {view.name === 'profile' && identity && (
            <ProfileScreen
              identity={identity}
              token={session?.token ?? null}
              entries={entries}
              progress={progress}
              onBack={() => setView({ name: 'list' })}
              onProgressChange={onProgressChange}
              onImport={importEntries}
              onOpenTransparency={() => openTransparency('profile')}
            />
          )}
          {view.name === 'transparency' && (
            <TransparencyScreen
              onBack={() =>
                setView(view.from === 'landing' ? { name: 'landing' } : { name: 'profile' })
              }
              backLabel={view.from === 'landing' ? 'HOME' : 'PROFILE'}
            />
          )}
        </ErrorBoundary>
      </div>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[90dvh] w-[min(440px,90vw)] overflow-auto border-0 bg-transparent p-0 backdrop:bg-black/70 backdrop:backdrop-blur-xs"
        onClose={() => setConfirmDel(null)}
        onCancel={() => setConfirmDel(null)}
      >
        {confirmDel && (
          <Bracket>
            <Panel title="CONFIRM PURGE" meta="DESTRUCTIVE OPERATION">
              <div className="mb-3.5 text-body leading-[1.6]">
                <DecodeText text="// this will erase the ciphertext blob from Atlas." speed={14} />
                <div className="mt-2 text-fg-mute">
                  <span className="font-mono tracking-[0.02em]">_id:</span>{' '}
                  <span className="font-mono tracking-[0.02em] text-accent">{confirmDel.id}</span>
                </div>
                <div className="mt-1 text-fg-dim">
                  <span className="font-mono tracking-[0.02em] text-fg-dim">title:</span>{' '}
                  <span>{confirmDel.title}</span>
                </div>
                {deleteError && (
                  <div className="mt-3 font-mono text-meta text-bad">
                    // purge failed · {deleteError}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2.5">
                <Btn variant="ghost" disabled={deleteBusy} onClick={() => setConfirmDel(null)}>
                  CANCEL
                </Btn>
                <Btn variant="danger" disabled={deleteBusy} onClick={() => void confirmDelete()}>
                  <TrashIcon className="size-3.5" weight="bold" />
                  {deleteBusy ? 'PURGING…' : 'PURGE ENTRY'}
                </Btn>
              </div>
            </Panel>
          </Bracket>
        )}
      </dialog>
    </div>
  );
}
