// list.tsx — entry list with timeline / stack layouts
import { useMemo, useRef, useState } from 'react';
import {
  CompassIcon,
  MagnifyingGlassIcon,
  NotebookIcon,
  PlusIcon,
  RowsIcon,
  SquaresFourIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { JournalEntry, ListLayout } from './types';
import { CHIP, DecodeText, Bracket, Panel, Btn, MoodBars, WeatherIcon } from './hud';
import { SoundManager } from './sound';
import { fmtDate, fmtTime, fmtSeq, pad, MONTHS_SHORT } from './format';
import { maybeStartTour, resetTour } from './tours';
import { useEntrance } from './motion';

/** Compact delete control shown beside mood bars. */
function EntryDeleteBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      className="tap-target pointer-events-auto flex size-6 shrink-0 items-center justify-center text-fg-mute opacity-100 transition-[opacity,color] duration-150 hover:text-bad max-tablet:min-h-11 max-tablet:min-w-11 tablet:opacity-0 tablet:group-hover:opacity-100 tablet:group-focus-within:opacity-100"
      onClick={(ev) => {
        ev.stopPropagation();
        SoundManager.click();
        onDelete();
      }}
      onMouseEnter={() => SoundManager.hover()}
      title="Delete"
      aria-label="Delete entry"
    >
      <TrashIcon className="size-3.5" weight="bold" />
    </button>
  );
}

/** Six shimmer placeholders shown while the archive syncs from Atlas. */
function ArchiveSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex h-50 animate-pulse flex-col gap-3 border border-line bg-black/20 p-4"
        >
          <div className="h-3 w-20 bg-line-strong/60" />
          <div className="h-5 w-3/4 bg-line-strong/60" />
          <div className="mt-1 flex-1 space-y-2">
            <div className="h-2.5 w-full bg-line/70" />
            <div className="h-2.5 w-5/6 bg-line/70" />
            <div className="h-2.5 w-2/3 bg-line/70" />
          </div>
          <div className="h-4 w-16 bg-line-strong/60" />
        </div>
      ))}
    </div>
  );
}

interface ListScreenProps {
  entries: JournalEntry[];
  onOpen: (entry: JournalEntry) => void;
  onNew: () => void;
  layout: ListLayout;
  onLayoutChange: (layout: ListLayout) => void;
  onDelete: (entry: JournalEntry) => void;
  loading?: boolean;
}

