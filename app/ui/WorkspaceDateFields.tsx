"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./WorkspaceDateFields.module.css";

type ChangeValue = (event: { target: { value: string } }) => void;

type FieldProps = {
  value: string;
  onChange: ChangeValue;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  step?: number;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
};

export type ChoiceOption = { value: string; label: string };

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const two = (n: number) => String(n).padStart(2, "0");
const formatKey = (year: number, month: number, day: number) =>
  String(year) + "-" + two(month + 1) + "-" + two(day);
const isDateKey = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key);
const isTimeKey = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function todayKrasnoyarsk() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Krasnoyarsk", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return pick("year") + "-" + pick("month") + "-" + pick("day");
}
function currentTimeKrasnoyarsk() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Krasnoyarsk", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
}
function displayDate(value: string) {
  if (!isDateKey(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
function displayLongDate(value: string) {
  if (!isDateKey(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function initialMonth(value: string) {
  const key = isDateKey(value) ? value : todayKrasnoyarsk();
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
function CalendarGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.glyph}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M7 3v4M17 3v4M3 10h18" />
  </svg>;
}
function ClockGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.glyph}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6l4 2" />
  </svg>;
}
function Chevron({ left = false }: { left?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.chevron}>
    <path d={left ? "M14 5l-7 7 7 7" : "M10 5l7 7-7 7"} />
  </svg>;
}

/**
 * All popovers share one layer and positioning scheme.
 * Rendering in a portal prevents clipping by finance and VED tables.
 */
function PickerPopover({
  anchor, onClose, children, width = 320,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const popup = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: 8, top: 8 });
  const [tokens, setTokens] = useState<Record<string, string>>({});
  useLayoutEffect(() => {
    // Popovers live on document.body. Copy the active workspace/theme tokens
    // from their actual button so Ozon/WB/Yandex and dark mode keep their colors.
    if (anchor.current) {
      const computed = window.getComputedStyle(anchor.current);
      const themeTokens: Record<string, string> = {};
      for (const key of [
        "--ws-blue", "--ws-text", "--ws-text-muted", "--ws-surface",
        "--ws-surface-soft", "--ws-border", "--surface", "--surface-soft",
        "--text", "--text-muted", "--border",
      ]) {
        const color = computed.getPropertyValue(key).trim();
        if (color) themeTokens[key] = color;
      }
      setTokens(themeTokens);
    }
    const reposition = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const w = Math.min(width, window.innerWidth - 16);
      const h = popup.current?.offsetHeight ?? 410;
      const x = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
      const below = rect.bottom + 7;
      const y = below + h <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - h - 7);
      setPlace({ left: x, top: y });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      const node = event.target as Node;
      if (!popup.current?.contains(node) && !anchor.current?.contains(node)) onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); anchor.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [anchor, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={popup}
      className={styles.popover}
      style={{ ...tokens, width: "min(" + width + "px, calc(100vw - 16px))", left: place.left, top: place.top } as CSSProperties}
      data-workspace-picker-popup=""
      role="dialog"
      aria-label="Выбор даты или времени"
    >{children}</div>, document.body
  );
}

function CalendarPanel({
  value, min, max, choose, clear,
}: {
  value: string;
  min?: string;
  max?: string;
  choose: (next: string) => void;
  clear?: () => void;
}) {
  const [month, setMonth] = useState(() => initialMonth(value));
  useEffect(() => setMonth(initialMonth(value)), [value]);
  const today = todayKrasnoyarsk();
  const cells = useMemo(() => {
    const year = month.getFullYear(), mon = month.getMonth();
    const mondayOffset = (new Date(year, mon, 1).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(year, mon, index - mondayOffset + 1);
      return {
        key: formatKey(d.getFullYear(), d.getMonth(), d.getDate()),
        number: d.getDate(),
        other: d.getMonth() !== mon,
      };
    });
  }, [month]);
  const shift = (delta: number) => setMonth(current =>
    new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);
  return <>
    <div className={styles.monthHeader}>
      <button type="button" className={styles.arrow} aria-label="Предыдущий месяц"
        onClick={() => shift(-1)}><Chevron left /></button>
      <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
      <button type="button" className={styles.arrow} aria-label="Следующий месяц"
        onClick={() => shift(1)}><Chevron /></button>
    </div>
    <div className={styles.weekdays}>{WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
    <div className={styles.days}>{cells.map(item =>
      <button
        type="button"
        key={item.key}
        className={[
          styles.day,
          item.other ? styles.otherMonth : "",
          item.key === today ? styles.today : "",
          item.key === value ? styles.selected : "",
        ].filter(Boolean).join(" ")}
        aria-label={displayLongDate(item.key)}
        aria-pressed={item.key === value}
        disabled={!allowed(item.key)}
        onClick={() => choose(item.key)}
      >{item.number}</button>
    )}</div>
    <button className={styles.todayButton} type="button" disabled={!allowed(today)}
      onClick={() => choose(today)}>Сегодня, {displayLongDate(today)}</button>
    {value && clear && <button className={styles.clearButton} type="button"
      onClick={clear}>Очистить дату</button>}
  </>;
}

export function DateField({
  value, onChange, disabled = false, className = "", style, placeholder = "дд.мм.гггг",
  min, max, title, required, "aria-label": ariaLabel,
}: FieldProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <button ref={button} type="button"
      className={[styles.trigger, className].filter(Boolean).join(" ")}
      style={style} title={title}
      aria-label={ariaLabel || "Выберите дату"}
      aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen(v => !v)}>
      <span className={value ? styles.value : styles.placeholder}>{displayDate(value) || placeholder}</span>
      <CalendarGlyph />
    </button>
    {open && !disabled && <PickerPopover anchor={button} onClose={() => setOpen(false)}>
      <CalendarPanel value={value} min={min} max={max} choose={next => {
        onChange({ target: { value: next } });
        setOpen(false);
      }} clear={!required ? () => {
        onChange({ target: { value: "" } });
        setOpen(false);
      } : undefined} />
    </PickerPopover>}
  </>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => two(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => two(i));

function TimePanel({ value, onPick, onDone, clear }: {
  value: string;
  onPick: (next: string) => void;
  onDone: () => void;
  clear?: () => void;
}) {
  // Keep hour selection local. Persist only on minute click so saved-note
  // updates cannot temporarily disable and close the popover.
  const initialHour = isTimeKey(value) ? value.slice(0, 2) : "09";
  const initialMinute = isTimeKey(value) ? value.slice(3, 5) : "00";
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const hourList = useRef<HTMLDivElement>(null), minuteList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hourList.current) hourList.current.scrollTop = Math.max(0, Number(hour) * 32 - 85);
    if (minuteList.current) minuteList.current.scrollTop = Math.max(0, Number(minute) * 32 - 85);
  }, []);
  return <>
    <div className={styles.timeHeader}>Время напоминания <strong>{hour}:{minute}</strong></div>
    <div className={styles.timeColumns}>
      <div className={styles.timeColumn}>
        <span>Часы</span>
        <div ref={hourList} className={styles.timeChoices}>
          {HOURS.map(h => <button type="button" key={h}
            className={h === hour ? styles.timeSelected : ""}
            aria-pressed={h === hour}
            onClick={() => setHour(h)}>{h}</button>)}
        </div>
      </div>
      <div className={styles.timeColumn}>
        <span>Минуты</span>
        <div ref={minuteList} className={styles.timeChoices}>
          {MINUTES.map(m => <button type="button" key={m}
            className={m === minute ? styles.timeSelected : ""}
            aria-pressed={m === minute}
            onClick={() => { setMinute(m); onPick(hour + ":" + m); onDone(); }}>{m}</button>)}
        </div>
      </div>
    </div>
    <button type="button" className={styles.todayButton}
      onClick={() => { onPick(currentTimeKrasnoyarsk()); onDone(); }}>
      Сейчас по Красноярску
    </button>
    {value && clear && <button type="button" className={styles.clearButton}
      onClick={clear}>Очистить время</button>}
  </>;
}

