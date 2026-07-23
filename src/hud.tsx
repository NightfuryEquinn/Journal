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

/** Procedural UI sounds via the Web Audio API. */
export const SoundManager = (() => {
  let ctx: AudioContext | null = null;
  let enabled = false;

  /** Lazily create or resume the shared AudioContext. */
  const ensure = (): AudioContext | null => {
    if (!ctx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ctx = Ctx ? new Ctx() : null;
      } catch {
        ctx = null;
      }
    }

    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }

    return ctx;
  };

  /** Play a short oscillator tone, optionally sliding frequency. */
  const tone = (
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.04,
    slide = 0,
  ) => {
    if (!enabled) {
      return;
    }

    const c = ensure();

    if (!c) {
      return;
    }

    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(freq + slide, t0 + dur);
    }

    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  /** Play a short filtered noise burst. */
  const noise = (dur: number, vol = 0.025, hp = 1200) => {
    if (!enabled) {
      return;
    }

    const c = ensure();

    if (!c) {
      return;
    }

    const t0 = c.currentTime;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const ch = buf.getChannelData(0);

    for (let i = 0; i < ch.length; i++) {
      ch[i] = Math.random() * 2 - 1;
    }

    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  return {
    /** Enable or disable sound output. */
    setEnabled(v: boolean) {
      enabled = !!v;

      if (v) {
        ensure();
      }
    },
    /** Whether sound is currently enabled. */
    isEnabled: () => enabled,
    /** Soft hover blip. */
    hover() {
      tone(880 + Math.random() * 200, 0.04, 'sine', 0.02);
    },
    /** Click / select blip. */
    click() {
      tone(520, 0.06, 'square', 0.05, -120);
    },
    /** Keystroke tick with noise. */
    type() {
      const f = 1400 + Math.random() * 600;
      tone(f, 0.018, 'square', 0.015);
      noise(0.02, 0.012, 2000);
    },
    /** Success / confirm chime. */
    confirm() {
      tone(880, 0.08, 'sine', 0.04);
      setTimeout(() => tone(1320, 0.1, 'sine', 0.04), 80);
    },
    /** Error / deny buzz. */
    deny() {
      tone(220, 0.12, 'sawtooth', 0.05, -80);
    },
    /** Boot-sequence sweep. */
    boot() {
      tone(220, 0.4, 'sine', 0.05, 800);
      setTimeout(() => tone(660, 0.15, 'sine', 0.04), 200);
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
        className="pointer-events-none absolute top-0 right-0 size-[22px] bg-[linear-gradient(225deg,var(--bg)_50%,transparent_50%)]"
        aria-hidden="true"
      />
      {title && (
        <div className="flex items-center justify-between border-b border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] px-3.5 py-2.5">
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
  'relative inline-flex items-center gap-2.5 border border-line-strong bg-white/[0.02] px-3.5 py-2 font-display text-[11px] font-semibold tracking-[0.2em] text-fg uppercase transition-[background,color,transform] duration-100 [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))] hover:bg-accent-soft hover:text-accent active:translate-y-px max-tablet:min-h-11';

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
}: {
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'ghost' | 'danger' | string;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  style?: CSSProperties;
  className?: string;
}) {
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
    >
      {children}
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
          <span className="block h-px w-[140%] rotate-[-45deg] bg-current shadow-[0_0_0_1px_var(--bg)]" />
        </span>
      )}
    </span>
  );
}

/** Top telemetry bar with brand, user, clock, and controls. */
export function TopBar({
  user,
  status,
  onSignOut,
  soundOn,
  onToggleSound,
}: {
  user: string;
  status: string;
  onSignOut: (() => void) | null;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  const now = useClock();

  return (
    <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line bg-[linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.1))] px-3 py-2 font-mono text-[11px] max-tablet:grid-cols-[1fr_auto] max-tablet:gap-2 max-tablet:px-2.5 desktop:gap-4 desktop:px-[22px]">
      <div className="flex min-w-0 items-center gap-4 overflow-hidden text-fg-dim max-tablet:hidden desktop:gap-6">
        <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
          <span className="text-[9px] tracking-[0.18em] text-fg-mute">LINK</span>
          <span className="truncate text-fg">CLUSTER · ATL-07</span>
        </span>
        <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
          <span className="text-[9px] tracking-[0.18em] text-fg-mute">USER</span>
          <span className="truncate text-fg">{user || '—'}</span>
        </span>
        <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
          <span className="text-[9px] tracking-[0.18em] text-fg-mute">SESSION</span>
          <span className="truncate text-accent">{status}</span>
        </span>
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
            <span className="text-fg">{fmtJDay(now)}</span>
          </span>
          <span className="flex min-w-0 flex-col items-end gap-0.5 leading-none">
            <span className="text-[9px] tracking-[0.18em] text-fg-mute">GMT+8</span>
            <span className="truncate text-fg">
              {fmtDate(now)} · {fmtTime(now)}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 border-l border-line pl-5 max-tablet:border-0 max-tablet:pl-0 desktop:pl-8">
          <button
            type="button"
            className={`tap-target shrink-0 ${BTN_BASE} ${BTN_VARIANTS.ghost} px-2 py-1.5 max-tablet:min-h-11 max-tablet:min-w-11`}
            onClick={() => {
              onToggleSound();
              SoundManager.click();
            }}
            title={soundOn ? 'Mute audio' : 'Enable audio'}
            aria-label={soundOn ? 'Mute audio' : 'Enable audio'}
            aria-pressed={soundOn}
          >
            <AudioIcon muted={!soundOn} />
          </button>
          {onSignOut && (
            <button
              type="button"
              className={`tap-target shrink-0 ${BTN_BASE} ${BTN_VARIANTS.ghost} px-2 py-1 text-[9px] max-tablet:min-h-11 max-tablet:px-3`}
              onClick={() => {
                SoundManager.click();
                onSignOut();
              }}
            >
              ⎋ SIGN OUT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bottom status bar with left/right segments. */
export function StatusBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative z-10 flex items-center justify-between gap-2 overflow-hidden border-t border-line bg-[linear-gradient(0deg,rgba(0,0,0,0.55),rgba(0,0,0,0.1))] px-3 font-mono text-[10px] tracking-[0.12em] text-fg-mute max-phone:px-2.5 laptop:px-5.5">
      <div className="inline-flex min-w-0 items-center gap-2 overflow-hidden max-phone:gap-2 laptop:gap-3.5">
        {left}
      </div>
      <div className="inline-flex shrink-0 items-center gap-2 max-phone:gap-2 laptop:gap-3.5">
        {right}
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
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden [perspective:1200px]"
    >
      <div
        data-layer
        className="absolute inset-[-8%] bg-[url('/contour.svg')] bg-[length:1600px_1200px] bg-repeat opacity-40 mix-blend-screen will-change-transform"
      />
      <div
        data-layer
        className="absolute inset-[-8%] bg-[url('/hexgrid.svg')] bg-[length:240px_208px] bg-repeat opacity-[0.18] will-change-transform"
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
