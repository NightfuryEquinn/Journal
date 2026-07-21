// app.tsx — main state machine + tweaks
import { useEffect, useState } from 'react';
import type { AppView, JournalEntry, ListLayout, TweakValues } from './types';
import { SoundManager, DecodeText, Bracket, Panel, Btn, TopBar, StatusBar, Backdrop } from './hud';
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakColor,
  TweakButton,
} from './tweaks-panel';
import { SEED_ENTRIES } from './seed';
import { LoginScreen } from './login';
import { ListScreen } from './list';
import { ReaderScreen } from './reader';
import { ComposerScreen } from './composer';

const TWEAK_DEFAULTS: TweakValues & Record<string, unknown> = {
  paletteSwatch: ['#3dd1e0', '#060c12', '#e6efff'],
  type: 'all-mono',
  density: 'spacious',
  depth: 70,
  scanlines: true,
};

const PALETTE_MAP: Record<string, string> = {
  '["#ff8a3d","#0a0c0e","#f3e8d5"]': 'tactical',
  '["#3dd1e0","#060c12","#e6efff"]': 'oceanic',
  '["#b5ff5a","#07090a","#e7f5d8"]': 'phosphor',
  '["#f1ede4","#0d0e10","#1a1c20"]': 'bone',
};
const paletteFromSwatch = (sw: string[]): string =>
  PALETTE_MAP[JSON.stringify(sw).toLowerCase()] || 'tactical';

const STORAGE_KEY = 'meridian.entries.v1';