export function TimeField({
  value, onChange, disabled = false, className = "", style,
  placeholder = "--:--", title, required, "aria-label": ariaLabel,
}: FieldProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <button ref={button} type="button"
      className={[styles.trigger, className].filter(Boolean).join(" ")}
      style={style} title={title}
      aria-label={ariaLabel || "Выберите время"}
      aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled} onClick={() => setOpen(v => !v)}>
      <span className={isTimeKey(value) ? styles.value : styles.placeholder}>
        {isTimeKey(value) ? value : placeholder}
      </span>
      <ClockGlyph />
    </button>
    {open && !disabled && <PickerPopover anchor={button} width={270} onClose={() => setOpen(false)}>
      <TimePanel value={value}
        onPick={next => onChange({ target: { value: next } })}
        onDone={() => setOpen(false)}
        clear={!required ? () => {
          onChange({ target: { value: "" } });
          setOpen(false);
        } : undefined} />
    </PickerPopover>}
  </>;
}

/** A local, controlled YYYY-MM-DDTHH:mm value, compatible with the former datetime-local input. */
export function DateTimeField({ value, onChange, disabled = false, className = "", style,
  "aria-label": ariaLabel,
}: FieldProps) {
  const day = /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : "";
  const clock = isTimeKey(value.slice(11, 16)) ? value.slice(11, 16) : "";
  const update = (next: string) => onChange({ target: { value: next } });
  return <div className={[styles.dateTime, className].filter(Boolean).join(" ")} style={style}>
    <div className={styles.dateSegment}>
      <DateField value={day} disabled={disabled}
        aria-label={(ariaLabel || "Дата и время") + ": дата"}
        onChange={event => update(event.target.value
          ? event.target.value + "T" + (clock || "09:00") : "")} />
    </div>
    <div className={styles.timeSegment}>
      <TimeField value={clock} disabled={disabled}
        aria-label={(ariaLabel || "Дата и время") + ": время"}
        onChange={event => update(event.target.value
          ? (day || todayKrasnoyarsk()) + "T" + event.target.value : "")} />
    </div>
  </div>;
}

export function ChoiceField({ value, onChange, options, disabled = false, label }: {
  value: string;
  onChange: (next: string) => void;
  options: ChoiceOption[];
  disabled?: boolean;
  label: string;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return <>
    <button ref={button} type="button" disabled={disabled}
      className={styles.choiceTrigger}
      aria-label={label} aria-haspopup="listbox" aria-expanded={open}
      onClick={() => setOpen(v => !v)}>
      <span>{selected?.label || value}</span><Chevron />
    </button>
    {open && !disabled && <PickerPopover anchor={button} width={190} onClose={() => setOpen(false)}>
      <div className={styles.choiceList} role="listbox" aria-label={label}>
        {options.map(option => <button key={option.value} type="button" role="option"
          aria-selected={option.value === value}
          className={option.value === value ? styles.choiceSelected : ""}
          onClick={() => { onChange(option.value); setOpen(false); }}>
          {option.label}
        </button>)}
      </div>
    </PickerPopover>}
  </>;
}