/** Archive list with search, tags, and timeline/stack layouts. */
export function ListScreen({
  entries,
  onOpen,
  onNew,
  layout,
  onLayoutChange,
  onDelete,
  loading = false,
}: ListScreenProps) {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  useEntrance(scopeRef);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => set.add(t)));

    return Array.from(set).sort();
  }, [entries]);
  // Log numbers count up from the oldest entry, so they stay put while the
  // list is searched, filtered, or re-sorted.
  const seqById = useMemo(() => {
    const m = new Map<string, number>();
    [...entries]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((e, i) => m.set(e.id, i + 1));

    return m;
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

  /** Clear the query and tag filter together. */
  const clearFilters = () => {
    setSearch('');
    setTagFilter(null);
    SoundManager.click();
  };

  return (
    <div
      ref={scopeRef}
      className="mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7"
    >
      <div data-reveal className="mb-5.5 flex items-baseline justify-between gap-3">
        <h1 className="font-headline text-2xl font-semibold tracking-[0.02em] text-fg">Archive</h1>
        <span className="font-mono text-meta tracking-[0.14em] text-fg-mute">
          {loading ? 'syncing…' : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
        </span>
      </div>

      <div
        data-reveal
        className="mb-5.5 flex flex-col gap-3 tablet:grid tablet:grid-cols-[1fr_auto_auto_auto] tablet:items-center tablet:gap-4.5"
      >
        <Bracket className="min-w-0 w-full">
          <div className="flex items-center border border-line-strong bg-black/40 px-3.5 py-2 font-mono">
            <MagnifyingGlassIcon className="mr-2 size-4 shrink-0 text-accent" weight="bold" />
            <input
              type="text"
              className="min-w-0 flex-1 text-body tracking-[0.06em] placeholder:text-fg-mute"
              placeholder="Search title or body"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={() => SoundManager.type()}
              spellCheck={false}
            />
            {search && (
              <button
                type="button"
                className="tap-target px-1.5 text-fg-mute max-tablet:min-h-11 max-tablet:min-w-11"
                onClick={() => setSearch('')}
                onMouseEnter={() => SoundManager.hover()}
                aria-label="Clear search"
              >
                <XIcon className="size-3.5" weight="bold" />
              </button>
            )}
          </div>
        </Bracket>
        <div className="inline-flex w-full items-center gap-1.5 border border-line p-1 tablet:w-auto">
          {(['timeline', 'stack'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`tap-target flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 font-headline text-micro tracking-[0.18em] max-tablet:min-h-11 tablet:flex-none ${
                layout === k ? 'bg-accent text-bg' : 'text-fg-mute'
              }`}
              onClick={() => {
                onLayoutChange(k);
                SoundManager.click();
              }}
              onMouseEnter={() => SoundManager.hover()}
              aria-pressed={layout === k}
            >
              {k === 'timeline' ? (
                <RowsIcon className="size-3.5" weight="bold" />
              ) : (
                <SquaresFourIcon className="size-3.5" weight="bold" />
              )}
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <Btn
          variant="ghost"
          className="w-full tablet:w-auto"
          onClick={() => {
            resetTour();
            maybeStartTour();
          }}
        >
          <CompassIcon className="size-3.5" weight="bold" />
          REPLAY TOUR
        </Btn>
        <Btn
          variant="primary"
          onClick={onNew}
          className="w-full tablet:w-auto"
          data-tour="tour-compose"
        >
          <PlusIcon className="size-3.5" weight="bold" />
          NEW ENTRY
        </Btn>
      </div>

      <div
        data-reveal
        className="grid grid-cols-1 items-start gap-5 tablet:grid-cols-[minmax(0,280px)_1fr] tablet:gap-5.5"
        data-tour="tour-archive"
      >
        <aside className="min-w-0">
          <Panel title="ARCHIVE" meta={loading ? 'syncing…' : `${entries.length} entries`}>
            <div className="grid grid-flow-dense grid-cols-2 gap-row phone:grid-cols-4 tablet:grid-cols-2">
              {(
                [
                  ['TOTAL', entries.length.toString().padStart(4, '0'), false],
                  [
                    'FIRST',
                    entries.length ? fmtDate(new Date(entries[entries.length - 1]!.date)) : '—',
                    false,
                  ],
                  ['LAST', entries.length ? fmtDate(new Date(entries[0]!.date)) : '—', false],
                  [
                    'AVG MOOD',
                    entries.length
                      ? `${(entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1)}/5`
                      : '—',
                    true,
                  ],
                ] as const
              ).map(([lbl, val, accent]) => (
                <div
                  key={lbl}
                  className="flex flex-col gap-1 border border-line bg-black/25 px-2.5 py-2"
                >
                  <span className="font-mono text-micro tracking-[0.18em] text-fg-mute">{lbl}</span>
                  <span
                    className={`truncate font-mono text-ui tracking-[0.02em] phone:text-lg ${accent ? 'text-accent' : ''}`}
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
                className={`tap-target grid grid-cols-[14px_1fr_auto] items-center gap-2 border px-2.5 py-1.75 text-left font-mono text-meta tracking-[0.06em] max-tablet:inline-flex max-tablet:shrink-0 max-tablet:grid-cols-none max-tablet:min-h-11 ${
                  !tagFilter
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-black/20 text-fg-dim hover:bg-white/3 hover:text-fg'
                }`}
                onClick={() => {
                  setTagFilter(null);
                  SoundManager.click();
                }}
                onMouseEnter={() => SoundManager.hover()}
              >
                <span className="size-1.25 shrink-0 bg-current opacity-70" />
                ALL
                <span className="text-micro text-fg-mute">{entries.length}</span>
              </button>
              {allTags.map((t) => {
                const n = entries.filter((e) => e.tags.includes(t)).length;

                return (
                  <button
                    key={t}
                    type="button"
                    className={`tap-target grid grid-cols-[14px_1fr_auto] items-center gap-2 border px-2.5 py-1.75 text-left font-mono text-meta tracking-[0.06em] max-tablet:inline-flex max-tablet:shrink-0 max-tablet:grid-cols-none max-tablet:min-h-11 ${
                      tagFilter === t
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-black/20 text-fg-dim hover:bg-white/3 hover:text-fg'
                    }`}
                    onClick={() => {
                      setTagFilter(tagFilter === t ? null : t);
                      SoundManager.click();
                    }}
                    onMouseEnter={() => SoundManager.hover()}
                  >
                    <span className="size-1.25 shrink-0 bg-current opacity-70" />
                    {t}
                    <span className="text-micro text-fg-mute">{n}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </aside>

        <main className="min-w-0">
          {loading && <ArchiveSkeleton />}
          {!loading && layout === 'timeline' && (
            <TimelineLayout
              entries={filtered}
              seqById={seqById}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          )}
          {!loading && layout === 'stack' && (
            <StackLayout entries={filtered} seqById={seqById} onOpen={onOpen} onDelete={onDelete} />
          )}
          {!loading && filtered.length === 0 && entries.length === 0 && (
            <Bracket>
              <Panel>
                <div className="flex flex-col items-center gap-3.5 py-10 text-center">
                  <NotebookIcon className="size-10 text-fg-mute" weight="duotone" />
                  <p className="font-mono text-body text-fg-dim">
                    // archive empty · write your first encrypted log
                  </p>
                  <Btn variant="primary" onClick={onNew}>
                    <PlusIcon className="size-3.5" weight="bold" />
                    WRITE FIRST LOG
                  </Btn>
                </div>
              </Panel>
            </Bracket>
          )}
          {!loading && filtered.length === 0 && entries.length > 0 && (
            <div className="flex flex-col items-center gap-3 py-15 text-center max-phone:py-8">
              <p className="font-mono text-body tracking-[0.02em] text-fg-dim">
                // no entries match. clear filters or create a new log.
              </p>
              <Btn variant="ghost" onClick={clearFilters}>
                <XIcon className="size-3.5" weight="bold" />
                CLEAR FILTERS
              </Btn>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface EntryLayoutProps {
  entries: JournalEntry[];
  /** Entry id → sequential log number, oldest entry first. */
  seqById: Map<string, number>;
  onOpen: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}

/** Vertical timeline of journal entries. */
function TimelineLayout({ entries, seqById, onOpen, onDelete }: EntryLayoutProps) {
  return (
    <div className="relative flex flex-col gap-1.75 pl-0 max-phone:pl-0 tablet:pl-10">
      <div className="absolute top-1.5 bottom-1.5 left-12 w-px bg-line-strong max-tablet:hidden" />
      {entries.map((e, i) => {
        const d = new Date(e.date);

        return (
          <div
            key={e.id}
            className="grid grid-cols-1 items-stretch max-tablet:gap-2 tablet:grid-cols-[80px_18px_1fr]"
            onMouseEnter={() => SoundManager.hover()}
          >
            <div className="flex items-baseline gap-2 pt-0 text-left leading-[1.1] tablet:-ml-20 tablet:block tablet:pr-3.5 tablet:pt-4.5 tablet:text-right">
              <div className="font-mono text-[22px] tracking-[0.02em]">{pad(d.getDate())}</div>
              <div className="font-mono text-meta tracking-[0.16em] text-fg-dim">
                {MONTHS_SHORT[d.getMonth()]}
              </div>
              <div className="font-mono text-micro tracking-[0.16em] text-fg-mute">
                {d.getFullYear()}
              </div>
            </div>
            <div className="relative w-4.5 max-tablet:hidden">
              <span
                className="absolute top-5.5 left-2 size-2.5 rotate-45 bg-accent shadow-[0_0_12px_var(--accent)]"
                aria-hidden="true"
              />
            </div>
            <article
              className="group relative ml-0 border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(0,0,0,0.18)),var(--bg-1)] p-3.5 pr-4 transition-[transform,border-color,box-shadow] duration-180 [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))] hover:translate-x-0.5 hover:-translate-y-0.5 hover:border-accent tablet:ml-3"
              style={{
                boxShadow:
                  '0 0 0 1px rgba(0,0,0,0.4), calc(var(--depth) * 0.06px) calc(var(--depth) * 0.2px) calc(var(--depth) * 0.4px) rgba(0,0,0,0.4)',
              }}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-pointer"
                aria-label={`Open entry ${e.title}`}
                onClick={() => {
                  SoundManager.click();
                  onOpen(e);
                }}
              />
              <span
                className="absolute top-5.5 -left-3 h-px w-3 bg-line-strong max-tablet:hidden"
                aria-hidden="true"
              />
              <div className="pointer-events-none relative z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-micro tracking-[0.14em] text-fg-mute">
                    LOG · {fmtSeq(seqById.get(e.id) ?? 0)} · {fmtTime(d)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <EntryDeleteBtn onDelete={() => onDelete(e)} />
                    <MoodBars value={e.mood} />
                  </div>
                </div>
                <h3 className="font-headline text-lg leading-[1.15] font-medium tracking-[0.01em] text-fg">
                  <DecodeText text={e.title} speed={10} delay={i * 40} />
                </h3>
                <div className="line-clamp-2 text-body text-fg-dim">{e.body.split('\n')[0]}</div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap gap-1.25">
                    {e.tags.map((t) => (
                      <span key={t} className={CHIP}>
                        #{t}
                      </span>
                    ))}
                  </div>
                  <span className="flex items-center gap-1 font-mono text-micro tracking-[0.14em] text-fg-mute">
                    <WeatherIcon weather={e.weather} className="size-3.5" />
                    {e.weather.split(' · ')[0]}
                  </span>
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}

/** Card grid stack of journal entries. */
function StackLayout({ entries, seqById, onOpen, onDelete }: EntryLayoutProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5">
      {entries.map((e, i) => {
        const d = new Date(e.date);

        return (
          <article
            key={e.id}
            className="group relative flex min-h-50 flex-col gap-2.5 border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(0,0,0,0.2)),var(--bg-1)] p-4 transition-[transform,border-color] duration-200 [clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))] hover:-translate-y-0.75 hover:border-accent"
            style={{
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.4), calc(var(--depth) * 0.04px) calc(var(--depth) * 0.15px) calc(var(--depth) * 0.3px) rgba(0,0,0,0.5)',
            }}
            onMouseEnter={() => SoundManager.hover()}
          >
            <button
              type="button"
              className="absolute inset-0 z-0 cursor-pointer"
              aria-label={`Open entry ${e.title}`}
              onClick={() => {
                SoundManager.click();
                onOpen(e);
              }}
            />
            <div className="pointer-events-none relative z-10 flex h-full flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-headline text-micro font-medium tracking-[0.12em] text-fg-dim uppercase">
                    LOG · {fmtSeq(seqById.get(e.id) ?? 0)}
                  </span>
                  <span className="font-mono text-meta tracking-[0.02em] text-fg-mute">
                    {fmtDate(d)} · {fmtTime(d).slice(0, 5)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <EntryDeleteBtn onDelete={() => onDelete(e)} />
                  <MoodBars value={e.mood} />
                </div>
              </div>
              <h3 className="mt-1 font-headline text-lg leading-[1.2] font-medium text-fg">
                <DecodeText text={e.title} speed={10} delay={i * 60} />
              </h3>
              <div className="line-clamp-4 flex-1 text-body leading-normal text-fg-dim">
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
                <span className="flex items-center gap-1 font-mono text-meta tracking-[0.02em] text-fg-mute">
                  <WeatherIcon weather={e.weather} className="size-3.5" />
                  {e.weather.split(' · ')[0]}
                </span>
              </div>
            </div>
            <div className="pointer-events-none absolute right-2 bottom-2 z-10 size-3.5 border-r border-b border-accent" />
          </article>
        );
      })}
    </div>
  );
}
