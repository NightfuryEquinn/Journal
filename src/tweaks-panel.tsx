// tweaks-panel.tsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
import React from 'react';
import type { ReactNode, MouseEvent, PointerEvent } from 'react';

type DeckStageElement = HTMLElement & { _railEnabled?: boolean };

type HostMessage = {
  type?: string;
};

type TweakOptionValue = string | number | boolean;

type TweakOptionObject = {
  value: TweakOptionValue;
  label: ReactNode;
};

type TweakOption = TweakOptionValue | TweakOptionObject;

type TweakColorValue = string | string[];

type TweakColorOption = string | string[];

/** Narrow a tweak option to an object shape. */
function isTweakOptionObject(o: TweakOption): o is TweakOptionObject {
  return typeof o === 'object' && o !== null && 'value' in o;
}

/** Extract the value from a tweak option. */
function tweakOptionValue(o: TweakOption): TweakOptionValue {
  return isTweakOptionObject(o) ? o.value : o;
}

/** Extract the label from a tweak option. */
function tweakOptionLabel(o: TweakOption): ReactNode {
  return isTweakOptionObject(o) ? o.label : o;
}

export interface TweaksPanelProps {
  title?: string;
  noDeckControls?: boolean;
  children?: ReactNode;
}

export interface TweakSectionProps {
  label: ReactNode;
  children?: ReactNode;
}

export interface TweakRowProps {
  label: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
  inline?: boolean;
}

