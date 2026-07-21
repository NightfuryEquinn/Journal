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

// ── SoundManager (procedural via Web Audio) ─────────────────────────────
export const SoundManager = (() => {
  let ctx: AudioContext | null = null;
  let enabled = false;

  const ensure = (): AudioContext | null => {
    if (!ctx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ctx = Ctx ? new Ctx() : null;
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const tone = (
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.04,
    slide = 0,
  ) => {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq + slide, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  const noise = (dur: number, vol = 0.025, hp = 1200) => {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
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
    setEnabled(v: boolean) {
      enabled = !!v;
      if (v) ensure();
    },
    isEnabled: () => enabled,
    hover() {
      tone(880 + Math.random() * 200, 0.04, 'sine', 0.02);
    },
    click() {
      tone(520, 0.06, 'square', 0.05, -120);
    },
    type() {
      const f = 1400 + Math.random() * 600;
      tone(f, 0.018, 'square', 0.015);
      noise(0.02, 0.012, 2000);
    },
    confirm() {
      tone(880, 0.08, 'sine', 0.04);
      setTimeout(() => tone(1320, 0.1, 'sine', 0.04), 80);
    },
    deny() {
      tone(220, 0.12, 'sawtooth', 0.05, -80);
    },
    boot() {
      tone(220, 0.4, 'sine', 0.05, 800);
      setTimeout(() => tone(660, 0.15, 'sine', 0.04), 200);
    },
  };
})();

// ── DecodeText — glitch-cycle to final ──────────────────────────────────
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

// ── Bracket — tactical [ ] marker frame ────────────────────────────────
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

// ── Panel ──────────────────────────────────────────────────────────────
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
    <div className={`panel ${className}`}>
      {title && (
        <div className="panel-h">
          <div className="title">{title}</div>
          {(meta || headerRight) && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {meta && <span className="meta">{meta}</span>}
              {headerRight}
            </div>
          )}
        </div>
      )}
      <div className={`panel-body ${bodyClass}`}>{children}</div>
    </div>
  );
}

// ── Btn ────────────────────────────────────────────────────────────────
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
  return (
    <button
      type={type}
      className={`btn ${className}`}
      data-variant={variant}
      onClick={handler}
      onMouseEnter={() => SoundManager.hover()}
      disabled={disabled}
      style={{ opacity: disabled ? 0.4 : 1, ...style }}
    >
      {children}
    </button>
  );
}

// ── Telemetry / clock ──────────────────────────────────────────────────
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(d: Date) {
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${pad(d.getDate())} ${m[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtJDay(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return String(Math.floor(diff / 86400000)).padStart(3, '0');
}

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
  const weather =
    WEATHER[Math.min(WEATHER.length - 1, Math.floor((now.getMinutes() / 60) * WEATHER.length))];
  return (
    <div className="topbar">
      <div className="left">
        <span className="tel">
          <span className="dot" />
          <span className="lbl">LINK</span>
          <span className="val">CLUSTER · ATL-07</span>
        </span>
        <span className="tel">
          <span className="lbl">USER</span>
          <span className="val">{user || '—'}</span>
        </span>
        <span className="tel">
          <span className="lbl">SESSION</span>
          <span className="val acc">{status}</span>
        </span>
      </div>
      <div className="brand">
        <span className="title">MERIDIAN</span>
        <span className="sub">// FIELD JOURNAL · v.2026.5</span>
      </div>
      <div className="right">
        <span className="tel">
          <span className="lbl">J-DAY</span>
          <span className="val">{fmtJDay(now)}</span>
        </span>
        <span className="tel">
          <span className="lbl">UTC</span>
          <span className="val">
            {fmtDate(now)} · {fmtTime(now)}
          </span>
        </span>
        <span className="tel">
          <span className="lbl">WX</span>
          <span className="val">{weather}</span>
        </span>
        <button
          className="btn"
          data-variant="ghost"
          style={{ padding: '4px 8px', fontSize: 9 }}
          onClick={() => {
            onToggleSound();
            SoundManager.click();
          }}
          title="Toggle audio"
        >
          {soundOn ? '◉ AUDIO' : '○ AUDIO'}
        </button>
        {onSignOut && (
          <button
            className="btn"
            data-variant="ghost"
            style={{ padding: '4px 8px', fontSize: 9 }}
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
  );
}

const WEATHER = [
  'CLEAR · 14°C · NW 6km/h',
  'OVERCAST · 12°C · N 4km/h',
  'LIGHT RAIN · 11°C · W 9km/h',
  'FOG · 10°C · CALM',
  'CLEAR · 15°C · SW 5km/h',
];

export function StatusBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="statusbar">
      <div className="seg">{left}</div>
      <div className="seg">{right}</div>
    </div>
  );
}

// ── Backdrop layers w/ parallax ────────────────────────────────────────
export function Backdrop({ depth }: { depth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!ref.current) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      const k = depth / 100;
      const layers = ref.current.querySelectorAll<HTMLElement>('.layer');
      layers.forEach((el, i) => {
        const m = (i + 1) * 6 * k;
        el.style.transform = `translate3d(${-x * m}px, ${-y * m}px, 0)`;
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [depth]);
  return (
    <div className="bg-stack" ref={ref}>
      <div className="layer bg-contour" />
      <div className="layer bg-hex" />
      <div className="layer bg-vignette" />
      <div className="bg-scan" style={{ position: 'absolute', inset: 0 }} />
      <div className="bg-beam" />
    </div>
  );
}
