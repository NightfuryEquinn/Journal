// composer.tsx — console-style writer
import { useEffect, useRef, useState } from 'react';
import type { JournalEntry } from './types';
import { SoundManager, DecodeText, Panel, Btn, Caret, HudSelect, fmtDate, fmtTime, pad } from './hud';

const MOOD_OPTS = ['LOW', 'DIM', 'STEADY', 'GOOD', 'HIGH'];
const ENERGY_OPTS = ['DRAINED', 'LOW', 'STEADY', 'CHARGED', 'PEAKED'];
const WEATHER_OPTS = ['CLEAR', 'OVERCAST', 'WINDY', 'LIGHT RAIN', 'HEAVY RAIN', 'FOG', 'SNOW'] as const;

/** Resolve a stored weather string to a known condition label. */
function resolveWeather(raw?: string): string {
  const label = (raw || '').split(' · ')[0].trim();

  return WEATHER_OPTS.includes(label as (typeof WEATHER_OPTS)[number])
    ? label
    : WEATHER_OPTS[0];
}

type SavingState = 'idle' | 'saving' | 'saved';

interface ComposerScreenProps {
  existing: JournalEntry | null;
  onSave: (entry: JournalEntry) => void | Promise<void>;
  onCancel: () => void;
  onDelete: (entry: JournalEntry) => void;
}

const CHIP =
  'border px-[7px] py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-accent bg-accent-soft border-[color-mix(in_oklab,var(--accent)_35%,transparent)]';

const HUD_FIELD =
  'w-full border border-line-strong bg-black/40 px-2.5 py-2 font-mono text-[11px] tracking-[0.08em] text-fg';

