import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Howl, Howler } from 'howler';
import onclickSrc from '../audio/onclick.wav?url';
import ondeleteSrc from '../audio/ondelete.wav?url';
import onhoverSrc from '../audio/onhover.wav?url';
import onpageloadSrc from '../audio/onpageload.wav?url';
import onshepherdSrc from '../audio/onshepherd.wav?url';
import ontypeSrc from '../audio/ontype.wav?url';

/** Howler-backed UI sound effects gated by the topbar audio toggle. */
export const SoundManager = (() => {
  let enabled = false;

  Howler.mute(true);

  /** Create a preloaded Howl for a WAV asset. */
  const make = (src: string, volume = 0.55) =>
    new Howl({
      src: [src],
      volume,
      preload: true,
    });

  const clickSound = make(onclickSrc, 0.5);
  const deleteSound = make(ondeleteSrc, 0.55);
  const hoverSound = make(onhoverSrc, 0.3);
  const pageLoadSound = make(onpageloadSrc, 0.6);
  const shepherdSound = make(onshepherdSrc, 0.55);
  const typeSound = make(ontypeSrc, 0.35);

  /** Play a Howl when audio is enabled. */
  const play = (sound: Howl) => {
    if (!enabled) {
      return;
    }

    sound.play();
  };

  return {
    /** Enable or disable sound output. */
    setEnabled(v: boolean) {
      enabled = !!v;
      Howler.mute(!enabled);
    },
    /** Whether sound is currently enabled. */
    isEnabled: () => enabled,
    /** Button / interactive hover. */
    hover() {
      play(hoverSound);
    },
    /** CTA / button click. */
    click() {
      play(clickSound);
    },
    /** Keyboard typing keydown. */
    type() {
      play(typeSound);
    },
    /** No-op confirm (no dedicated asset). */
    confirm() {},
    /** No-op deny (no dedicated asset). */
    deny() {},
    /** Screen / page transition stinger. */
    pageLoad() {
      play(pageLoadSound);
    },
    /** Alias for page-load stinger (login boot sequence). */
    boot() {
      play(pageLoadSound);
    },
    /** Delete-confirmation modal open. */
    delete() {
      play(deleteSound);
    },
    /** Shepherd tour modal open. */
    shepherd() {
      play(shepherdSound);
    },
  };
})();

/** Glitch-cycle text to a final string. */
export function DecodeText({
  text,
  delay = 0,
  speed = 28,
  charset,
  className = '',
  tag: Tag = 'span',
}: {
  text: string;
  delay?: number;
  speed?: number;
  charset?: string;
  className?: string;
  tag?: ElementType;
}) {
  const [out, setOut] = useState('');
  const cs = charset || '▒░▓01ABCDEF#%$@*+=-';

  useEffect(() => {
    let raf = 0;
    let started = false;
    let t0 = 0;
    const cycles = 8;
    const total = text.length;
    const tick = (ts: number) => {
      if (!started) {
        t0 = ts + delay;
        started = true;
      }
      const elapsed = Math.max(0, ts - t0);
      const progress = Math.min(total, Math.floor(elapsed / speed));
      let s = '';
      for (let i = 0; i < total; i++) {
        if (i < progress) s += text[i];
        else if (i < progress + cycles && text[i] !== ' ')
          s += cs[Math.floor(Math.random() * cs.length)];
        else s += '';
      }
      setOut(s);
      if (progress < total) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, speed, cs]);

  return <Tag className={className}>{out}</Tag>;
}

/** Tactical [ ] marker frame around children. */
export function Bracket({
  children,
  className = '',
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`bracket ${className}`} style={style}>
      <span className="br-tr" />
      <span className="br-bl" />
      {children}
    </div>
  );
}

const PANEL_SHADOW =
  '0 0 0 1px rgba(0,0,0,0.4), 0 var(--depth-shadow-1) var(--depth-shadow-2) rgba(0,0,0,0.55), 0 var(--depth-shadow-2) var(--depth-shadow-3) rgba(0,0,0,0.35)';

