// reader.tsx — read a single entry
import type { JournalEntry } from './types';
import { DecodeText, Panel, Btn, fmtDate, fmtTime, fmtJDay, pad } from './hud';
import { MoodBars } from './list';

interface ReaderScreenProps {
  entry: JournalEntry;
  onBack: () => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}

export function ReaderScreen({ entry, onBack, onEdit, onDelete }: ReaderScreenProps) {
  const d = new Date(entry.date);
  const wc = entry.body.trim().split(/\s+/).length;
  const rt = Math.max(1, Math.round(wc / 200));

  return (
    <div className="reader-wrap">
      <div className="reader-top">
        <Btn variant="ghost" onClick={onBack}>
          ◂ ARCHIVE
        </Btn>
        <div className="reader-crumbs mono mute">
          ARCHIVE / {fmtDate(d).replace(/ /g, '·')} / {entry.id}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => onEdit(entry)}>✎ EDIT</Btn>
          <Btn variant="danger" onClick={() => onDelete(entry)}>
            ✕ DELETE
          </Btn>
        </div>
      </div>

      <div className="reader-row">
        <main className="reader-main">
          <Panel
            title={<DecodeText text="LOG ENTRY" />}
            meta={`${entry.id} · WC ${wc} · ${rt} MIN`}
            headerRight={
              <span className="mono dim" style={{ fontSize: 10 }}>
                STATUS · ARCHIVED
              </span>
            }
          >
            <div className="reader-head">
              <div className="reader-date-block">
                <div className="rd-day mono">{pad(d.getDate())}</div>
                <div>
                  <div className="rd-mo">
                    {
                      [
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
                      ][d.getMonth()]
                    }{' '}
                    {d.getFullYear()}
                  </div>
                  <div className="rd-time mono mute">
                    {fmtTime(d)} · J-DAY {fmtJDay(d)}
                  </div>
                </div>
              </div>
              <h1 className="reader-title">
                <DecodeText text={entry.title} speed={14} />
              </h1>
              <div className="reader-tagrow">
                {entry.tags.map((t) => (
                  <span key={t} className="chip mono">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="reader-body">
              {entry.body.split('\n').map((para, i) => (
                <p key={i} className={para.trim() === '' ? 'p-blank' : 'p'}>
                  {para || '\u00A0'}
                </p>
              ))}
            </div>

            <div className="reader-foot mono mute">
              <span>END OF LOG · {entry.id}</span>
              <span>
                SHA-256 · {entry.id.toUpperCase()}-{Math.abs(hashCode(entry.body)).toString(16).padStart(8, '0')}
              </span>
            </div>
          </Panel>
        </main>

        <aside className="reader-side">
          <Panel title="METADATA" meta="SIGNAL · HIGH">
            <div className="meta-grid">
              <div className="m-row">
                <span className="m-lbl">CAPTURED</span>
                <span className="m-val mono">
                  {fmtDate(d)} · {fmtTime(d)}
                </span>
              </div>
              <div className="m-row">
                <span className="m-lbl">WEATHER</span>
                <span className="m-val mono">{entry.weather}</span>
              </div>
              <div className="m-row">
                <span className="m-lbl">MOOD</span>
                <span className="m-val">
                  <MoodBars value={entry.mood} />
                </span>
              </div>
              <div className="m-row">
                <span className="m-lbl">ENERGY</span>
                <span className="m-val">
                  <MoodBars value={entry.energy} />
                </span>
              </div>
              <div className="m-row">
                <span className="m-lbl">WORD COUNT</span>
                <span className="m-val mono acc">{wc}</span>
              </div>
              <div className="m-row">
                <span className="m-lbl">READ TIME</span>
                <span className="m-val mono">~ {rt} MIN</span>
              </div>
              <div className="m-row">
                <span className="m-lbl">PRIVACY</span>
                <span className="m-val mono acc">OPERATOR-ONLY</span>
              </div>
            </div>
          </Panel>
          <div style={{ height: 14 }} />
          <Panel title="DB · OPERATION LOG">
            <div className="op-log mono">
              <div className="op-line">
                <span className="op-time">{fmtTime(d)}</span>
                <span className="op-tag good">INSERT</span>
                <span className="op-id">_id: {entry.id}</span>
              </div>
              <div className="op-line">
                <span className="op-time">{fmtTime(new Date(d.getTime() + 1200))}</span>
                <span className="op-tag">SYNC</span>
                <span className="op-id">cluster.ATL-07</span>
              </div>
              <div className="op-line">
                <span className="op-time">{fmtTime(new Date(d.getTime() + 1800))}</span>
                <span className="op-tag good">ACK</span>
                <span className="op-id">replica 3/3</span>
              </div>
              <div className="op-line">
                <span className="op-time">{fmtTime(new Date())}</span>
                <span className="op-tag">FETCH</span>
                <span className="op-id">operator-01</span>
              </div>
            </div>
          </Panel>
        </aside>
      </div>

      <style>{`
        .reader-wrap { padding: 20px 28px 28px; max-width: 1400px; margin: 0 auto; }
        .reader-top {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 18px; align-items: center;
          margin-bottom: 22px;
        }
        .reader-crumbs { font-size: 10px; letter-spacing: 0.18em; text-align: center; }
        .reader-row {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 22px;
          align-items: start;
        }
        .reader-head {
          display: flex; flex-direction: column; gap: 12px;
          padding-bottom: 22px;
          margin-bottom: 22px;
          border-bottom: 1px solid var(--line);
          position: relative;
        }
        .reader-head::after {
          content: ""; position: absolute; left: 0; bottom: -1px;
          width: 80px; height: 1px;
          background: var(--accent); box-shadow: 0 0 8px var(--accent);
        }
        .reader-date-block { display: flex; gap: 14px; align-items: center; }
        .rd-day { font-size: 44px; line-height: 1; }
        .rd-mo {
          font-family: var(--display, var(--sans));
          font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase;
        }
        .rd-time { font-size: 11px; letter-spacing: 0.14em; margin-top: 4px; }
        .reader-title {
          font-family: var(--display, var(--sans));
          font-size: 38px; font-weight: 500; line-height: 1.1;
          letter-spacing: 0.01em;
          text-wrap: balance;
        }
        .reader-tagrow { display: flex; gap: 6px; flex-wrap: wrap; }
        .reader-body {
          font-size: 15px; line-height: 1.75;
          color: var(--fg);
          text-wrap: pretty;
          max-width: 68ch;
        }
        .reader-body .p { margin-bottom: 1em; }
        .reader-body .p-blank { height: 0.6em; }
        .reader-foot {
          margin-top: 28px; padding-top: 14px;
          border-top: 1px solid var(--line);
          display: flex; justify-content: space-between;
          font-size: 10px; letter-spacing: 0.16em;
        }
        .meta-grid { display: flex; flex-direction: column; gap: var(--row-gap); }
        .m-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 10px;
          background: rgba(0,0,0,0.2);
          border-left: 2px solid var(--line-strong);
        }
        .m-lbl { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.18em; color: var(--fg-mute); }
        .m-val { font-size: 11.5px; }

        .op-log { display: flex; flex-direction: column; gap: 4px; font-size: 10.5px; }
        .op-line {
          display: grid;
          grid-template-columns: 70px 60px 1fr;
          gap: 8px; align-items: center;
          padding: 4px 0;
          color: var(--fg-dim);
        }
        .op-tag { color: var(--fg); font-size: 9.5px; letter-spacing: 0.14em; }
        .op-tag.good { color: var(--good); }
        .op-id { font-size: 10px; color: var(--fg-mute); letter-spacing: 0.06em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
