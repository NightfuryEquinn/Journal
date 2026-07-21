// composer.tsx — console-style writer
import { useEffect, useRef, useState } from 'react';
import type { JournalEntry } from './types';
import { SoundManager, DecodeText, Panel, Btn, fmtDate, fmtTime, pad } from './hud';

const MOOD_OPTS = ['LOW', 'DIM', 'STEADY', 'GOOD', 'HIGH'];
const ENERGY_OPTS = ['DRAINED', 'LOW', 'STEADY', 'CHARGED', 'PEAKED'];
const WEATHER_OPTS = [
  'CLEAR · 14°C · NW 6km/h',
  'OVERCAST · 11°C · N 4km/h',
  'LIGHT RAIN · 9°C · W 8km/h',
  'HEAVY RAIN · 12°C · SW 14km/h',
  'FOG · 8°C · CALM',
  'SNOW · -2°C · NE 7km/h',
  'CLEAR · 22°C · S 3km/h',
];

type SavingState = 'idle' | 'saving' | 'saved';

interface ComposerScreenProps {
  existing: JournalEntry | null;
  onSave: (entry: JournalEntry) => void;
  onCancel: () => void;
  onDelete: (entry: JournalEntry) => void;
}

export function ComposerScreen({ existing, onSave, onCancel, onDelete }: ComposerScreenProps) {
  const isEdit = !!existing;
  const now = new Date();
  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [mood, setMood] = useState(existing?.mood ?? 4);
  const [energy, setEnergy] = useState(existing?.energy ?? 3);
  const [weather, setWeather] = useState(existing?.weather || WEATHER_OPTS[0]);
  const [tagsStr, setTagsStr] = useState((existing?.tags || []).join(', '));
  const [savingState, setSavingState] = useState<SavingState>('idle');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const wc = body.trim() ? body.trim().split(/\s+/).length : 0;
  const cc = body.length;

  const handleType = () => SoundManager.type();

  const save = () => {
    if (!title.trim() || !body.trim()) {
      SoundManager.deny();
      return;
    }
    setSavingState('saving');
    SoundManager.click();
    const entry: JournalEntry = {
      id:
        existing?.id ||
        `e-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${Math.random().toString(36).slice(2, 6)}`,
      date: existing?.date || now.toISOString(),
      title: title.trim(),
      body: body.trim(),
      mood,
      energy,
      weather,
      tags: tagsStr
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    };
    setTimeout(() => {
      setSavingState('saved');
      SoundManager.confirm();
      setTimeout(() => onSave(entry), 400);
    }, 700);
  };

  return (
    <div className="composer-wrap">
      <div className="composer-top">
        <Btn variant="ghost" onClick={onCancel}>
          ◂ DISCARD
        </Btn>
        <div className="composer-crumbs mono mute">
          {isEdit ? 'ARCHIVE / EDIT' : 'ARCHIVE / NEW LOG'} · OPERATOR-01
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isEdit && existing && (
            <Btn variant="danger" onClick={() => onDelete(existing)}>
              ✕ DELETE
            </Btn>
          )}
          <Btn
            variant="primary"
            onClick={save}
            disabled={savingState !== 'idle' || !title.trim() || !body.trim()}
          >
            {savingState === 'idle' && (isEdit ? '↻ UPDATE LOG' : '▸ COMMIT LOG')}
            {savingState === 'saving' && '… WRITING'}
            {savingState === 'saved' && '✓ COMMITTED'}
          </Btn>
        </div>
      </div>

      <div className="composer-row">
        <main className="console-main">
          <Panel
            title={<DecodeText text="CONSOLE · COMPOSE" />}
            meta={`tty/02 · ${isEdit ? 'PATCH' : 'INSERT'} MODE`}
            headerRight={
              <span className="mono dim" style={{ fontSize: 10 }}>
                {savingState === 'saving' ? (
                  <span className="acc">// committing to cluster …</span>
                ) : savingState === 'saved' ? (
                  <span style={{ color: 'var(--good)' }}>// ack 3/3 replicas</span>
                ) : (
                  '// awaiting input'
                )}
              </span>
            }
          >
            <div className="console-shell">
              <div className="console-line">
                <span className="mono dim">$</span>
                <span className="mono acc"> operator@meridian:</span>
                <span className="mono dim">
                  ~/log/{now.getFullYear()}/{pad(now.getMonth() + 1)}/${' '}
                </span>
                <span className="mono">{isEdit && existing ? `patch ${existing.id}` : 'new --title'}</span>
              </div>
              <div className="console-field">
                <label className="console-pfx mono dim">title:</label>
                <input
                  ref={titleRef}
                  className="console-input"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    handleType();
                  }}
                  placeholder="enter title …"
                  spellCheck={false}
                />
                {title === '' && <span className="caret" />}
              </div>
              <div className="console-line">
                <span className="mono dim">$ body --multiline</span>
              </div>
              <div className="console-body-wrap">
                <textarea
                  ref={bodyRef}
                  className="console-body"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    handleType();
                  }}
                  placeholder={`> type your log entry …\n> markdown shorthand is fine — this is a personal feed.\n> press ⌘+enter to commit when ready.`}
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      save();
                    }
                  }}
                />
                <div className="line-numbers" aria-hidden="true">
                  {Array.from({ length: Math.max(12, body.split('\n').length) }, (_, i) => (
                    <div key={i}>{pad(i + 1)}</div>
                  ))}
                </div>
              </div>
              <div className="console-foot mono mute">
                <span>
                  WC <span className="acc">{wc}</span>
                </span>
                <span>
                  CC <span className="acc">{cc}</span>
                </span>
                <span>
                  LN <span className="acc">{body.split('\n').length}</span>
                </span>
                <span style={{ flex: 1 }} />
                <span>⌘ + ↵ TO COMMIT</span>
              </div>
            </div>
          </Panel>
        </main>

        <aside className="composer-side">
          <Panel title="METADATA" meta="REQUIRED">
            <div className="meta-form">
              <div className="mf-field">
                <label className="mf-label mono">DATE / TIME</label>
                <div className="mono acc" style={{ fontSize: 12 }}>
                  {fmtDate(now)} · {fmtTime(now)}
                </div>
                <span className="mono mute" style={{ fontSize: 9.5 }}>
                  // auto-captured
                </span>
              </div>

              <div className="mf-field">
                <label className="mf-label mono">
                  MOOD{' '}
                  <span className="mute">
                    {mood}/5 · {MOOD_OPTS[mood - 1]}
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={mood}
                  onChange={(e) => {
                    setMood(Number(e.target.value));
                    SoundManager.type();
                  }}
                  className="hud-range"
                />
                <div className="mf-scale mono mute">
                  <span>LOW</span>
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                  <span>HIGH</span>
                </div>
              </div>

              <div className="mf-field">
                <label className="mf-label mono">
                  ENERGY{' '}
                  <span className="mute">
                    {energy}/5 · {ENERGY_OPTS[energy - 1]}
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={energy}
                  onChange={(e) => {
                    setEnergy(Number(e.target.value));
                    SoundManager.type();
                  }}
                  className="hud-range"
                />
                <div className="mf-scale mono mute">
                  <span>DRAINED</span>
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                  <span>PEAKED</span>
                </div>
              </div>

              <div className="mf-field">
                <label className="mf-label mono">WEATHER</label>
                <select className="hud-select mono" value={weather} onChange={(e) => setWeather(e.target.value)}>
                  {WEATHER_OPTS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mf-field">
                <label className="mf-label mono">
                  TAGS <span className="mute">comma-separated</span>
                </label>
                <input
                  className="hud-input mono"
                  value={tagsStr}
                  onChange={(e) => {
                    setTagsStr(e.target.value);
                    SoundManager.type();
                  }}
                  placeholder="recon, self, …"
                />
                <div className="mf-chips">
                  {tagsStr
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t, i) => (
                      <span key={i} className="chip mono">
                        #{t}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </Panel>

          <div style={{ height: 14 }} />
          <Panel title="DB · WRITE PATH">
            <div className="op-log mono">
              <div className="op-line">
                <span className="op-time">→</span>
                <span className="op-tag">VALIDATE</span>
                <span className="op-id">title, body, tags</span>
              </div>
              <div className="op-line">
                <span className="op-time">→</span>
                <span className="op-tag">{isEdit ? 'UPDATE' : 'INSERT'}</span>
                <span className="op-id">db.meridian.entries</span>
              </div>
              <div className="op-line">
                <span className="op-time">→</span>
                <span className="op-tag">REPLICATE</span>
                <span className="op-id">3 replicas · ATL-07</span>
              </div>
              <div className="op-line">
                <span className="op-time">→</span>
                <span className="op-tag good">ACK</span>
                <span className="op-id">durable</span>
              </div>
            </div>
          </Panel>
        </aside>
      </div>

      <style>{`
        .composer-wrap { padding: 20px 28px 28px; max-width: 1400px; margin: 0 auto; }
        .composer-top {
          display: grid; grid-template-columns: auto 1fr auto;
          gap: 18px; align-items: center; margin-bottom: 22px;
        }
        .composer-crumbs { font-size: 10px; letter-spacing: 0.18em; text-align: center; }
        .composer-row {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 22px;
          align-items: start;
        }
        .console-shell {
          font-family: var(--mono);
          font-size: 13px;
          line-height: 1.7;
        }
        .console-line { padding: 4px 0; color: var(--fg-dim); }
        .console-field {
          display: flex; align-items: center;
          padding: 10px 0;
          border-bottom: 1px dashed var(--line);
          margin-bottom: 10px;
        }
        .console-pfx { margin-right: 10px; font-size: 12px; }
        .console-input {
          flex: 1; min-width: 0;
          color: var(--accent);
          font-family: var(--mono);
          font-size: 18px;
          letter-spacing: 0.04em;
        }
        .console-input::placeholder { color: var(--fg-mute); }
        .console-body-wrap {
          position: relative;
          display: grid;
          grid-template-columns: 36px 1fr;
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--line-strong);
          margin-top: 6px;
        }
        .line-numbers {
          grid-column: 1;
          padding: 12px 8px 12px 0;
          background: rgba(0,0,0,0.4);
          border-right: 1px solid var(--line);
          text-align: right;
          font-family: var(--mono);
          font-size: 10.5px;
          color: var(--fg-mute);
          line-height: 1.7;
          user-select: none;
        }
        .console-body {
          grid-column: 2;
          width: 100%;
          min-height: 360px;
          padding: 12px 14px;
          resize: vertical;
          color: var(--fg);
          font-family: var(--mono);
          font-size: 13px;
          line-height: 1.7;
        }
        .console-body::placeholder { color: var(--fg-mute); }
        .console-foot {
          display: flex; gap: 16px; align-items: center;
          margin-top: 10px;
          font-size: 10px; letter-spacing: 0.14em;
        }

        .meta-form { display: flex; flex-direction: column; gap: 18px; }
        .mf-field { display: flex; flex-direction: column; gap: 6px; }
        .mf-label { font-size: 9.5px; letter-spacing: 0.2em; color: var(--fg-mute); }
        .mf-label .mute { letter-spacing: 0.06em; }
        .hud-range {
          width: 100%; appearance: none; height: 4px;
          background: var(--line-strong);
          outline: none;
        }
        .hud-range::-webkit-slider-thumb {
          appearance: none; width: 14px; height: 14px;
          background: var(--accent); transform: rotate(45deg);
          box-shadow: 0 0 10px var(--accent);
          cursor: pointer;
        }
        .hud-range::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 0;
          background: var(--accent); transform: rotate(45deg);
          box-shadow: 0 0 10px var(--accent);
        }
        .mf-scale {
          display: grid; grid-template-columns: repeat(5, 1fr);
          font-size: 8.5px; letter-spacing: 0.14em;
          text-align: center;
        }
        .mf-scale span:first-child { text-align: left; }
        .mf-scale span:last-child { text-align: right; }
        .hud-select, .hud-input {
          width: 100%;
          padding: 8px 10px;
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--line-strong);
          color: var(--fg);
          font-size: 11px;
          letter-spacing: 0.08em;
        }
        .hud-select option { background: var(--bg-1); color: var(--fg); }
        .mf-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
      `}</style>
    </div>
  );
}