/** Core HUD panel container with optional header. */
export function Panel({
  title,
  meta,
  children,
  className = '',
  bodyClass = '',
  headerRight,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClass?: string;
  headerRight?: ReactNode;
}) {
  return (
    <div
      className={`relative border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(0,0,0,0.18)),var(--bg-1)] ${className}`}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      <span
        className="pointer-events-none absolute top-0 right-0 size-5.5 bg-[linear-gradient(225deg,var(--bg)_50%,transparent_50%)]"
        aria-hidden="true"
      />
      {title && (
        <div className="flex items-center justify-between border-b border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] px-3.5 py-2.5 max-phone:px-3 max-phone:py-2">
          <div className="inline-flex items-center gap-2.5 font-display text-xs font-semibold tracking-[0.22em] text-fg uppercase">
            <span
              className="size-2 rotate-45 bg-accent shadow-[0_0_10px_var(--accent)]"
              aria-hidden="true"
            />
            {title}
          </div>
          {(meta || headerRight) && (
            <div className="flex items-center gap-3">
              {meta && (
                <span className="font-mono text-[10px] tracking-[0.14em] text-fg-mute">{meta}</span>
              )}
              {headerRight}
            </div>
          )}
        </div>
      )}
      <div className={`p-pad-lg ${bodyClass}`}>{children}</div>
    </div>
  );
}

const BTN_BASE =
  'relative inline-flex items-center border border-line-strong bg-white/[0.02] px-3.5 py-2 font-display text-[11px] font-semibold tracking-[0.2em] text-fg uppercase transition-[background,color] duration-100 [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))] hover:bg-accent-soft hover:text-accent [&:active>span]:translate-y-px max-tablet:min-h-11';

const BTN_VARIANTS: Record<string, string> = {
  primary:
    'border-accent bg-accent text-bg hover:border-fg hover:bg-fg hover:text-bg',
  ghost:
    'border-transparent bg-transparent text-fg-dim hover:bg-accent-soft hover:text-accent',
  danger:
    'border-bad text-bad hover:bg-[rgba(255,84,84,0.1)] hover:text-bad',
};

/** HUD button with sound feedback and variant styles. */
export function Btn({
  children,
  onClick,
  variant,
  disabled,
  type = 'button',
  style,
  className = '',
  ...rest
}: {
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'ghost' | 'danger' | string;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  style?: CSSProperties;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'disabled' | 'style' | 'className'>) {
  const handler = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    SoundManager.click();
    onClick?.(e);
  };

  const variantClass = variant ? BTN_VARIANTS[variant] || '' : '';

  return (
    <button
      type={type}
      className={`${BTN_BASE} ${variantClass} ${className}`}
      onClick={handler}
      onMouseEnter={() => SoundManager.hover()}
      disabled={disabled}
      style={{ opacity: disabled ? 0.4 : 1, ...style }}
      {...rest}
    >
      <span className="inline-flex items-center gap-2.5 transition-transform duration-100">
        {children}
      </span>
    </button>
  );
}

/** Live clock updating once per second. */
export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

/** Zero-pad a number to two digits. */
export const pad = (n: number) => String(n).padStart(2, '0');