/** Console-style composer for creating or editing journal entries. */
export function ComposerScreen({ existing, onSave, onCancel, onDelete }: ComposerScreenProps) {
  const isEdit = !!existing;
  const now = new Date();
  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [mood, setMood] = useState(existing?.mood ?? 4);
  const [energy, setEnergy] = useState(existing?.energy ?? 3);
  const [weather, setWeather] = useState(() => resolveWeather(existing?.weather));
  const [tagsStr, setTagsStr] = useState((existing?.tags || []).join(', '));
  const [savingState, setSavingState] = useState<SavingState>('idle');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const wc = body.trim() ? body.trim().split(/\s+/).length : 0;
  const cc = body.length;

  /** Play type sound on keystroke. */
  const handleType = () => SoundManager.type();

  /** Validate and commit the entry with a short write animation. */
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
      setTimeout(() => {
        void onSave(entry);
      }, 400);
    }, 700);
  };

  return (
    <div className="mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7">
      <div className="mb-5.5 grid grid-cols-1 items-center gap-3 tablet:grid-cols-[auto_1fr_auto] tablet:gap-4.5">
        <Btn variant="ghost" onClick={onCancel}>
          ◂ DISCARD
        </Btn>
        <div className="min-w-0 truncate text-center font-mono text-[10px] tracking-[0.18em] text-fg-mute max-tablet:order-first max-tablet:text-left">
          {isEdit ? 'ARCHIVE / EDIT' : 'ARCHIVE / NEW LOG'} · OPERATOR-01
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="grid grid-cols-1 items-start gap-5 tablet:grid-cols-[minmax(0,1fr)_minmax(0,320px)] tablet:gap-5.5">
        <main className="min-w-0">
          <Panel
            title={<DecodeText text="CONSOLE · COMPOSE" />}
            meta={`${isEdit ? 'PATCH' : 'INSERT'} · e2ee`}
            headerRight={
              <span className="font-mono text-[10px] tracking-[0.02em] text-fg-dim max-phone:hidden">
                {savingState === 'saving' ? (
                  <span className="text-accent">// encrypting · PUT /api/entries …</span>
                ) : savingState === 'saved' ? (
                  <span className="text-good">// ack · atlas durable</span>
                ) : (
                  '// awaiting input'
                )}
              </span>
            }
          >
            <div className="font-mono text-[13px] leading-[1.7]">
              <div className="py-1 text-fg-dim">
                <span className="font-mono tracking-[0.02em] text-fg-dim">$</span>
                <span className="font-mono tracking-[0.02em] text-accent"> operator@journs:</span>
                <span className="font-mono tracking-[0.02em] text-fg-dim">
                  ~/log/{now.getFullYear()}/{pad(now.getMonth() + 1)}/${' '}
                </span>
                <span className="font-mono tracking-[0.02em]">
                  {isEdit && existing ? `patch ${existing.id}` : 'new --title'}
                </span>
              </div>
              <div className="mb-2.5 flex items-center border-b border-dashed border-line py-2.5">
                <label className="mr-2.5 font-mono text-xs tracking-[0.02em] text-fg-dim">
                  title:
                </label>
                <input
                  ref={titleRef}
                  className="min-w-0 flex-1 font-mono text-lg tracking-[0.04em] text-accent placeholder:text-fg-mute"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    handleType();
                  }}
                  placeholder="enter title …"
                  spellCheck={false}
                />
                {title === '' && <Caret />}
              </div>
              <div className="py-1 text-fg-dim">
                <span className="font-mono tracking-[0.02em] text-fg-dim">$ body --multiline</span>
              </div>
              <div className="relative mt-1.5 grid grid-cols-[36px_1fr] border border-line-strong bg-black/40 max-phone:grid-cols-1">
                <div
                  className="select-none border-r border-line bg-black/40 py-3 pr-2 text-right font-mono text-[10.5px] leading-[1.7] text-fg-mute max-phone:hidden"
                  aria-hidden="true"
                >
                  {Array.from({ length: Math.max(12, body.split('\n').length) }, (_, i) => (
                    <div key={i}>{pad(i + 1)}</div>
                  ))}
                </div>
                <textarea
                  ref={bodyRef}
                  className="min-h-90 w-full resize-y px-3.5 py-3 font-mono text-[13px] leading-[1.7] text-fg placeholder:text-fg-mute max-phone:min-h-70"
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
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 font-mono text-[10px] tracking-[0.14em] text-fg-mute">
                <span>
                  WC <span className="text-accent">{wc}</span>
                </span>
                <span>
                  CC <span className="text-accent">{cc}</span>
                </span>
                <span>
                  LN <span className="text-accent">{body.split('\n').length}</span>
                </span>
                <span className="flex-1" />
                <span className="max-phone:hidden">⌘ + ↵ TO COMMIT</span>
              </div>
            </div>
          </Panel>
        </main>

        <aside className="min-w-0">
          <Panel title="METADATA" meta="REQUIRED">
            <div className="flex flex-col gap-4.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] tracking-[0.2em] text-fg-mute">
                  DATE / TIME
                </label>
                <div className="font-mono text-xs tracking-[0.02em] text-accent">
                  {fmtDate(now)} · {fmtTime(now)}
                </div>
                <span className="font-mono text-[9.5px] tracking-[0.02em] text-fg-mute">
                  // auto-captured
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] tracking-[0.2em] text-fg-mute">
                  MOOD{' '}
                  <span className="tracking-[0.06em] text-fg-mute">
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
                <div className="grid grid-cols-5 text-center font-mono text-[8.5px] tracking-[0.14em] text-fg-mute">
                  <span className="text-left">LOW</span>
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                  <span className="text-right">HIGH</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] tracking-[0.2em] text-fg-mute">
                  ENERGY{' '}
                  <span className="tracking-[0.06em] text-fg-mute">
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
                <div className="grid grid-cols-5 text-center font-mono text-[8.5px] tracking-[0.14em] text-fg-mute">
                  <span className="text-left">DRAINED</span>
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                  <span className="text-right">PEAKED</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] tracking-[0.2em] text-fg-mute">WEATHER</label>
                <HudSelect
                  aria-label="Weather"
                  value={weather}
                  options={WEATHER_OPTS}
                  onChange={setWeather}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] tracking-[0.2em] text-fg-mute">
                  TAGS <span className="tracking-[0.06em] text-fg-mute">comma-separated</span>
                </label>
                <input
                  className={HUD_FIELD}
                  value={tagsStr}
                  onChange={(e) => {
                    setTagsStr(e.target.value);
                    SoundManager.type();
                  }}
                  placeholder="recon, self, …"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  {tagsStr
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t, i) => (
                      <span key={i} className={CHIP}>
                        #{t}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </Panel>

          <div className="h-3.5" />
          <Panel title="DB · WRITE PATH">
            <div className="flex flex-col gap-1 font-mono text-[10.5px]">
              {(
                [
                  ['→', 'ENCRYPT', 'aes-gcm · local dek', false],
                  ['→', isEdit ? 'UPSERT' : 'INSERT', 'atlas.entries ciphertext', false],
                  ['→', 'SYNC', 'vercel /api/entries', false],
                  ['→', 'ACK', 'durable', true],
                ] as const
              ).map(([time, tag, id, good]) => (
                <div
                  key={tag}
                  className="grid grid-cols-[70px_60px_1fr] items-center gap-2 py-1 text-fg-dim max-phone:grid-cols-[auto_auto_1fr]"
                >
                  <span>{time}</span>
                  <span
                    className={`text-[9.5px] tracking-[0.14em] ${good ? 'text-good' : 'text-fg'}`}
                  >
                    {tag}
                  </span>
                  <span className="overflow-hidden text-[10px] tracking-[0.06em] text-ellipsis whitespace-nowrap text-fg-mute">
                    {id}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
