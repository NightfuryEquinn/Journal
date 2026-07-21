// list.tsx — entry list with timeline / calendar / stack layouts
import { useMemo, useState } from 'react';
import type { JournalEntry, ListLayout } from './types';
import { SoundManager, DecodeText, Bracket, Panel, Btn, fmtDate, fmtTime, pad } from './hud';

interface MoodBarsProps {
  value: number;
  label?: string;
}

export function MoodBars({ value, label }: MoodBarsProps) {
  return (
    <div className="mood-bars" title={`${label || 'MOOD'} ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? 'on' : ''} />
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
}

export function ListScreen({
  entries,
  onOpen,
  onNew,
  layout,
  onLayoutChange,
  onDelete,
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
    <div className="list-wrap">
      <div className="list-controls">
        <Bracket className="search-bracket">
          <div className="search-box">
            <span className="acc mono" style={{ marginRight: 8 }}>
              ⌕
            </span>
            <input
              type="text"
              placeholder="QUERY · TITLE OR BODY"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}>
                ✕
              </button>
            )}
          </div>
        </Bracket>
        <div className="list-layout-switch">
          <span className="cap mute" style={{ fontSize: 9 }}>
            LAYOUT
          </span>
          {(['timeline', 'stack'] as const).map((k) => (
            <button
              key={k}
              className={layout === k ? 'lswitch on' : 'lswitch'}
              onClick={() => {
                onLayoutChange(k);
                SoundManager.click();
              }}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <Btn variant="primary" onClick={onNew}>
          + NEW ENTRY
        </Btn>
      </div>

      <div className="list-row">
        <aside className="list-side">
          <Panel title="ARCHIVE" meta={`${entries.length} entries`}>
            <div className="archive-stats">
              <div className="stat">
                <span className="lbl">TOTAL</span>
                <span className="val mono">{entries.length.toString().padStart(4, '0')}</span>
              </div>
              <div className="stat">
                <span className="lbl">FIRST</span>
                <span className="val mono">
                  {fmtDate(new Date(entries[entries.length - 1]?.date || Date.now()))}
                </span>
              </div>
              <div className="stat">
                <span className="lbl">LAST</span>
                <span className="val mono">{fmtDate(new Date(entries[0]?.date || Date.now()))}</span>
              </div>
              <div className="stat">
                <span className="lbl">AVG MOOD</span>
                <span className="val mono acc">
                  {(entries.reduce((s, e) => s + e.mood, 0) / Math.max(1, entries.length)).toFixed(1)}
                  /5
                </span>
              </div>
            </div>
          </Panel>
          <div style={{ height: 14 }} />
          <Panel title="TAGS" meta={`${allTags.length} total`}>
            <div className="tag-list">
              <button
                className={!tagFilter ? 'tag on' : 'tag'}
                onClick={() => {
                  setTagFilter(null);
                  SoundManager.click();
                }}
              >
                <span className="dot-sm" />
                ALL
                <span className="count">{entries.length}</span>
              </button>
              {allTags.map((t) => {
                const n = entries.filter((e) => e.tags.includes(t)).length;
                return (
                  <button
                    key={t}
                    className={tagFilter === t ? 'tag on' : 'tag'}
                    onClick={() => {
                      setTagFilter(tagFilter === t ? null : t);
                      SoundManager.click();
                    }}
                  >
                    <span className="dot-sm" />
                    {t}
                    <span className="count">{n}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </aside>

        <main className="list-main">
          {layout === 'timeline' && (
            <TimelineLayout entries={filtered} onOpen={onOpen} onDelete={onDelete} />
          )}
          {layout === 'stack' && <StackLayout entries={filtered} onOpen={onOpen} />}
          {filtered.length === 0 && (
            <div className="empty mono dim">// no entries match. clear filters or create a new log.</div>
          )}
        </main>
      </div>

      <style>{`
        .list-wrap { padding: 20px 28px 28px; max-width: 1400px; margin: 0 auto; }
        .list-controls {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 18px; align-items: center;
          margin-bottom: 22px;
        }
        .search-box {
          display: flex; align-items: center;
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--line-strong);
          padding: 8px 14px;
          font-family: var(--mono);
        }
        .search-box input { flex: 1; font-size: 13px; letter-spacing: 0.12em; }
        .search-box input::placeholder { color: var(--fg-mute); }
        .search-clear { color: var(--fg-mute); padding: 0 6px; }
        .list-layout-switch {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px;
          border: 1px solid var(--line);
        }
        .lswitch {
          padding: 6px 12px;
          font-family: var(--display, var(--sans));
          font-size: 10px; letter-spacing: 0.18em;
          color: var(--fg-mute);
        }
        .lswitch.on { color: var(--bg); background: var(--accent); }
        .list-row {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 22px;
          align-items: start;
        }
        .archive-stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--row-gap); }
        .stat { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px;
                background: rgba(0,0,0,0.25); border: 1px solid var(--line); }
        .stat .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em; color: var(--fg-mute); }
        .stat .val { font-size: 18px; }

        .tag-list { display: flex; flex-direction: column; gap: 4px; }
        .tag {
          display: grid; grid-template-columns: 14px 1fr auto; align-items: center;
          gap: 8px; padding: 7px 10px;
          font-family: var(--mono);
          font-size: 11px; color: var(--fg-dim);
          background: rgba(0,0,0,0.2);
          border: 1px solid transparent;
          text-align: left;
          letter-spacing: 0.06em;
        }
        .tag:hover { color: var(--fg); background: rgba(255,255,255,0.03); }
        .tag.on { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
        .tag .count { color: var(--fg-mute); font-size: 10px; }
        .dot-sm { width: 5px; height: 5px; background: currentColor; opacity: 0.7; }

        .empty { padding: 60px 0; text-align: center; }

        .mood-bars { display: inline-flex; gap: 2px; }
        .mood-bars span {
          width: 4px; height: 12px;
          background: var(--line-strong);
        }
        .mood-bars span.on { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
      `}</style>
    </div>
  );
}

interface EntryLayoutProps {
  entries: JournalEntry[];
  onOpen: (entry: JournalEntry) => void;
}

interface TimelineLayoutProps extends EntryLayoutProps {
  onDelete: (entry: JournalEntry) => void;
}

// ── Timeline layout ─────────────────────────────────────────────────────
function TimelineLayout({ entries, onOpen, onDelete }: TimelineLayoutProps) {
  return (
    <div className="timeline">
      <div className="timeline-spine" />
      {entries.map((e, i) => {
        const d = new Date(e.date);
        return (
          <div
            key={e.id}
            className="tl-row"
            onMouseEnter={() => SoundManager.hover()}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="tl-date">
              <div className="tl-day mono">{pad(d.getDate())}</div>
              <div className="tl-mo mono dim">
                {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][
                  d.getMonth()
                ]}
              </div>
              <div className="tl-yr mono mute">{d.getFullYear()}</div>
            </div>
            <div className="tl-node" />
            <div
              className="tl-card"
              onClick={() => {
                SoundManager.click();
                onOpen(e);
              }}
            >
              <div className="tl-card-h">
                <div className="tl-time mono mute">{fmtTime(d)}</div>
                <MoodBars value={e.mood} />
              </div>
              <div className="tl-title">
                <DecodeText text={e.title} speed={10} delay={i * 40} />
              </div>
              <div className="tl-preview">{e.body.split('\n')[0]}</div>
              <div className="tl-foot">
                <div className="tl-tags">
                  {e.tags.map((t) => (
                    <span key={t} className="chip mono">
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="tl-wx mono mute">{e.weather}</div>
              </div>
              <button
                className="tl-del"
                onClick={(ev) => {
                  ev.stopPropagation();
                  SoundManager.click();
                  onDelete(e);
                }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
      <style>{`
        .timeline {
          position: relative;
          padding-left: 80px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .timeline-spine {
          position: absolute; left: 92px; top: 6px; bottom: 6px;
          width: 1px; background: var(--line-strong);
        }
        .tl-row {
          display: grid;
          grid-template-columns: 80px 18px 1fr;
          gap: 0;
          align-items: stretch;
          animation: tl-in 0.5s both;
        }
        @keyframes tl-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: none; }
        }
        .tl-date {
          margin-left: -80px;
          padding-top: 18px;
          text-align: right;
          padding-right: 14px;
          line-height: 1.1;
        }
        .tl-day { font-size: 22px; }
        .tl-mo { font-size: 11px; letter-spacing: 0.16em; }
        .tl-yr { font-size: 9px; letter-spacing: 0.16em; }
        .tl-node {
          position: relative;
          width: 18px;
        }
        .tl-node::before {
          content: ""; position: absolute;
          top: 22px; left: 8px; width: 10px; height: 10px;
          background: var(--accent);
          transform: rotate(45deg);
          box-shadow: 0 0 12px var(--accent);
        }
        .tl-card {
          position: relative;
          padding: 14px 16px;
          margin-left: 12px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.012), rgba(0,0,0,0.18)),
            var(--bg-1);
          border: 1px solid var(--line-strong);
          cursor: pointer;
          transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.4),
            calc(var(--depth) * 0.06px) calc(var(--depth) * 0.2px) calc(var(--depth) * 0.4px) rgba(0,0,0,0.4);
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
        }
        .tl-card::before {
          content: ""; position: absolute;
          left: -12px; top: 22px; width: 12px; height: 1px;
          background: var(--line-strong);
        }
        .tl-card:hover {
          transform: translateY(-2px) translateX(2px);
          border-color: var(--accent);
        }
        .tl-card-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .tl-time { font-size: 10px; letter-spacing: 0.14em; }
        .tl-title {
          font-family: var(--display, var(--sans));
          font-size: 19px; font-weight: 500; letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .tl-preview {
          color: var(--fg-dim); font-size: 12.5px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          margin-bottom: 10px;
        }
        .tl-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .tl-tags { display: flex; gap: 5px; flex-wrap: wrap; }
        .chip {
          font-size: 9.5px; letter-spacing: 0.1em;
          padding: 2px 7px;
          color: var(--accent);
          background: var(--accent-soft);
          border: 1px solid rgba(255,138,61,0.3);
          border-color: color-mix(in oklab, var(--accent) 35%, transparent);
        }
        .tl-wx { font-size: 10px; letter-spacing: 0.14em; }
        .tl-del {
          position: absolute; top: 10px; right: 10px;
          width: 22px; height: 22px;
          color: var(--fg-mute);
          font-size: 11px;
          opacity: 0;
          transition: opacity 0.15s, color 0.15s;
        }
        .tl-card:hover .tl-del { opacity: 1; }
        .tl-del:hover { color: var(--bad); }
      `}</style>
    </div>
  );
}

// ── Calendar layout ─────────────────────────────────────────────────────
export function CalendarLayout({ entries, onOpen }: EntryLayoutProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const byDate = useMemo(() => {
    const m: Record<string, JournalEntry[]> = {};
    entries.forEach((e) => {
      const d = new Date(e.date);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (m[k] = m[k] || []).push(e);
    });
    return m;
  }, [entries]);

  const yr = cursor.getFullYear();
  const mo = cursor.getMonth();
  const firstDow = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const monthName = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ][mo];

  return (
    <Panel
      title={`${monthName} ${yr}`}
      meta={`${Object.keys(byDate).filter((k) => k.startsWith(`${yr}-${mo}-`)).length} entries this month`}
      headerRight={
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="ghost" onClick={() => setCursor(new Date(yr, mo - 1, 1))}>
            ◂ PREV
          </Btn>
          <Btn variant="ghost" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            TODAY
          </Btn>
          <Btn variant="ghost" onClick={() => setCursor(new Date(yr, mo + 1, 1))}>
            NEXT ▸
          </Btn>
        </div>
      }
    >
      <div className="cal-head">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
          <div key={d} className="cal-dow mono mute">
            {d}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cal-cell empty" />;
          const key = `${yr}-${mo}-${d}`;
          const list = byDate[key] || [];
          const isToday = d === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();
          return (
            <div key={i} className={`cal-cell ${isToday ? 'today' : ''} ${list.length ? 'has' : ''}`}>
              <div className="cal-day mono">{pad(d)}</div>
              <div className="cal-entries">
                {list.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    className="cal-entry"
                    onClick={() => {
                      SoundManager.click();
                      onOpen(e);
                    }}
                    title={e.title}
                  >
                    <span className="cal-entry-dot" />
                    <span className="cal-entry-title">{e.title}</span>
                  </button>
                ))}
                {list.length > 3 && <div className="cal-more mono mute">+{list.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .cal-head { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; margin-bottom: 6px; }
        .cal-dow { padding: 4px 8px; font-size: 9px; letter-spacing: 0.18em; }
        .cal-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .cal-cell {
          aspect-ratio: 1.2 / 1;
          padding: 8px;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--line);
          display: flex; flex-direction: column; gap: 6px;
          position: relative;
        }
        .cal-cell.empty { background: transparent; border-color: transparent; }
        .cal-cell.has { border-color: color-mix(in oklab, var(--accent) 25%, transparent); }
        .cal-cell.today { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .cal-cell.today::before {
          content: ""; position: absolute; top: 4px; right: 4px;
          width: 6px; height: 6px; background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
        }
        .cal-day { font-size: 12px; }
        .cal-entries { display: flex; flex-direction: column; gap: 3px; font-size: 10px; }
        .cal-entry {
          display: flex; align-items: center; gap: 5px;
          padding: 2px 0;
          text-align: left; min-width: 0;
        }
        .cal-entry-dot {
          width: 5px; height: 5px; background: var(--accent); flex-shrink: 0;
          box-shadow: 0 0 6px var(--accent);
        }
        .cal-entry-title {
          font-size: 10px; color: var(--fg);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cal-entry:hover .cal-entry-title { color: var(--accent); }
        .cal-more { font-size: 9px; letter-spacing: 0.1em; }
      `}</style>
    </Panel>
  );
}

