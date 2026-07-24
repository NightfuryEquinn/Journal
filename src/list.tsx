// list.tsx — entry list with timeline / stack layouts
import { useMemo, useState } from 'react';
import type { JournalEntry, ListLayout } from './types';
import { SoundManager, DecodeText, Bracket, Panel, Btn, fmtDate, fmtTime, pad } from './hud';

interface MoodBarsProps {
  value: number;
  label?: string;
}

const CHIP =
  'border px-[7px] py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-accent bg-accent-soft border-[color-mix(in_oklab,var(--accent)_35%,transparent)]';

/** Five-segment mood/energy indicator bars. */
export function MoodBars({ value, label }: MoodBarsProps) {
  return (
    <div className="inline-flex gap-0.5" title={`${label || 'MOOD'} ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-3 w-1 ${i <= value ? 'bg-accent shadow-[0_0_6px_var(--accent)]' : 'bg-line-strong'}`}
        />
      ))}
    </div>
  );
}

/** Compact delete control shown beside mood bars. */
function EntryDeleteBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      className="tap-target flex size-5.5 shrink-0 items-center justify-center text-[11px] text-fg-mute transition-colors duration-150 hover:text-bad max-tablet:min-h-11 max-tablet:min-w-11"
      onClick={(ev) => {
        ev.stopPropagation();
        SoundManager.click();
        onDelete();
      }}
      title="Delete"
      aria-label="Delete"
    >
      ✕
    </button>
  );
}

interface ListScreenProps {
  entries: JournalEntry[];
  onOpen: (entry: JournalEntry) => void;
  onNew: () => void;
  layout: ListLayout;
  onLayoutChange: (layout: ListLayout) => void;
  onDelete: (entry: JournalEntry) => void;
  onOpenProfile: () => void;
}

