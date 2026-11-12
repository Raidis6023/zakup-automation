"use client";

import {
  useEffect, useMemo, useRef, useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import WorkspaceMarketplaceLogo from "./WorkspaceMarketplaceLogos";
import HomeIdlePanda from "./HomeIdlePanda";
import {
  METRIC_IDS, DEFAULT_SLOTS, DEFAULT_SIZES,
  COLUMN_COUNT, CARD_GAP, CARD_HEIGHT,
  baseCardWidth, slotPosition, assistantReserve, collides, planCardLayout,
  resizeCardRectangle,
  type MetricId, type SlotMap, type SizeMap, type CardSize, type CardOrigins,
  type CardRectangle, type ResizeEdge,
} from "./home-marketplace-layout";

type MarketplaceKind = Exclude<MetricId, "all">;
export type HomePeriod = "2026-09" | "2026-10";
export type HomePeriodMetrics = {
  revenue: number;
  operatingProfit: number;
  purchases: number;
};
export type HomeMarketplaceMetric = {
  id: MetricId;
  title: string;
  periods: Record<HomePeriod, HomePeriodMetrics>;
};

type Position = { x: number; y: number };
type DragState = { id: MetricId; offsetX: number; offsetY: number };
type ResizeState = {
  id: MetricId;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  original: CardRectangle;
};
type PeriodMap = Record<MetricId, HomePeriod>;

const SLOTS_STORAGE_KEY = "workspace-home-marketplace-card-slots-v1";
const SIZES_STORAGE_KEY = "workspace-home-marketplace-card-sizes-v1";
const PERIOD_STORAGE_KEY = "workspace-home-marketplace-periods-v1";
const ORIGINS_STORAGE_KEY = "workspace-home-marketplace-card-anchors-v1";
const DEFAULT_PERIODS: PeriodMap = {
  all: "2026-09",
  ozon: "2026-09",
  wildberries: "2026-09",
  "yandex-market": "2026-09",
};
const PERIODS: { value: HomePeriod; label: string }[] = [
  { value: "2026-09", label: "Сентябрь" },
  { value: "2026-10", label: "Октябрь" },
];
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatRubles(value: number) {
  return moneyFormatter.format(value) + " ₽";
}
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readSavedSlots(): SlotMap | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SLOTS_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const values = METRIC_IDS.map(id => parsed[id]);
    if (!values.every(value => Number.isInteger(value) && value >= 0) ||
        new Set(values).size !== METRIC_IDS.length) return null;
    return parsed as SlotMap;
  } catch { return null; }
}

function readSavedSizes(): SizeMap | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SIZES_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (!METRIC_IDS.every(id => {
      const item = parsed[id];
      return item &&
        Number.isFinite(item.widthUnits) && item.widthUnits >= 1 && item.widthUnits <= 5 &&
        Number.isFinite(item.height) && item.height >= CARD_HEIGHT && item.height <= 2000;
    })) return null;
    return parsed as SizeMap;
  } catch { return null; }
}

function readSavedOrigins(): CardOrigins {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(ORIGINS_STORAGE_KEY) || "null"
    );
    if (!parsed || typeof parsed !== "object") return {};
    const result: CardOrigins = {};
    for (const id of METRIC_IDS) {
      const maybe = (parsed as Record<string, { x?: unknown; y?: unknown }>)[id];
      if (maybe &&
          typeof maybe.x === "number" && Number.isFinite(maybe.x) &&
          typeof maybe.y === "number" && Number.isFinite(maybe.y) &&
          maybe.x >= 0 && maybe.x <= 1 &&
          maybe.y >= 0 && maybe.y <= 1) {
        result[id] = { x: maybe.x, y: maybe.y };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function readSavedPeriods(): PeriodMap | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERIOD_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (!METRIC_IDS.every(id =>
      parsed[id] === "2026-09" || parsed[id] === "2026-10"
    )) return null;
    return parsed as PeriodMap;
  } catch { return null; }
}