export interface TweakSliderProps {
  label: ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export interface TweakToggleProps {
  label: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
}

export interface TweakRadioProps<V extends TweakOptionValue = TweakOptionValue> {
  label: ReactNode;
  value: V;
  options: readonly TweakOption[];
  onChange: (value: V) => void;
}

export interface TweakSelectProps {
  label: ReactNode;
  value: TweakOptionValue;
  options: readonly TweakOption[];
  onChange: (value: string) => void;
}

export interface TweakTextProps {
  label: ReactNode;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export interface TweakNumberProps {
  label: ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export interface TweakColorProps {
  label: ReactNode;
  value: TweakColorValue;
  options?: readonly TweakColorOption[];
  onChange: (value: TweakColorValue) => void;
}

export interface TweakButtonProps {
  label: ReactNode;
  onClick: () => void;
  secondary?: boolean;
}

const TWK_FIELD =
  'box-border h-[26px] w-full min-w-0 appearance-none rounded-[7px] border-[0.5px] border-black/10 bg-white/60 px-2 font-[inherit] text-inherit outline-none focus:border-black/25 focus:bg-white/[0.85]';

// ── useTweaks ───────────────────────────────────────────────────────────────
/** Persist tweak values via host edit-mode protocol. */
export function useTweaks<T extends Record<string, unknown>>(
  defaults: T,
): [T, (keyOrEdits: keyof T | Partial<T>, val?: T[keyof T]) => void] {
  const [values, setValues] = React.useState(defaults);
  const setTweak = React.useCallback((keyOrEdits: keyof T | Partial<T>, val?: T[keyof T]) => {
    const edits: Partial<T> =
      typeof keyOrEdits === 'object' && keyOrEdits !== null
        ? keyOrEdits
        : ({ [keyOrEdits]: val } as Partial<T>);
    setValues((prev: T) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
/** Floating tweaks shell with drag, host protocol, and optional deck rail. */
export function TweaksPanel({
  title = 'Tweaks',
  noDeckControls = false,
  children,
}: TweaksPanelProps) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef<HTMLDivElement>(null);
  const hasDeckStage = React.useMemo(
    () => typeof document !== 'undefined' && !!document.querySelector('deck-stage'),
    [],
  );
  const [railEnabled, setRailEnabled] = React.useState(
    () =>
      hasDeckStage &&
      !!(document.querySelector('deck-stage') as DeckStageElement | null)?._railEnabled,
  );
  React.useEffect(() => {
    if (!hasDeckStage || railEnabled) return undefined;
    const onMsg = (e: MessageEvent) => {
      const data = e.data as HostMessage | null;
      if (data?.type === '__omelette_rail_enabled') setRailEnabled(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hasDeckStage, railEnabled]);
  const [railVisible, setRailVisible] = React.useState(() => {
    try {
      return localStorage.getItem('deck-stage.railVisible') !== '0';
    } catch {
      return true;
    }
  });

  /** Toggle deck thumbnail rail visibility. */
  const toggleRail = (on: boolean) => {
    setRailVisible(on);
    window.postMessage({ type: '__deck_rail_visible', on }, '*');
  };
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  /** Keep the panel inside the viewport after drag/resize. */
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const t = (e.data as HostMessage | null)?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  /** Close panel and notify the host toolbar. */
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  /** Begin dragging the panel from the header. */
  const onDragStart = (e: MouseEvent<HTMLDivElement>) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: globalThis.MouseEvent) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;

  return (
    <div
      ref={dragRef}
      className="twk-panel fixed right-4 bottom-4 z-[2147483646] flex max-h-[calc(100vh-32px)] origin-bottom-right scale-[var(--dc-inv-zoom,1)] flex-col overflow-hidden rounded-[14px] border-[0.5px] border-white/60 bg-[rgba(250,249,247,0.78)] text-[#29261b] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_12px_40px_rgba(0,0,0,0.18)] [font:11.5px/1.4_ui-sans-serif,system-ui,-apple-system,sans-serif] backdrop-blur-[24px] backdrop-saturate-[160%]"
      data-noncommentable=""
      style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
    >
      <div
        className="flex cursor-move items-center justify-between py-2.5 pr-2 pl-3.5 select-none"
        onMouseDown={onDragStart}
      >
        <b className="text-xs font-semibold tracking-[0.01em]">{title}</b>
        <button
          type="button"
          className="tap-target size-[22px] cursor-default rounded-md border-0 bg-transparent text-[13px] leading-none text-[rgba(41,38,27,0.55)] appearance-none hover:bg-black/[0.06] hover:text-[#29261b] max-tablet:min-h-11 max-tablet:min-w-11"
          aria-label="Close tweaks"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-3.5 pt-0.5 pb-3.5 [scrollbar-color:rgba(0,0,0,0.15)_transparent] [scrollbar-width:thin]">
        {children}
        {hasDeckStage && railEnabled && !noDeckControls && (
          <TweakSection label="Deck">
            <TweakToggle label="Thumbnail rail" value={railVisible} onChange={toggleRail} />
          </TweakSection>
        )}
      </div>
    </div>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

/** Section heading inside the tweaks panel. */
export function TweakSection({ label, children }: TweakSectionProps) {
  return (
    <>
      <div className="pt-2.5 text-[10px] font-semibold tracking-[0.06em] text-[rgba(41,38,27,0.45)] uppercase first:pt-0">
        {label}
      </div>
      {children}
    </>
  );
}

/** Labeled row wrapper for tweak controls. */
export function TweakRow({ label, value, children, inline = false }: TweakRowProps) {
  return (
    <div className={`flex gap-[5px] ${inline ? 'flex-row items-center justify-between gap-2.5' : 'flex-col'}`}>
      <div className="flex items-baseline justify-between text-[rgba(41,38,27,0.72)]">
        <span className="font-medium">{label}</span>
        {value != null && (
          <span className="text-[rgba(41,38,27,0.5)] tabular-nums">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

/** Range slider with live value display. */
export function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}: TweakSliderProps) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input
        type="range"
        className="twk-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </TweakRow>
  );
}

/** Boolean toggle switch. */
export function TweakToggle({ label, value, onChange }: TweakToggleProps) {
  return (
    <div className="flex flex-row items-center justify-between gap-2.5">
      <div className="flex items-baseline justify-between text-[rgba(41,38,27,0.72)]">
        <span className="font-medium">{label}</span>
      </div>
      <button
        type="button"
        className={`relative h-[18px] w-8 cursor-default rounded-full border-0 p-0 transition-[background] duration-150 ${
          value ? 'bg-[#34c759]' : 'bg-black/15'
        }`}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      >
        <i
          className={`absolute top-0.5 left-0.5 block size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform duration-150 ${
            value ? 'translate-x-3.5' : ''
          }`}
        />
      </button>
    </div>
  );
}

/** Segmented radio control, falling back to select when labels are long. */
export function TweakRadio<V extends TweakOptionValue>({
  label,
  value,
  options,
  onChange,
}: TweakRadioProps<V>) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const optionLabelLength = (o: TweakOption): number =>
    String(isTweakOptionObject(o) ? o.label : o).length;
  const maxLen = options.reduce<number>((m, o) => Math.max(m, optionLabelLength(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);

  if (!fitsAsSegments) {
    const resolve = (s: string): V => {
      const m = options.find((o) => String(tweakOptionValue(o)) === s);
      if (m === undefined) return s as V;
      return tweakOptionValue(m) as V;
    };
    return (
      <TweakSelect label={label} value={value} options={options} onChange={(s) => onChange(resolve(s))} />
    );
  }

  const opts = options.map((o): TweakOptionObject =>
    isTweakOptionObject(o) ? o : { value: o, label: o },
  );
  const idx = Math.max(
    0,
    opts.findIndex((o) => o.value === value),
  );
  const n = opts.length;

  /** Map a pointer X position to a segment value. */
  const segAt = (clientX: number): V => {
    const track = trackRef.current;
    if (!track) return valueRef.current;
    const r = track.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value as V;
  };

  /** Start drag-select across segments. */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev: globalThis.PointerEvent) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div
        ref={trackRef}
        role="radiogroup"
        onPointerDown={onPointerDown}
        className="relative flex rounded-lg bg-black/[0.06] p-0.5 select-none"
      >
        <div
          className={`absolute top-0.5 bottom-0.5 rounded-md bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.12)] ${
            dragging ? '' : 'transition-[left,width] duration-150 ease-[cubic-bezier(0.3,0.7,0.4,1)]'
          }`}
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className="relative z-[1] min-h-[22px] flex-1 cursor-default rounded-md border-0 bg-transparent px-1.5 py-1 font-[inherit] text-[inherit] font-medium leading-[1.2] appearance-none [overflow-wrap:anywhere]"
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

/** Dropdown select for long option lists. */
export function TweakSelect({ label, value, options, onChange }: TweakSelectProps) {
  return (
    <TweakRow label={label}>
      <select
        className={`${TWK_FIELD} twk-field-select pr-[22px]`}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => {
          const v = tweakOptionValue(o);
          const l = tweakOptionLabel(o);
          return (
            <option key={String(v)} value={String(v)}>
              {l}
            </option>
          );
        })}
      </select>
    </TweakRow>
  );
}

/** Plain text input control. */
export function TweakText({ label, value, placeholder, onChange }: TweakTextProps) {
  return (
    <TweakRow label={label}>
      <input
        className={TWK_FIELD}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </TweakRow>
  );
}

/** Numeric stepper with scrub-on-label. */
export function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: TweakNumberProps) {
  /** Clamp a number to optional min/max. */
  const clamp = (n: number): number => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });

  /** Scrub the value horizontally from the label. */
  const onScrubStart = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="twk-num box-border flex h-[26px] min-w-0 items-center rounded-[7px] border-[0.5px] border-black/10 bg-white/60 py-0 pr-0 pl-2">
      <span
        className="cursor-ew-resize pr-2 font-medium text-[rgba(41,38,27,0.6)] select-none"
        onPointerDown={onScrubStart}
      >
        {label}
      </span>
      <input
        type="number"
        className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 pr-2 pl-0 text-right font-[inherit] text-inherit tabular-nums outline-none"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {unit && <span className="pr-2 text-[rgba(41,38,27,0.45)]">{unit}</span>}
    </div>
  );
}

/** Pick checkmark stroke based on swatch luminance. */
function __twkIsLight(hex: string): boolean {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

/** Checkmark icon for selected color chips. */
function __TwkCheck({ light }: { light: boolean }) {
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      className="absolute top-1.5 left-1.5 size-[13px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
    >
      <path
        d="M3 7.2 5.8 10 11 4.2"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={light ? 'rgba(0,0,0,.78)' : '#fff'}
      />
    </svg>
  );
}

/** Curated color/palette picker or native color input fallback. */
export function TweakColor({ label, value, options, onChange }: TweakColorProps) {
  if (!options || !options.length) {
    const colorValue = Array.isArray(value) ? value[0] : value;
    return (
      <div className="flex flex-row items-center justify-between gap-2.5">
        <div className="flex items-baseline justify-between text-[rgba(41,38,27,0.72)]">
          <span className="font-medium">{label}</span>
        </div>
        <input
          type="color"
          className="twk-swatch h-[22px] w-14 shrink-0 appearance-none rounded-md border-[0.5px] border-black/10 bg-transparent p-0"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  const key = (o: TweakColorOption): string => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);

  return (
    <TweakRow label={label}>
      <div className="flex gap-1.5" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button
              key={i}
              type="button"
              className={`relative h-[46px] min-w-0 flex-1 cursor-default overflow-hidden rounded-md border-0 p-0 appearance-none transition-[transform,box-shadow] duration-100 ease-[cubic-bezier(0.3,0.7,0.4,1)] hover:-translate-y-px ${
                on
                  ? 'shadow-[0_0_0_1.5px_rgba(0,0,0,0.85),0_2px_6px_rgba(0,0,0,0.15)]'
                  : 'shadow-[0_0_0_0.5px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_0_0_0.5px_rgba(0,0,0,0.18),0_4px_10px_rgba(0,0,0,0.12)]'
              }`}
              role="radio"
              aria-checked={on}
              aria-label={colors.join(', ')}
              title={colors.join(' · ')}
              style={{ background: hero }}
              onClick={() => onChange(o)}
            >
              {sup.length > 0 && (
                <span className="absolute top-0 right-0 bottom-0 flex w-[34%] flex-col shadow-[-1px_0_0_rgba(0,0,0,0.1)]">
                  {sup.map((c, j) => (
                    <i
                      key={j}
                      className={`block flex-1 ${j === 0 ? '' : 'shadow-[0_-1px_0_rgba(0,0,0,0.1)]'}`}
                      style={{ background: c }}
                    />
                  ))}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

/** Action button for tweaks panel. */
export function TweakButton({ label, onClick, secondary = false }: TweakButtonProps) {
  return (
    <button
      type="button"
      className={`h-[26px] cursor-default rounded-[7px] border-0 px-3 font-[inherit] font-medium appearance-none ${
        secondary
          ? 'bg-black/[0.06] text-inherit hover:bg-black/10'
          : 'bg-black/[0.78] text-white hover:bg-black/[0.88]'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