/** Format time as HH:MM:SS. */
export function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Format date as DD MON YYYY. */
export function fmtDate(d: Date) {
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${pad(d.getDate())} ${m[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format julian day of year. */
export function fmtJDay(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return String(Math.floor(diff / 86400000)).padStart(3, '0');
}

/** Format a log sequence number as a zero-padded 4-digit string. */
export function fmtSeq(n: number) {
  return String(n).padStart(4, '0');
}

/** Format as DDMMYYYY.HHmmss (24h). */
export function fmtStamp(d: Date) {
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Music-note audio icon; draws a slash when muted. */
function AudioIcon({ muted }: { muted: boolean }) {
  return (
    <span className="relative inline-flex size-4 items-center justify-center" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="size-4">
        <path
          fill="currentColor"
          d="m10.09 11.963l9.274-3.332v5.54a3.8 3.8 0 0 0-1.91-.501c-1.958 0-3.545 1.426-3.545 3.185s1.587 3.185 3.545 3.185c1.959 0 3.546-1.426 3.546-3.185V7.492c0-1.12 0-2.059-.088-2.807a7 7 0 0 0-.043-.31c-.084-.51-.234-.988-.522-1.386a2.2 2.2 0 0 0-.676-.617l-.009-.005c-.771-.461-1.639-.428-2.532-.224c-.864.198-1.936.6-3.25 1.095l-2.284.859c-.615.231-1.137.427-1.547.63c-.435.216-.81.471-1.092.851c-.281.38-.398.79-.452 1.234c-.05.418-.05.926-.05 1.525v7.794a3.8 3.8 0 0 0-1.91-.501C4.587 15.63 3 17.056 3 18.815S4.587 22 6.545 22c1.959 0 3.546-1.426 3.546-3.185z"
        />
      </svg>
      {muted && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="block h-px w-[140%] -rotate-45 bg-current shadow-[0_0_0_1px_var(--bg)]" />
        </span>
      )}
    </span>
  );
}

/** Logout / exit-to-app icon. */
function SignOutIcon() {
  return (
    <span className="inline-flex size-4 items-center justify-center" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="size-4">
        <path
          fill="currentColor"
          d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h6q.425 0 .713.288T12 4t-.288.713T11 5H5v14h6q.425 0 .713.288T12 20t-.288.713T11 21zm12.175-8H10q-.425 0-.712-.288T9 12t.288-.712T10 11h7.175L15.3 9.125q-.275-.275-.275-.675t.275-.7t.7-.313t.725.288L20.3 11.3q.3.3.3.7t-.3.7l-3.575 3.575q-.3.3-.712.288t-.713-.313q-.275-.3-.262-.712t.287-.688z"
        />
      </svg>
    </span>
  );
}

/** Top telemetry bar with brand, user, clock, and controls. */
export function TopBar({
  user,
  onSignOut,
  soundOn,
  onToggleSound,
  onOpenProfile,
  journaledDays,
}: {
  user: string;
  onSignOut: (() => void) | null;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenProfile?: (() => void) | null;
  /** Count of distinct days with a journal entry; null when signed out. */
  journaledDays: number | null;
}) {
  const now = useClock();

  return (
    <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line bg-[linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.1))] px-3 py-2 font-mono text-[11px] max-tablet:grid-cols-[1fr_auto] max-tablet:gap-2 max-tablet:px-2.5 desktop:gap-4 desktop:px-5.5">
      <div className="flex min-w-0 items-center gap-4 overflow-hidden text-fg-dim max-tablet:hidden desktop:gap-6">
        <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
          <span className="text-[9px] tracking-[0.18em] text-fg-mute">LINK</span>
          <span className="truncate text-fg">HOST · VERCEL+ATLAS</span>
        </span>
        {onOpenProfile ? (
          <button
            type="button"
            className="tap-target flex min-w-0 flex-col items-start gap-0.5 leading-none text-left hover:text-accent"
            onClick={() => {
              SoundManager.click();
              onOpenProfile();
            }}
            onMouseEnter={() => SoundManager.hover()}
            title="Open profile"
            aria-label="Open profile"
            data-tour="tour-profile-top"
          >
            <span className="text-[9px] tracking-[0.18em] text-fg-mute">USER</span>
            <span className="truncate text-fg">{user || '—'}</span>
          </button>
        ) : (
          <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
            <span className="text-[9px] tracking-[0.18em] text-fg-mute">USER</span>
            <span className="truncate text-fg">{user || '—'}</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1 px-1 leading-none max-tablet:col-start-1 max-tablet:justify-self-start">
        <span className="font-display text-sm font-semibold tracking-[0.32em] text-fg">JOURNS</span>
        <span className="text-[9px] tracking-[0.22em] text-fg-mute max-tablet:hidden">
          // FIELD JOURNAL · v.2026.5
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-5 overflow-hidden text-fg-dim desktop:gap-8">
        <div className="flex min-w-0 items-center gap-4 overflow-hidden max-tablet:hidden desktop:gap-6">
          <span className="flex flex-col items-end gap-0.5 leading-none">
            <span className="text-[9px] tracking-[0.18em] text-fg-mute">J-DAY</span>
            <span className="text-fg">
              {journaledDays === null ? '—' : String(journaledDays).padStart(3, '0')}
            </span>
          </span>
          <span className="flex min-w-0 flex-col items-end gap-0.5 leading-none">
            <span className="text-[9px] tracking-[0.18em] text-fg-mute">GMT+8</span>
            <span className="truncate text-fg">{fmtStamp(now)}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 border-l border-line pl-5 max-tablet:border-0 max-tablet:pl-0 desktop:pl-8">
          {onOpenProfile && (
            <button
              type="button"
              className={`tap-target shrink-0 ${BTN_BASE} ${BTN_VARIANTS.ghost} px-2 py-1.5 max-tablet:min-h-11 tablet:hidden`}
              onClick={() => {
                SoundManager.click();
                onOpenProfile();
              }}
              onMouseEnter={() => SoundManager.hover()}
              title="Open profile"
              aria-label="Open profile"
            >
              ID
            </button>
          )}
          <button
            type="button"
            className={`tap-target shrink-0 ${BTN_BASE} ${BTN_VARIANTS.ghost} px-2 py-1.5 max-tablet:min-h-11 max-tablet:min-w-11`}
            onClick={() => {
              const next = !soundOn;
              SoundManager.setEnabled(next);
              onToggleSound();

              if (next) {
                SoundManager.click();
              }
            }}
            onMouseEnter={() => SoundManager.hover()}
            title={soundOn ? 'Mute audio' : 'Enable audio'}
            aria-label={soundOn ? 'Mute audio' : 'Enable audio'}
            aria-pressed={soundOn}
          >
            <AudioIcon muted={!soundOn} />
          </button>
          {onSignOut && (
            <button
              type="button"
              className={`tap-target shrink-0 ${BTN_BASE} ${BTN_VARIANTS.ghost} px-2 py-1.5 max-tablet:min-h-11 max-tablet:min-w-11`}
              onClick={() => {
                SoundManager.click();
                onSignOut();
              }}
              onMouseEnter={() => SoundManager.hover()}
              title="Sign out"
              aria-label="Sign out"
            >
              <SignOutIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Parallax backdrop layers with scanlines and beam. */
export function Backdrop({ depth }: { depth: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!ref.current) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      const k = depth / 100;
      const layers = ref.current.querySelectorAll<HTMLElement>('[data-layer]');
      layers.forEach((el, i) => {
        const m = (i + 1) * 6 * k;
        el.style.transform = `translate3d(${-x * m}px, ${-y * m}px, 0)`;
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [depth]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden perspective-distant"
    >
      <div
        data-layer
        className="absolute inset-[-8%] bg-[url('/contour.svg')] bg-size-[1600px_1200px] bg-repeat opacity-40 mix-blend-screen will-change-transform"
      />
      <div
        data-layer
        className="absolute inset-[-8%] bg-[url('/hexgrid.svg')] bg-size-[240px_208px] bg-repeat opacity-[0.18] will-change-transform"
      />
      <div
        data-layer
        className="absolute inset-[-8%] bg-[radial-gradient(ellipse_80%_60%_at_50%_35%,transparent_30%,var(--bg)_95%)] opacity-[0.85] will-change-transform"
      />
      <div className="bg-scan absolute inset-0" />
      <div className="bg-beam" />
    </div>
  );
}

/** Blinking caret indicator. */
export function Caret({ className = '' }: { className?: string }) {
  return (
    <span
      className={`ml-0.5 inline-block h-[1em] w-[0.6em] animate-caret bg-accent align-[-0.15em] shadow-[0_0_8px_var(--accent)] ${className}`}
    />
  );
}

/** Themed HUD dropdown that matches field / panel styling. */
export function HudSelect({
  value,
  options,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    /** Close the menu when clicking outside. */
    const onDoc = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    /** Close the menu on Escape. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 border border-line-strong bg-black/40 px-2.5 py-2 font-mono text-[11px] tracking-[0.08em] text-fg transition-[border-color,background] duration-100 hover:border-accent hover:bg-accent-soft max-tablet:min-h-11"
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <span className="min-w-0 truncate">{value}</span>
        <span
          className={`shrink-0 text-[9px] tracking-[0.14em] text-fg-mute transition-transform duration-100 ${open ? 'rotate-180 text-accent' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-52 overflow-auto border border-line-strong bg-bg-1 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
        >
          {options.map((opt) => {
            const selected = opt === value;

            return (
              <li key={opt} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left font-mono text-[11px] tracking-[0.08em] transition-[background,color] duration-75 max-tablet:min-h-11 ${
                    selected
                      ? 'bg-accent-soft text-accent'
                      : 'text-fg hover:bg-accent-soft hover:text-accent'
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <span>{opt}</span>
                  {selected && (
                    <span className="text-[9px] tracking-[0.14em]" aria-hidden="true">
                      ●
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