function store(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* Preferences remain functional if local storage is disabled. */ }
}

function swapSlot(slots: SlotMap, id: MetricId, destination: number): SlotMap {
  const currentSlot = slots[id];
  const occupant = METRIC_IDS.find(other => other !== id && slots[other] === destination);
  const next = { ...slots, [id]: destination };
  if (occupant) next[occupant] = currentSlot;
  return next;
}

export default function HomeMarketplaceCards({ metrics }: {
  metrics: HomeMarketplaceMetric[];
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const targetSlotRef = useRef<number | null>(null);
  const sizesRef = useRef<SizeMap>(DEFAULT_SIZES);
  const originsRef = useRef<CardOrigins>({});

  const [slots, setSlots] = useState<SlotMap>(DEFAULT_SLOTS);
  const [sizes, setSizes] = useState<SizeMap>(DEFAULT_SIZES);
  const [origins, setOrigins] = useState<CardOrigins>({});
  const [periods, setPeriods] = useState<PeriodMap>(DEFAULT_PERIODS);
  const [openedMonthId, setOpenedMonthId] = useState<MetricId | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0, viewportWidth: 0 });
  const [draggingId, setDraggingId] = useState<MetricId | null>(null);
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [resizingId, setResizingId] = useState<MetricId | null>(null);

  useEffect(() => {
    const savedSlots = readSavedSlots();
    const savedSizes = readSavedSizes();
    const savedPeriods = readSavedPeriods();
    const savedOrigins = readSavedOrigins();
    originsRef.current = savedOrigins;
    setOrigins(savedOrigins);
    if (savedSlots) setSlots(savedSlots);
    if (savedSizes) { setSizes(savedSizes); sizesRef.current = savedSizes; }
    if (savedPeriods) setPeriods(savedPeriods);
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    function measure() {
      if (!board) return;
      const next = {
        width: board.clientWidth,
        height: board.clientHeight,
        viewportWidth: window.innerWidth,
      };
      setBoardSize(current =>
        current.width === next.width && current.height === next.height &&
        current.viewportWidth === next.viewportWidth ? current : next
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // A single styled popup, outside clipped cards and above all their edges.
  useEffect(() => {
    if (!openedMonthId) return;
    function dismiss(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) ||
          !target.closest(".home-marketplace-period-trigger, .home-marketplace-month-menu")) {
        setOpenedMonthId(null);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedMonthId(null);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openedMonthId]);

  const cardWidth = baseCardWidth(boardSize.width);
  const requestedLayout = useMemo(
    () => planCardLayout(
      slots, sizes, boardSize.width, boardSize.height, boardSize.viewportWidth, origins,
    ),
    [slots, sizes, origins, boardSize],
  );
  const fallbackLayout = useMemo(
    () => planCardLayout(
      slots, DEFAULT_SIZES, boardSize.width, boardSize.height, boardSize.viewportWidth,
    ),
    [slots, boardSize],
  );
  // Old sizes must never make the dashboard disappear on a smaller monitor.
  const layout = requestedLayout ?? fallbackLayout;

  function changePeriod(id: MetricId, value: HomePeriod) {
    const next = { ...periods, [id]: value };
    setPeriods(next);
    store(PERIOD_STORAGE_KEY, next);
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, id: MetricId) {
    if (!event.isPrimary || event.button !== 0 || resizingId || !layout) return;
    // Controls are not drag handles.
    if ((event.target as HTMLElement).closest("button, [role='listbox']")) return;
    setOpenedMonthId(null);
    const card = event.currentTarget.closest("article");
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: event.clientX - cardRect.left,
      offsetY: event.clientY - cardRect.top,
    };
    targetSlotRef.current = slots[id];
    setDraggingId(id);
    setDragPosition({ x: layout[id].x, y: layout[id].y });
    setTargetSlot(slots[id]);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const board = boardRef.current;
    const drag = dragRef.current;
    if (!board || !drag || !layout) return;
    const rect = board.getBoundingClientRect();
    const actual = layout[drag.id];
    const position = {
      x: clamp(event.clientX - rect.left - drag.offsetX, 0, board.clientWidth - actual.width),
      y: clamp(event.clientY - rect.top - drag.offsetY, 0, board.clientHeight - actual.height),
    };
    // Prevent the moving card from covering the assistant at the bottom right.
    const reserve = assistantReserve(
      board.clientWidth, board.clientHeight, window.innerWidth,
    );
    if (collides({ ...position, width: actual.width, height: actual.height }, reserve)) {
      if (reserve.x >= actual.width + CARD_GAP) {
        position.x = Math.min(position.x, reserve.x - actual.width - CARD_GAP);
      } else {
        position.y = Math.min(position.y, reserve.y - actual.height - CARD_GAP);
      }
      position.y = Math.max(0, position.y);
    }
    setDragPosition(position);

    const maxRow = Math.max(
      0, Math.floor((board.clientHeight - CARD_HEIGHT) / (CARD_HEIGHT + CARD_GAP)),
    );
    const count = (maxRow + 1) * COLUMN_COUNT;
    const candidates = Array.from({ length: count }, (_, i) => i);
    candidates.sort((a, b) => {
      const left = slotPosition(a, cardWidth);
      const right = slotPosition(b, cardWidth);
      const dLeft = (left.x - position.x) ** 2 + (left.y - position.y) ** 2;
      const dRight = (right.x - position.x) ** 2 + (right.y - position.y) ** 2;
      return dLeft - dRight;
    });
    const candidateOrigins = { ...originsRef.current };
    delete candidateOrigins[drag.id];
    for (const candidate of candidates) {
      const proposed = swapSlot(slots, drag.id, candidate);
      if (planCardLayout(
        proposed, sizes, board.clientWidth, board.clientHeight, window.innerWidth,
        candidateOrigins,
      )) {
        targetSlotRef.current = candidate;
        setTargetSlot(candidate);
        break;
      }
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (targetSlotRef.current !== null && targetSlotRef.current !== slots[drag.id]) {
      const proposed = swapSlot(slots, drag.id, targetSlotRef.current);
      const candidateOrigins = { ...originsRef.current };
      delete candidateOrigins[drag.id];
      if (planCardLayout(
        proposed, sizes, boardSize.width, boardSize.height, boardSize.viewportWidth,
        candidateOrigins,
      )) {
        originsRef.current = candidateOrigins;
        setOrigins(candidateOrigins);
        store(ORIGINS_STORAGE_KEY, candidateOrigins);
        setSlots(proposed);
        store(SLOTS_STORAGE_KEY, proposed);
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    targetSlotRef.current = null;
    setDraggingId(null);
    setDragPosition(null);
    setTargetSlot(null);
  }

  function applyRectangle(id: MetricId, rect: CardRectangle) {
    const board = boardRef.current;
    if (!board || cardWidth <= 0) return;
    const nextSizes: SizeMap = {
      ...sizesRef.current,
      [id]: {
        widthUnits: rect.width / cardWidth,
        height: rect.height,
      },
    };
    const nextOrigins: CardOrigins = {
      ...originsRef.current,
      [id]: {
        x: rect.x / board.clientWidth,
        y: rect.y / board.clientHeight,
      },
    };
    // Pin the resized rectangle first. Move neighbours to free slots;
    // reject only when there is no collision-free placement.
    const nextLayout = planCardLayout(
      slots, nextSizes, board.clientWidth, board.clientHeight, window.innerWidth,
      nextOrigins, id,
    );
    if (!nextLayout) return;
    sizesRef.current = nextSizes;
    originsRef.current = nextOrigins;
    setSizes(nextSizes);
    setOrigins(nextOrigins);
  }

  function startResize(
    event: ReactPointerEvent<HTMLSpanElement>,
    id: MetricId,
    edge: ResizeEdge,
  ) {
    if (event.button !== 0 || !event.isPrimary || draggingId || !layout) return;
    event.preventDefault();
    event.stopPropagation();
    if (!requestedLayout) {
      sizesRef.current = DEFAULT_SIZES;
      originsRef.current = {};
      setSizes(DEFAULT_SIZES);
      setOrigins({});
    }
    resizeRef.current = {
      id, edge, startX: event.clientX, startY: event.clientY,
      original: { ...layout[id] },
    };
    setOpenedMonthId(null);
    setResizingId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveResize(event: ReactPointerEvent<HTMLSpanElement>) {
    const active = resizeRef.current;
    const board = boardRef.current;
    if (!active || !board || cardWidth <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = resizeCardRectangle(
      active.original, active.edge,
      event.clientX - active.startX,
      event.clientY - active.startY,
      cardWidth, board.clientWidth, board.clientHeight,
    );
    applyRectangle(active.id, next);
  }

  function endResize(event: ReactPointerEvent<HTMLSpanElement>) {
    if (!resizeRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    store(SIZES_STORAGE_KEY, sizesRef.current);
    store(ORIGINS_STORAGE_KEY, originsRef.current);
    resizeRef.current = null;
    setResizingId(null);
  }

  function resizeWithKeyboard(
    event: ReactKeyboardEvent<HTMLSpanElement>,
    id: MetricId,
    edge: ResizeEdge,
  ) {
    if (!layout) return;
    const dx = event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0;
    const dy = event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0;
    const changeX = edge.includes("left") || edge.includes("right");
    const changeY = edge.includes("top") || edge.includes("bottom");
    if ((!dx && !dy) || (dx && !changeX) || (dy && !changeY)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = resizeCardRectangle(
      layout[id], edge, dx, dy,
      cardWidth, boardSize.width, boardSize.height,
    );
    applyRectangle(id, next);
    store(SIZES_STORAGE_KEY, sizesRef.current);
    store(ORIGINS_STORAGE_KEY, originsRef.current);
  }

  const proposedOrigins: CardOrigins = { ...origins };
  if (draggingId) delete proposedOrigins[draggingId];
  const proposedLayout = draggingId !== null && targetSlot !== null && layout
    ? planCardLayout(
        swapSlot(slots, draggingId, targetSlot),
        sizes, boardSize.width, boardSize.height, boardSize.viewportWidth,
        proposedOrigins,
      )
    : null;
  const targetRect = draggingId && proposedLayout ? proposedLayout[draggingId] : null;

  return (
    <div
      ref={boardRef}
      className="home-marketplace-board"
      aria-label="Финансовые показатели маркетплейсов"
    >
      {draggingId && targetRect && (
        <div
          className={"home-marketplace-drop-slot home-marketplace-drop-slot--" + draggingId}
          style={{
            width: targetRect.width,
            height: targetRect.height,
            transform: "translate3d(" + targetRect.x + "px, " + targetRect.y + "px, 0)",
          }}
          aria-hidden="true"
        />
      )}

      {layout && metrics.map(metric => {
        const id = metric.id;
        const dimensions = layout[id];
        const isDragging = draggingId === id;
        const isResizing = resizingId === id;
        const position = isDragging && dragPosition ? dragPosition : dimensions;
        const data = metric.periods[periods[id]];
        return (
          <article
            key={id}
            className={
              "home-marketplace-metric-card home-marketplace-metric-card--" + id +
              (isDragging ? " home-marketplace-metric-card--dragging" : "") +
              (isResizing ? " home-marketplace-metric-card--resizing" : "")
            }
            style={{
              width: dimensions.width,
              height: dimensions.height,
              transform: "translate3d(" + position.x + "px, " + position.y + "px, 0)",
            }}
          >
            <div
              className="home-marketplace-card-header"
              onPointerDown={event => startDrag(event, id)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div className="home-marketplace-card-brand">
                {id === "all" ? (
                  <span className="home-marketplace-ip-badge" aria-hidden="true">ИП</span>
                ) : (
                  <WorkspaceMarketplaceLogo
                    kind={id as MarketplaceKind}
                    className="home-marketplace-metric-logo"
                  />
                )}
                <strong>{metric.title}</strong>
              </div>
              <div className="home-marketplace-period-control">
                <button
                  type="button"
                  className="home-marketplace-period-trigger"
                  aria-label={"Выбрать месяц: " + metric.title}
                  aria-haspopup="listbox"
                  aria-expanded={openedMonthId === id}
                  aria-controls={openedMonthId === id ? "home-month-options-" + id : undefined}
                  onClick={event => {
                    event.stopPropagation();
                    setOpenedMonthId(current => current === id ? null : id);
                  }}
                  onKeyDown={event => {
                    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenedMonthId(id);
                    }
                  }}
                  onPointerDown={event => event.stopPropagation()}
                  onPointerMove={event => event.stopPropagation()}
                  onPointerUp={event => event.stopPropagation()}
                >
                  {PERIODS.find(period => period.value === periods[id])?.label}
                  <span className="home-marketplace-period-chevron" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="home-marketplace-card-metrics" aria-live="polite">
              <div className="home-marketplace-card-metric">
                <span>Выручка, ₽</span>
                <strong>{formatRubles(data.revenue)}</strong>
              </div>
              <div className="home-marketplace-card-metric home-marketplace-card-metric--profit">
                <span>Операционная прибыль, ₽</span>
                <strong>{formatRubles(data.operatingProfit)}</strong>
              </div>
            </div>
            {([
              ["left", "Слева"],
              ["right", "Справа"],
              ["top", "Сверху"],
              ["bottom", "Снизу"],
              ["top-left", "Сверху слева"],
              ["top-right", "Сверху справа"],
              ["bottom-left", "Снизу слева"],
              ["bottom-right", "Снизу справа"],
            ] as const).map(([edge, label]) => (
              <span
                key={edge}
                className={"home-marketplace-resize-handle home-marketplace-resize-handle--" + edge}
                role="separator"
                tabIndex={0}
                aria-label={"Изменить размер " + label.toLowerCase() + ": " + metric.title}
                onPointerDown={event => startResize(event, id, edge)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onKeyDown={event => resizeWithKeyboard(event, id, edge)}
              />
            ))}
          </article>
        );
      })}
      {openedMonthId && layout && (
        <div
          id={"home-month-options-" + openedMonthId}
          className="home-marketplace-month-menu"
          role="listbox"
          aria-label={"Выбор месяца: " + metrics.find(item => item.id === openedMonthId)?.title}
          style={{
            left: Math.max(0, Math.min(
              boardSize.width - 106,
              layout[openedMonthId].x + layout[openedMonthId].width - 118,
            )),
            top: layout[openedMonthId].y + 44,
          }}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setOpenedMonthId(null);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
              );
              const focusedIndex = buttons.findIndex(button => button === document.activeElement);
              const delta = event.key === "ArrowDown" ? 1 : -1;
              const nextIndex = (focusedIndex + delta + buttons.length) % buttons.length;
              buttons[nextIndex]?.focus();
            }
          }}
        >
          {PERIODS.map(period => (
            <button
              type="button"
              role="option"
              key={period.value}
              aria-selected={periods[openedMonthId] === period.value}
              className={
                "home-marketplace-month-option" +
                (periods[openedMonthId] === period.value ? " is-selected" : "")
              }
              onClick={() => {
                changePeriod(openedMonthId, period.value);
                setOpenedMonthId(null);
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      )}
      <HomeIdlePanda />
    </div>
  );
}