/** Archive list with search, tags, and timeline/stack layouts. */
export function ListScreen({
  entries,
  onOpen,
  onNew,
  layout,
  onLayoutChange,
  onDelete,
  onOpenProfile,
}: ListScreenProps) {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => set.add(t)));

    return Array.from(set).sort();
  }, [entries]);
  const filtered = useMemo(
    () =>
      entries
        .filter((e) => !tagFilter || e.tags.includes(tagFilter))
        .filter(
          (e) =>
            !search ||
            e.title.toLowerCase().includes(search.toLowerCase()) ||
            e.body.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries, search, tagFilter],
  );

  return (
    <div className="mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7">
      <div className="mb-5.5 flex flex-col gap-3 tablet:grid tablet:grid-cols-[1fr_auto_auto_auto] tablet:items-center tablet:gap-4.5">
        <Bracket className="min-w-0 w-full">
          <div className="flex items-center border border-line-strong bg-black/40 px-3.5 py-2 font-mono">
            <span className="mr-2 font-mono tracking-[0.02em] text-accent">⌕</span>
            <input
              type="text"
              className="min-w-0 flex-1 text-[13px] tracking-[0.12em] placeholder:text-fg-mute"
              placeholder="QUERY · TITLE OR BODY"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="tap-target px-1.5 text-fg-mute max-tablet:min-h-11 max-tablet:min-w-11"
                onClick={() => setSearch('')}
              >
                ✕
              </button>
            )}
          </div>
        </Bracket>
        <div className="inline-flex w-full items-center gap-1.5 border border-line p-1 tablet:w-auto">
          {(['timeline', 'stack'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`tap-target flex-1 px-3 py-1.5 font-display text-[10px] tracking-[0.18em] max-tablet:min-h-11 tablet:flex-none ${
                layout === k ? 'bg-accent text-bg' : 'text-fg-mute'
              }`}
              onClick={() => {
                onLayoutChange(k);
                SoundManager.click();
              }}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <Btn variant="ghost" onClick={onOpenProfile} className="w-full tablet:w-auto">
          PROFILE
        </Btn>
        <Btn variant="primary" onClick={onNew} className="w-full tablet:w-auto">
          + NEW ENTRY
        </Btn>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 tablet:grid-cols-[minmax(0,280px)_1fr] tablet:gap-5.5">
        <aside className="min-w-0">
          <Panel title="ARCHIVE" meta={`${entries.length} entries`}>
            <div className="grid grid-cols-2 gap-row">
              {(
                [
                  ['TOTAL', entries.length.toString().padStart(4, '0'), false],
                  [
                    'FIRST',
                    fmtDate(new Date(entries[entries.length - 1]?.date || Date.now())),
                    false,
                  ],
                  ['LAST', fmtDate(new Date(entries[0]?.date || Date.now())), false],
                  [
                    'AVG MOOD',
                    `${(entries.reduce((s, e) => s + e.mood, 0) / Math.max(1, entries.length)).toFixed(1)}/5`,
                    true,
                  ],
                ] as const
              ).map(([lbl, val, accent]) => (
                <div
                  key={lbl}
                  className="flex flex-col gap-1 border border-line bg-black/25 px-2.5 py-2"
                >
                  <span className="font-mono text-[9px] tracking-[0.18em] text-fg-mute">{lbl}</span>
                  <span
                    className={`font-mono text-lg tracking-[0.02em] ${accent ? 'text-accent' : ''}`}
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <div className="h-3.5" />
          <Panel title="TAGS" meta={`${allTags.length} total`}>
            <div className="flex flex-col gap-1 overflow-y-auto max-tablet:max-h-none max-tablet:-mx-1 max-tablet:flex-row max-tablet:gap-1.5 max-tablet:overflow-x-auto max-tablet:px-1 max-tablet:pb-1 tablet:max-h-70">
              <button
                type="button"
                className={`tap-target grid grid-cols-[14px_1fr_auto] items-center gap-2 border px-2.5 py-1.75 text-left font-mono text-[11px] tracking-[0.06em] max-tablet:inline-flex max-tablet:shrink-0 max-tablet:grid-cols-none max-tablet:min-h-11 ${
                  !tagFilter
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-black/20 text-fg-dim hover:bg-white/3 hover:text-fg'
                }`}
                onClick={() => {
                  setTagFilter(null);
                  SoundManager.click();
                }}
              >
                <span className="size-1.25 shrink-0 bg-current opacity-70" />
                ALL
                <span className="text-[10px] text-fg-mute">{entries.length}</span>
              </button>
              {allTags.map((t) => {
                const n = entries.filter((e) => e.tags.includes(t)).length;

                return (
                  <button
                    key={t}
                    type="button"
                    className={`tap-target grid grid-cols-[14px_1fr_auto] items-center gap-2 border px-2.5 py-1.75 text-left font-mono text-[11px] tracking-[0.06em] max-tablet:inline-flex max-tablet:shrink-0 max-tablet:grid-cols-none max-tablet:min-h-11 ${
                      tagFilter === t
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-black/20 text-fg-dim hover:bg-white/3 hover:text-fg'
                    }`}
                    onClick={() => {
                      setTagFilter(tagFilter === t ? null : t);
                      SoundManager.click();
                    }}
                  >
                    <span className="size-1.25 shrink-0 bg-current opacity-70" />
                    {t}
                    <span className="text-[10px] text-fg-mute">{n}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </aside>

        <main className="min-w-0">
          {layout === 'timeline' && (
            <TimelineLayout entries={filtered} onOpen={onOpen} onDelete={onDelete} />
          )}
          {layout === 'stack' && (
            <StackLayout entries={filtered} onOpen={onOpen} onDelete={onDelete} />
          )}
          {filtered.length === 0 && (
            <div className="py-15 text-center font-mono tracking-[0.02em] text-fg-dim">
              // no entries match. clear filters or create a new log.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface EntryLayoutProps {
  entries: JournalEntry[];
  onOpen: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}

/** Vertical timeline of journal entries. */
function TimelineLayout({ entries, onOpen, onDelete }: EntryLayoutProps) {
  return (
    <div className="relative flex flex-col gap-1.75 pl-0 max-phone:pl-0 tablet:pl-10">
      <div className="absolute top-1.5 bottom-1.5 left-12 w-px bg-line-strong max-tablet:hidden" />
      {entries.map((e, i) => {
        const d = new Date(e.date);

        return (
          <div
            key={e.id}
            className="animate-tl-in grid grid-cols-1 items-stretch max-tablet:gap-2 tablet:grid-cols-[80px_18px_1fr]"
            onMouseEnter={() => SoundManager.hover()}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="flex items-baseline gap-2 pt-0 text-left leading-[1.1] tablet:-ml-20 tablet:block tablet:pr-3.5 tablet:pt-4.5 tablet:text-right">
              <div className="font-mono text-[22px] tracking-[0.02em]">{pad(d.getDate())}</div>
              <div className="font-mono text-[11px] tracking-[0.16em] text-fg-dim">
                {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][
                  d.getMonth()
                ]}
              </div>
              <div className="font-mono text-[9px] tracking-[0.16em] text-fg-mute">
                {d.getFullYear()}
              </div>
            </div>
            <div className="relative w-4.5 max-tablet:hidden">
              <span
                className="absolute top-5.5 left-2 size-2.5 rotate-45 bg-accent shadow-[0_0_12px_var(--accent)]"
                aria-hidden="true"
              />
            </div>
            <div
              className="group relative ml-0 cursor-pointer border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(0,0,0,0.18)),var(--bg-1)] p-3.5 pr-4 transition-[transform,border-color,box-shadow] duration-180 [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))] hover:translate-x-0.5 hover:-translate-y-0.5 hover:border-accent tablet:ml-3"
              style={{
                boxShadow:
                  '0 0 0 1px rgba(0,0,0,0.4), calc(var(--depth) * 0.06px) calc(var(--depth) * 0.2px) calc(var(--depth) * 0.4px) rgba(0,0,0,0.4)',
              }}
              onClick={() => {
                SoundManager.click();
                onOpen(e);
              }}
            >
              <span
                className="absolute top-5.5 -left-3 h-px w-3 bg-line-strong max-tablet:hidden"
                aria-hidden="true"
              />
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-mono text-[10px] tracking-[0.14em] text-fg-mute">
                  {fmtTime(d)}
                </div>
                <div className="flex items-center gap-1.5">
                  <EntryDeleteBtn onDelete={() => onDelete(e)} />
                  <MoodBars value={e.mood} />
                </div>
              </div>
              <div className="mb-2 font-display text-[19px] font-medium tracking-[0.04em]">
                <DecodeText text={e.title} speed={10} delay={i * 40} />
              </div>
              <div className="mb-2.5 line-clamp-2 text-[12.5px] text-fg-dim">
                {e.body.split('\n')[0]}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap gap-1.25">
                  {e.tags.map((t) => (
                    <span key={t} className={CHIP}>
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="font-mono text-[10px] tracking-[0.14em] text-fg-mute">
                  {e.weather.split(' · ')[0]}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Card grid stack of journal entries. */
function StackLayout({ entries, onOpen, onDelete }: EntryLayoutProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5">
      {entries.map((e, i) => {
        const d = new Date(e.date);

        return (
          <div
            key={e.id}
            className="group animate-tl-in relative flex min-h-50 cursor-pointer flex-col gap-2.5 border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(0,0,0,0.2)),var(--bg-1)] p-4 transition-[transform,border-color] duration-200 [clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))] hover:-translate-y-0.75 hover:border-accent"
            style={{
              animationDelay: `${i * 0.06}s`,
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.4), calc(var(--depth) * 0.04px) calc(var(--depth) * 0.15px) calc(var(--depth) * 0.3px) rgba(0,0,0,0.5)',
            }}
            onClick={() => {
              SoundManager.click();
              onOpen(e);
            }}
            onMouseEnter={() => SoundManager.hover()}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-display text-[9px] font-medium tracking-[0.12em] text-fg-dim uppercase">
                  LOG · {String(i + 1).padStart(4, '0')}
                </span>
                <span className="font-mono text-[10px] tracking-[0.02em] text-fg-mute">
                  {fmtDate(d)} · {fmtTime(d).slice(0, 5)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <EntryDeleteBtn onDelete={() => onDelete(e)} />
                <MoodBars value={e.mood} />
              </div>
            </div>
            <div className="mt-1 font-display text-lg leading-[1.2] font-medium">
              <DecodeText text={e.title} speed={10} delay={i * 60} />
            </div>
            <div className="line-clamp-4 flex-1 text-xs leading-normal text-fg-dim">
              {e.body.split('\n').slice(0, 3).join(' ')}
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex flex-wrap gap-1.25">
                {e.tags.slice(0, 3).map((t) => (
                  <span key={t} className={CHIP}>
                    #{t}
                  </span>
                ))}
              </div>
              <span className="font-mono text-[10px] tracking-[0.02em] text-fg-mute">
                {e.weather.split(' · ')[0]}
              </span>
            </div>
            <div className="absolute right-2 bottom-2 size-3.5 border-r border-b border-accent" />
          </div>
        );
      })}
    </div>
  );
}
