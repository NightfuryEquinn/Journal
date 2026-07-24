// app.tsx — main state machine
import { useEffect, useState } from 'react';
import type { AppView, DeviceIdentity, JournalEntry, ListLayout, QuestProgress } from './types';
import { SoundManager, DecodeText, Bracket, Panel, Btn, TopBar, Backdrop } from './hud';
import { SEED_ENTRIES } from './seed';
import { loadIdentity } from './identity';
import { loadProgress, saveProgress, settleAura } from './quests';
import { LoginScreen } from './login';
import { ListScreen } from './list';
import { ReaderScreen } from './reader';
import { ComposerScreen } from './composer';
import { ProfileScreen } from './profile';

const THEME = {
  palette: 'oceanic',
  type: 'all-mono',
  density: 'spacious',
  depth: 70,
  scanlines: true,
} as const;

const STORAGE_KEY = 'journs.entries.v1';
const LEGACY_STORAGE_KEY = 'meridian.entries.v1';

/** Load entries from localStorage, migrating the legacy Meridian key once. */
function loadEntries(): JournalEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      return JSON.parse(stored) as JournalEntry[];
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacy) {
      const parsed = JSON.parse(legacy) as JournalEntry[];
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      return parsed;
    }
  } catch {
    /* ignore */
  }

  return SEED_ENTRIES;
}

/** Root shell: view routing, persistence, and chrome. */
export default function App() {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(() => loadIdentity());
  const [session, setSession] = useState(false);
  const [view, setView] = useState<AppView>({ name: 'login' });
  const [listLayout, setListLayout] = useState<ListLayout>('stack');
  const [soundOn, setSoundOn] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries);
  const [progress, setProgress] = useState<QuestProgress>(() => settleAura(loadProgress()));
  const [confirmDel, setConfirmDel] = useState<JournalEntry | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }, [entries]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', THEME.palette);
    root.setAttribute('data-type', THEME.type);
    root.setAttribute('data-density', THEME.density);
    root.setAttribute('data-scan', THEME.scanlines ? '1' : '0');
    root.style.setProperty('--depth', String(THEME.depth));
  }, []);

  useEffect(() => {
    SoundManager.setEnabled(soundOn);
  }, [soundOn]);

  /** Authenticate, settle AURA, and enter the archive list. */
  const onAuth = (next: DeviceIdentity) => {
    setIdentity(next);
    setProgress((p) => settleAura(p));
    setSession(true);
    setView({ name: 'list' });
  };

  /** Clear session and return to login (identity stays on device). */
  const signOut = () => {
    setSession(false);
    setView({ name: 'login' });
  };

  /** Persist quest/AURA updates from profile. */
  const onProgressChange = (next: QuestProgress) => {
    setProgress(next);
  };

  /** Open profile and re-settle AURA for period rollover. */
  const openProfile = () => {
    setProgress((p) => settleAura(p));
    setView({ name: 'profile' });
  };

  /** Open an entry in the reader. */
  const openEntry = (e: JournalEntry) => setView({ name: 'read', entry: e });

  /** Open the composer for a new entry. */
  const newEntry = () => setView({ name: 'compose', existing: null });

  /** Open the composer to edit an existing entry. */
  const editEntry = (e: JournalEntry) => setView({ name: 'compose', existing: e });

  /** Persist an entry and open it in the reader. */
  const saveEntry = (e: JournalEntry) => {
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

  /** Confirm and purge the pending entry. */
  const confirmDelete = () => {
    const e = confirmDel;

    if (!e) {
      return;
    }

    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    setConfirmDel(null);
    SoundManager.deny();
    setView({ name: 'list' });
  };

  const currentRead =
    view.name === 'read' ? entries.find((x) => x.id === view.entry.id) || view.entry : null;

  const userLabel = session && identity ? identity.operatorId : '—';

  return (
    <div className="fixed inset-0 grid grid-rows-[minmax(56px,auto)_1fr] bg-bg">
      <Backdrop depth={THEME.depth} />

      <TopBar
        user={userLabel}
        onSignOut={session ? signOut : null}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((s) => !s)}
        onOpenProfile={session ? openProfile : null}
      />

      <div className="relative z-5 grid overflow-hidden">
        <div className="col-start-1 row-start-1 overflow-auto">
          {view.name === 'login' && (
            <LoginScreen onAuth={onAuth} identity={identity} />
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
            />
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
                  <DecodeText text="// this will erase the log entry from the cluster." speed={14} />
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
                  <Btn variant="danger" onClick={confirmDelete}>
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