export default function App() {
  const [t, setTweak] = useTweaks<TweakValues & Record<string, unknown>>(TWEAK_DEFAULTS);
  const [user, setUser] = useState<string | null>(null);
  const [view, setView] = useState<AppView>({ name: 'login' });
  const [listLayout, setListLayout] = useState<ListLayout>('stack');
  const [soundOn, setSoundOn] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as JournalEntry[];
    } catch {
      /* ignore */
    }
    return SEED_ENTRIES;
  });
  const [confirmDel, setConfirmDel] = useState<JournalEntry | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }, [entries]);

  const paletteKey = paletteFromSwatch(t.paletteSwatch);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', paletteKey);
    root.setAttribute('data-type', t.type);
    root.setAttribute('data-density', t.density);
    root.setAttribute('data-scan', t.scanlines ? '1' : '0');
    root.style.setProperty('--depth', String(t.depth));
  }, [paletteKey, t.type, t.density, t.scanlines, t.depth]);

  useEffect(() => {
    SoundManager.setEnabled(soundOn);
  }, [soundOn]);

  const status =
    view.name === 'login'
      ? 'LOCKED'
      : view.name === 'list'
        ? 'ARCHIVE · LIVE'
        : view.name === 'read'
          ? `READ · ${view.entry.id.toUpperCase()}`
          : view.name === 'compose'
            ? 'WRITE · CONSOLE'
            : '—';

  const onAuth = (u: string) => {
    setUser(u);
    setView({ name: 'list' });
  };
  const signOut = () => {
    setUser(null);
    setView({ name: 'login' });
  };

  const openEntry = (e: JournalEntry) => setView({ name: 'read', entry: e });
  const newEntry = () => setView({ name: 'compose', existing: null });
  const editEntry = (e: JournalEntry) => setView({ name: 'compose', existing: e });

  const saveEntry = (e: JournalEntry) => {
    setEntries((prev) => {
      const i = prev.findIndex((x) => x.id === e.id);
      if (i === -1) return [e, ...prev];
      const cp = prev.slice();
      cp[i] = e;
      return cp;
    });
    setView({ name: 'read', entry: e });
  };

  const requestDelete = (e: JournalEntry) => setConfirmDel(e);
  const confirmDelete = () => {
    const e = confirmDel;
    if (!e) return;
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    setConfirmDel(null);
    SoundManager.deny();
    setView({ name: 'list' });
  };

  const currentRead =
    view.name === 'read' ? entries.find((x) => x.id === view.entry.id) || view.entry : null;

  return (
    <div className="app">
      <Backdrop depth={t.depth} />

      <TopBar
        user={user || '—'}
        status={status}
        onSignOut={user ? signOut : null}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((s) => !s)}
      />

      <div className="stage">
        <div className="scene">
          {view.name === 'login' && <LoginScreen onAuth={onAuth} />}
          {view.name === 'list' && (
            <ListScreen
              entries={entries}
              onOpen={openEntry}
              onNew={newEntry}
              layout={listLayout}
              onLayoutChange={setListLayout}
              onDelete={requestDelete}
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
        </div>
      </div>

      <StatusBar
        left={
          <>
            <span>CRT · OK</span>
            <span>CLUSTER · ATL-07</span>
            <span>ENC · TLS 1.3</span>
            <span className="acc">● OPERATOR-ONLY</span>
          </>
        }
        right={
          <>
            <span>ENTRIES · {entries.length.toString().padStart(4, '0')}</span>
            <span>VIEW · {view.name.toUpperCase()}</span>
            <span>SIG · ▰▰▰▰▱</span>
          </>
        }
      />

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Bracket>
              <Panel title="CONFIRM PURGE" meta="DESTRUCTIVE OPERATION">
                <div style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
                  <DecodeText text="// this will erase the log entry from the cluster." speed={14} />
                  <div style={{ marginTop: 8, color: 'var(--fg-mute)' }}>
                    <span className="mono">_id:</span>{' '}
                    <span className="acc mono">{confirmDel.id}</span>
                  </div>
                  <div style={{ marginTop: 4, color: 'var(--fg-dim)' }}>
                    <span className="mono dim">title:</span> <span>{confirmDel.title}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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

      <TweaksPanel title="MERIDIAN · TWEAKS">
        <TweakSection label="Color palette">
          <TweakColor
            label="Palette"
            value={t.paletteSwatch}
            options={[
              ['#ff8a3d', '#0a0c0e', '#f3e8d5'],
              ['#3dd1e0', '#060c12', '#e6efff'],
              ['#b5ff5a', '#07090a', '#e7f5d8'],
              ['#f1ede4', '#0d0e10', '#1a1c20'],
            ]}
            onChange={(arr) => setTweak('paletteSwatch', arr)}
          />
          <div className="mono mute" style={{ fontSize: 10, letterSpacing: '0.16em', textAlign: 'right' }}>
            CURRENT · {paletteKey.toUpperCase()}
          </div>
        </TweakSection>

        <TweakSection label="Typography">
          <TweakRadio
            label="Family"
            value={t.type}
            options={[
              { value: 'mono-condensed', label: 'MONO+CND' },
              { value: 'all-mono', label: 'ALL MONO' },
              { value: 'literary', label: 'LITERARY' },
            ]}
            onChange={(v) => setTweak('type', v)}
          />
        </TweakSection>

        <TweakSection label="Density">
          <TweakRadio
            label="Spacing"
            value={t.density}
            options={[
              { value: 'compact', label: 'COMPACT' },
              { value: 'regular', label: 'REGULAR' },
              { value: 'spacious', label: 'SPACIOUS' },
            ]}
            onChange={(v) => setTweak('density', v)}
          />
        </TweakSection>

        <TweakSection label="Depth (3D)">
          <TweakSlider
            label="Intensity"
            value={t.depth}
            min={0}
            max={100}
            step={10}
            onChange={(v) => setTweak('depth', v)}
          />
        </TweakSection>

        <TweakSection label="Overlays">
          <TweakToggle label="Scanlines + beam" value={t.scanlines} onChange={(v) => setTweak('scanlines', v)} />
          <TweakToggle label="Ambient audio" value={soundOn} onChange={setSoundOn} />
        </TweakSection>

        <TweakSection label="Data" />
        <TweakButton
          label="Reset to seed entries"
          secondary
          onClick={() => {
            if (confirm('Reset all entries to the seed set?')) {
              setEntries(SEED_ENTRIES);
              setView({ name: 'list' });
            }
          }}
        />
      </TweaksPanel>

      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: grid; place-items: center;
          animation: fade 0.2s;
        }
        @keyframes fade { from { opacity: 0; } }
        .modal { width: min(440px, 90vw); }
      `}</style>
    </div>
  );
}
