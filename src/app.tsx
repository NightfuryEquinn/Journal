import { useEffect, useRef, useState } from 'react';
import type { AppView, DeviceIdentity, JournalEntry, ListLayout, QuestProgress } from './types';
import { SoundManager, DecodeText, Bracket, Panel, Btn, TopBar, Backdrop } from './hud';
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
import { LoginScreen } from './login';
import { ListScreen } from './list';
import { ReaderScreen } from './reader';
import { ComposerScreen } from './composer';
import { ProfileScreen } from './profile';
import { TransparencyScreen } from './transparency';
import { maybeStartTour, resetTour, TOUR_KEY } from './tours';

const THEME = {
  palette: 'oceanic',
  type: 'all-mono',
  density: 'spacious',
  depth: 70,
  scanlines: true,
} as const;

const SOUND_KEY = 'journs.sound';

/** Root shell: auth session, E2EE sync, view routing, chrome. */
export default function App() {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(() => loadIdentity());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [view, setView] = useState<AppView>({ name: 'login' });
  const [listLayout, setListLayout] = useState<ListLayout>('stack');
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) === '1');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [progress, setProgress] = useState<QuestProgress>(() => emptyProgress());
  const [confirmDel, setConfirmDel] = useState<JournalEntry | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const pendingTour = useRef(false);

  useEffect(() => {
    clearLegacyLocalData();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', THEME.palette);
    root.setAttribute('data-type', THEME.type);
    root.setAttribute('data-density', THEME.density);
    root.setAttribute('data-scan', THEME.scanlines ? '1' : '0');
    root.style.setProperty('--depth', String(THEME.depth));
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
    SoundManager.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    SoundManager.pageLoad();
  }, [view.name]);

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
    maybeStartTour({ force: true });
  }, [view, loadingArchive]);

  /** After auth: pull ciphertext from Atlas, decrypt, load quests. */
  const bootstrapSession = async (
    next: AuthSession,
    options?: { isNewUser?: boolean },
  ) => {
    setSession(next);
    setIdentity(next.identity);
    setSyncError(null);
    setLoadingArchive(true);
    setEntries([]);
    clearLegacyLocalData();
    // Auth is the strongest engagement signal we get, so it is the best moment
    // to ask the browser to keep the identity around.
    void requestPersistentStorage();

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
  const onAuth = async (
    next: AuthSession,
    options?: { isNewUser?: boolean },
  ) => {
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

  /** Open transparency diagram. */
  const openTransparency = () => setView({ name: 'transparency' });

  /** Open an entry in the reader. */
  const openEntry = (e: JournalEntry) => setView({ name: 'read', entry: e });

  /** Open the composer for a new entry. */
  const newEntry = () => setView({ name: 'compose', existing: null });

  /** Open the composer to edit an existing entry. */
  const editEntry = (e: JournalEntry) => setView({ name: 'compose', existing: e });

  /** Encrypt + upsert entry, then open reader. */
  const saveEntry = async (e: JournalEntry) => {
    if (!session) {
      return;
    }

    const { ciphertext, nonce } = await encryptEntry(session.dek, e);
    await apiPutEntries(session.token, [
      { entryId: e.id, ciphertext, nonce, schemaVersion: 1 },
    ]);

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
  const requestDelete = (e: JournalEntry) => setConfirmDel(e);

  /** Confirm and purge entry remotely + locally. */
  const confirmDelete = async () => {
    const e = confirmDel;

    if (!e || !session) {
      return;
    }

    await apiDeleteEntry(session.token, e.id);
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    setConfirmDel(null);
    SoundManager.deny();
    setView({ name: 'list' });
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

  return (
    <div className="fixed inset-0 grid grid-rows-[minmax(56px,auto)_1fr] bg-bg">
      <Backdrop depth={THEME.depth} />

      <TopBar
        user={userLabel}
        onSignOut={authed ? signOut : null}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((s) => !s)}
        onOpenProfile={authed ? openProfile : null}
        journaledDays={authed ? countJournaledDays(entries) : null}
      />

      <div className="relative z-5 grid overflow-hidden">
        <div className="col-start-1 row-start-1 overflow-auto">
          {view.name === 'login' && (
            <LoginScreen onAuth={onAuth} identity={identity} syncError={syncError} />
          )}
          {view.name === 'list' && (
            <ListScreen
              entries={entries}
              onOpen={openEntry}
              onNew={newEntry}
              layout={listLayout}
              onLayoutChange={setListLayout}
              onDelete={requestDelete}
              onOpenProfile={openProfile}
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
              entries={entries}
              progress={progress}
              onBack={() => setView({ name: 'list' })}
              onProgressChange={onProgressChange}
              onImport={importEntries}
              onOpenTransparency={openTransparency}
            />
          )}
          {view.name === 'transparency' && (
            <TransparencyScreen onBack={() => setView({ name: 'profile' })} />
          )}
        </div>
      </div>

      {confirmDel && (
        <div
          className="fixed inset-0 z-1000 grid animate-fade place-items-center bg-black/70 backdrop-blur-xs"
          onClick={() => setConfirmDel(null)}
        >
          <div className="w-[min(440px,90vw)]" onClick={(e) => e.stopPropagation()}>
            <Bracket>
              <Panel title="CONFIRM PURGE" meta="DESTRUCTIVE OPERATION">
                <div className="mb-3.5 text-[13px] leading-[1.6]">
                  <DecodeText text="// this will erase the ciphertext blob from Atlas." speed={14} />
                  <div className="mt-2 text-fg-mute">
                    <span className="font-mono tracking-[0.02em]">_id:</span>{' '}
                    <span className="font-mono tracking-[0.02em] text-accent">{confirmDel.id}</span>
                  </div>
                  <div className="mt-1 text-fg-dim">
                    <span className="font-mono tracking-[0.02em] text-fg-dim">title:</span>{' '}
                    <span>{confirmDel.title}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5">
                  <Btn variant="ghost" onClick={() => setConfirmDel(null)}>
                    CANCEL
                  </Btn>
                  <Btn variant="danger" onClick={() => void confirmDelete()}>
                    ✕ PURGE ENTRY
                  </Btn>
                </div>
              </Panel>
            </Bracket>
          </div>
        </div>
      )}
    </div>
  );
}