// ── Stack layout ────────────────────────────────────────────────────────
function StackLayout({ entries, onOpen }: EntryLayoutProps) {
  return (
    <div className="stack-grid">
      {entries.map((e, i) => {
        const d = new Date(e.date);
        return (
          <div
            key={e.id}
            className="stack-card"
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => {
              SoundManager.click();
              onOpen(e);
            }}
            onMouseEnter={() => SoundManager.hover()}
          >
            <div className="stack-h">
              <div className="stack-h-l">
                <span className="cap dim" style={{ fontSize: 9 }}>
                  LOG · {String(i + 1).padStart(4, '0')}
                </span>
                <span className="mono mute" style={{ fontSize: 10 }}>
                  {fmtDate(d)} · {fmtTime(d).slice(0, 5)}
                </span>
              </div>
              <MoodBars value={e.mood} />
            </div>
            <div className="stack-title">
              <DecodeText text={e.title} speed={10} delay={i * 60} />
            </div>
            <div className="stack-preview">{e.body.split('\n').slice(0, 3).join(' ')}</div>
            <div className="stack-foot">
              <div className="tl-tags">
                {e.tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip mono">
                    #{t}
                  </span>
                ))}
              </div>
              <span className="mono mute" style={{ fontSize: 10 }}>
                {e.weather.split(' · ')[0]}
              </span>
            </div>
            <div className="stack-corner" />
          </div>
        );
      })}
      <style>{`
        .stack-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .stack-card {
          position: relative;
          padding: 16px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.015), rgba(0,0,0,0.2)),
            var(--bg-1);
          border: 1px solid var(--line-strong);
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
          animation: tl-in 0.5s both;
          clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
          min-height: 200px;
          display: flex; flex-direction: column; gap: 10px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.4),
            calc(var(--depth) * 0.04px) calc(var(--depth) * 0.15px) calc(var(--depth) * 0.3px) rgba(0,0,0,0.5);
        }
        .stack-card:hover { transform: translateY(-3px); border-color: var(--accent); }
        .stack-h { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .stack-h-l { display: flex; flex-direction: column; gap: 2px; }
        .stack-title {
          font-family: var(--display, var(--sans));
          font-size: 18px; line-height: 1.2; font-weight: 500;
          margin-top: 4px;
        }
        .stack-preview {
          color: var(--fg-dim); font-size: 12px; line-height: 1.5;
          flex: 1;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
        }
        .stack-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .stack-corner {
          position: absolute; bottom: 8px; right: 8px;
          width: 14px; height: 14px;
          border-right: 1px solid var(--accent);
          border-bottom: 1px solid var(--accent);
        }
      `}</style>
    </div>
  );
}
