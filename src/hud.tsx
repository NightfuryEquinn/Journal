import {
  Component,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ElementType,
  type ErrorInfo,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  CaretDownIcon,
  CheckIcon,
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  SignOutIcon,
  SnowflakeIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  SunIcon,
  UserCircleIcon,
  WarningIcon,
  WindIcon,
} from '@phosphor-icons/react';
import { SoundManager } from './sound';
import { fmtTime, fmtUtcOffset } from './format';
import { prefersReducedMotion } from './motion';

/** Page wrapper shared by every authenticated screen. */
export const PAGE =
  'mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7';

/** Small tag chip used for entry/quest tags across list, reader, composer, profile. */
export const CHIP =
  'border px-[7px] py-0.5 font-mono text-micro tracking-[0.1em] text-accent bg-accent-soft border-[color-mix(in_oklab,var(--accent)_35%,transparent)]';

/** Glitch-cycle text to a final string. Renders the final text immediately under reduced motion. */
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
  const [out, setOut] = useState(() => (prefersReducedMotion() ? text : ''));
  const cs = charset || '▒░▓01ABCDEF#%$@*+=-';

  useEffect(() => {
    if (prefersReducedMotion()) {
      setOut(text);

      return;
    }

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
          <div className="inline-flex items-center gap-2.5 font-headline text-ui font-semibold tracking-[0.2em] text-fg uppercase">
            <span
              className="size-2 rotate-45 bg-accent shadow-[0_0_10px_var(--accent)]"
              aria-hidden="true"
            />
            {title}
          </div>
          {(meta || headerRight) && (
            <div className="flex items-center gap-3">
              {meta && (
                <span className="font-mono text-micro tracking-[0.14em] text-fg-mute">{meta}</span>
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
  'relative inline-flex items-center border border-line-strong bg-white/[0.02] px-3.5 py-2 font-headline text-meta font-semibold tracking-[0.2em] text-fg uppercase transition-[background,color,transform] duration-100 [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))] hover:bg-accent-soft hover:text-accent active:translate-y-px max-tablet:min-h-11';

const BTN_VARIANTS: Record<string, string> = {
  primary: 'border-accent bg-accent text-bg hover:border-fg hover:bg-fg hover:text-bg',
  ghost: 'border-transparent bg-transparent text-fg-dim hover:bg-accent-soft hover:text-accent',
  danger: 'border-bad text-bad hover:bg-[rgba(255,84,84,0.1)] hover:text-bad',
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
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'onClick' | 'disabled' | 'style' | 'className'
>) {
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
      <span className="inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

/** Live clock updating once per second. */
function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

/** Top telemetry bar with brand, user, clock, and controls. */
export function TopBar({
  user,
  onSignOut,
  soundOn,
  onToggleSound,
  onOpenProfile,
  onOpenLanding,
  journaledDays,
}: {
  user: string;
  onSignOut: (() => void) | null;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenProfile?: (() => void) | null;
  /** Navigate to the marketing landing page — the wordmark doubles as a home link. */
  onOpenLanding?: () => void;
  /** Count of distinct days with a journal entry; null when signed out. */
  journaledDays: number | null;
}) {
  const now = useClock();
  const CenterTag = onOpenLanding ? 'button' : 'div';

  return (
    <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line bg-bg/70 px-3 py-2 font-mono text-meta backdrop-blur-md max-tablet:grid-cols-[1fr_auto] max-tablet:gap-2 max-tablet:px-2.5 desktop:gap-4 desktop:px-5.5">
      <div className="flex min-w-0 items-center gap-4 overflow-hidden text-fg-dim max-tablet:hidden desktop:gap-6">
        <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
          <span className="text-micro tracking-[0.18em] text-fg-mute">LINK</span>
          <span className="truncate text-fg">HOST · VERCEL+ATLAS</span>
        </span>
      </div>

      <CenterTag
        type={onOpenLanding ? 'button' : undefined}
        className={`flex shrink-0 flex-col items-center gap-1 px-1 leading-none max-tablet:col-start-1 max-tablet:justify-self-start ${onOpenLanding ? 'tap-target transition-colors duration-100 hover:text-accent' : ''}`}
        onClick={
          onOpenLanding
            ? () => {
                SoundManager.click();
                onOpenLanding();
              }
            : undefined
        }
        onMouseEnter={onOpenLanding ? () => SoundManager.hover() : undefined}
        title={onOpenLanding ? 'About Journs' : undefined}
        aria-label={onOpenLanding ? 'About Journs' : undefined}
      >
        <span className="font-headline text-body font-semibold tracking-[0.32em] text-fg">
          JOURNS
        </span>
        <span className="text-micro tracking-[0.22em] text-fg-mute max-tablet:hidden">
          // FIELD JOURNAL · v.1.1.2
        </span>
      </CenterTag>

      <div className="flex min-w-0 items-center justify-end gap-3 overflow-hidden text-fg-dim desktop:gap-5">
        {onOpenProfile && (
          <button
            type="button"
            data-tour="tour-profile"
            className="tap-target flex min-w-0 items-center gap-2 px-1 leading-none hover:text-accent"
            onClick={() => {
              SoundManager.click();
              onOpenProfile();
            }}
            onMouseEnter={() => SoundManager.hover()}
            title="Open profile"
            aria-label="Open profile"
          >
            <UserCircleIcon className="size-4.5 shrink-0" weight="bold" />
            <span className="hidden min-w-0 flex-col items-start gap-0.5 tablet:flex">
              <span className="text-micro tracking-[0.18em] text-fg-mute">USER</span>
              <span className="max-w-30 truncate text-fg">{user || '—'}</span>
            </span>
          </button>
        )}

        <div className="flex min-w-0 items-center gap-4 overflow-hidden max-tablet:hidden desktop:gap-6">
          <span className="flex flex-col items-end gap-0.5 leading-none">
            <span className="text-micro tracking-[0.18em] text-fg-mute">J-DAY</span>
            <span className="text-fg">
              {journaledDays === null ? '—' : String(journaledDays).padStart(3, '0')}
            </span>
          </span>
          <span className="flex min-w-0 flex-col items-end gap-0.5 leading-none">
            <span className="text-micro tracking-[0.18em] text-fg-mute">{fmtUtcOffset(now)}</span>
            <span className="truncate text-fg">{fmtTime(now)}</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-l border-line pl-4 max-tablet:pl-0 desktop:pl-6">
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
            {soundOn ? (
              <SpeakerHighIcon className="size-4" weight="bold" />
            ) : (
              <SpeakerSlashIcon className="size-4" weight="bold" />
            )}
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
              <SignOutIcon className="size-4" weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Parallax backdrop layers with scanlines, grain and beam. */
export function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const onMove = (e: globalThis.MouseEvent) => {
      if (!ref.current) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      const k = 0.7;
      const layers = ref.current.querySelectorAll<HTMLElement>('[data-layer]');
      layers.forEach((el, i) => {
        const m = (i + 1) * 6 * k;
        el.style.transform = `translate3d(${-x * m}px, ${-y * m}px, 0)`;
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

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
      <div className="bg-grain absolute inset-0" />
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

/** Five-segment mood/energy indicator bars. */
export function MoodBars({ value, label }: { value: number; label?: string }) {
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

/** Map a stored weather string ("CLEAR", "LIGHT RAIN", …) to a Phosphor icon. */
export function WeatherIcon({
  weather,
  className = 'size-4',
}: {
  weather: string;
  className?: string;
}) {
  const label = weather.split(' · ')[0]?.trim().toUpperCase() ?? '';

  switch (label) {
    case 'OVERCAST':
      return <CloudIcon className={className} weight="bold" />;
    case 'WINDY':
      return <WindIcon className={className} weight="bold" />;
    case 'LIGHT RAIN':
    case 'HEAVY RAIN':
      return <CloudRainIcon className={className} weight="bold" />;
    case 'FOG':
      return <CloudFogIcon className={className} weight="bold" />;
    case 'SNOW':
      return <SnowflakeIcon className={className} weight="bold" />;
    case 'STORM':
      return <CloudLightningIcon className={className} weight="bold" />;
    default:
      return <SunIcon className={className} weight="bold" />;
  }
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
        className="flex w-full items-center justify-between gap-2 border border-line-strong bg-black/40 px-2.5 py-2 font-mono text-meta tracking-[0.08em] text-fg transition-[border-color,background] duration-100 hover:border-accent hover:bg-accent-soft max-tablet:min-h-11"
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <span className="min-w-0 truncate">{value}</span>
        <CaretDownIcon
          className={`size-3 shrink-0 text-fg-mute transition-transform duration-100 ${open ? 'rotate-180 text-accent' : ''}`}
          weight="bold"
          aria-hidden="true"
        />
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
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left font-mono text-meta tracking-[0.08em] transition-[background,color] duration-75 max-tablet:min-h-11 ${
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
                  {selected && <CheckIcon className="size-3" weight="bold" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Catches render errors so a crashing screen doesn't blank the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  /** Log the boundary catch for diagnostics; render already shows the fallback. */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Journs render fault:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="grid min-h-full place-items-center p-6">
        <Bracket className="w-full max-w-md">
          <Panel title="RENDER FAULT" meta="RECOVERABLE">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5 text-bad">
                <WarningIcon className="size-5 shrink-0" weight="bold" />
                <span className="font-mono text-body">// this screen hit an unexpected error</span>
              </div>
              <p className="font-mono text-meta text-fg-mute">{this.state.error.message}</p>
              <Btn variant="primary" onClick={() => window.location.reload()}>
                RELOAD
              </Btn>
            </div>
          </Panel>
        </Bracket>
      </div>
    );
  }
}
