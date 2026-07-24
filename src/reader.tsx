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

const CHIP =
  'border px-[7px] py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-accent bg-accent-soft border-[color-mix(in_oklab,var(--accent)_35%,transparent)]';

/** Single-entry reader with metadata and op-log side panels. */
export function ReaderScreen({ entry, onBack, onEdit, onDelete }: ReaderScreenProps) {
  const d = new Date(entry.date);
  const wc = entry.body.trim().split(/\s+/).length;
  const rt = Math.max(1, Math.round(wc / 200));

  return (
    <div className="mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7">
      <div className="mb-5.5 grid grid-cols-1 items-center gap-3 tablet:grid-cols-[auto_1fr_auto] tablet:gap-4.5">
        <Btn variant="ghost" onClick={onBack}>
          ◂ ARCHIVE
        </Btn>
        <div className="min-w-0 truncate text-center font-mono text-[10px] tracking-[0.18em] text-fg-mute max-tablet:order-first max-tablet:text-left">
          ARCHIVE / {fmtDate(d).replace(/ /g, '·')} / {entry.id}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => onEdit(entry)}>✎ EDIT</Btn>
          <Btn variant="danger" onClick={() => onDelete(entry)}>
            ✕ DELETE
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 tablet:grid-cols-[minmax(0,1fr)_minmax(0,320px)] tablet:gap-5.5">
        <main className="min-w-0">
          <Panel
            title={<DecodeText text="LOG ENTRY" />}
            meta={`${entry.id} · WC ${wc} · ${rt} MIN`}
            headerRight={
              <span className="font-mono text-[10px] tracking-[0.02em] text-fg-dim max-phone:hidden">
                STATUS · ARCHIVED
              </span>
            }
          >
            <div className="relative mb-5.5 flex flex-col gap-3 border-b border-line pb-5.5">
              <span
                className="absolute -bottom-px left-0 h-px w-20 bg-accent shadow-[0_0_8px_var(--accent)]"
                aria-hidden="true"
              />
              <div className="flex items-center gap-3.5">
                <div className="font-mono text-[44px] leading-none tracking-[0.02em] max-phone:text-[36px]">
                  {pad(d.getDate())}
                </div>
                <div>
                  <div className="font-display text-sm tracking-[0.18em] uppercase">
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
                  <div className="mt-1 font-mono text-[11px] tracking-[0.14em] text-fg-mute">
                    {fmtTime(d)} · J-DAY {fmtJDay(d)}
                  </div>
                </div>
              </div>
              <h1 className="font-display text-[38px] leading-[1.1] font-medium tracking-[0.01em] text-balance max-phone:text-[28px]">
                <DecodeText text={entry.title} speed={14} />
              </h1>
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map((t) => (
                  <span key={t} className={CHIP}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="max-w-[68ch] text-[15px] leading-[1.75] text-fg text-pretty max-phone:text-[14px]">
              {entry.body.split('\n').map((para, i) => (
                <p key={i} className={para.trim() === '' ? 'h-[0.6em]' : 'mb-[1em]'}>
                  {para || '\u00A0'}
                </p>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap justify-between gap-2 border-t border-line pt-3.5 font-mono text-[10px] tracking-[0.16em] text-fg-mute">
              <span>END OF LOG · {entry.id}</span>
              <span>
                SHA-256 · {entry.id.toUpperCase()}-{Math.abs(hashCode(entry.body)).toString(16).padStart(8, '0')}
              </span>
            </div>
          </Panel>
        </main>

        <aside className="min-w-0">
          <Panel title="METADATA" meta="SIGNAL · HIGH">
            <div className="flex flex-col gap-row">
              {(
                [
                  ['CAPTURED', `${fmtDate(d)} · ${fmtTime(d)}`, 'mono'],
                  ['WEATHER', entry.weather.split(' · ')[0], 'mono'],
                  ['MOOD', null, 'mood'],
                  ['ENERGY', null, 'energy'],
                  ['WORD COUNT', String(wc), 'mono acc'],
                  ['READ TIME', `~ ${rt} MIN`, 'mono'],
                ] as const
              ).map(([lbl, val, kind]) => (
                <div
                  key={lbl}
                  className="flex items-center justify-between gap-3 border-l-2 border-line-strong bg-black/20 px-2.5 py-2"
                >
                  <span className="font-mono text-[9.5px] tracking-[0.18em] text-fg-mute">{lbl}</span>
                  <span className="min-w-0 text-right text-[11.5px]">
                    {kind === 'mood' ? (
                      <MoodBars value={entry.mood} />
                    ) : kind === 'energy' ? (
                      <MoodBars value={entry.energy} />
                    ) : (
                      <span
                        className={
                          kind.includes('acc')
                            ? 'font-mono tracking-[0.02em] text-accent'
                            : 'font-mono tracking-[0.02em]'
                        }
                      >
                        {val}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <div className="h-3.5" />
          <Panel title="DB · OPERATION LOG">
            <div className="flex flex-col gap-1 font-mono text-[10.5px]">
              {(
                [
                  [fmtTime(d), 'INSERT', `_id: ${entry.id}`, true],
                  [fmtTime(new Date(d.getTime() + 1200)), 'SYNC', 'cluster.ATL-07', false],
                  [fmtTime(new Date(d.getTime() + 1800)), 'ACK', 'replica 3/3', true],
                  [fmtTime(new Date()), 'FETCH', 'operator-01', false],
                ] as const
              ).map(([time, tag, id, good]) => (
                <div
                  key={`${time}-${tag}`}
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

/** Simple string hash for display checksums. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
