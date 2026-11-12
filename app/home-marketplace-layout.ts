export type MetricId = "all" | "ozon" | "wildberries" | "yandex-market";
export type SlotMap = Record<MetricId, number>;
export type CardSize = { widthUnits: number; height: number };
export type SizeMap = Record<MetricId, CardSize>;
export type CardRectangle = { x: number; y: number; width: number; height: number };
export type CardLayout = Record<MetricId, CardRectangle>;

export const METRIC_IDS: MetricId[] = ["all", "ozon", "wildberries", "yandex-market"];
export const COLUMN_COUNT = 4;
export const CARD_GAP = 14;
export const CARD_HEIGHT = 136;
export const DEFAULT_SLOTS: SlotMap = {
  all: 0, ozon: 1, wildberries: 2, "yandex-market": 3,
};
export const DEFAULT_SIZES: SizeMap = {
  all: { widthUnits: 1, height: CARD_HEIGHT },
  ozon: { widthUnits: 1, height: CARD_HEIGHT },
  wildberries: { widthUnits: 1, height: CARD_HEIGHT },
  "yandex-market": { widthUnits: 1, height: CARD_HEIGHT },
};

export function baseCardWidth(boardWidth: number): number {
  return (boardWidth - CARD_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
}

export function slotPosition(slot: number, baseWidth: number) {
  return {
    x: (slot % COLUMN_COUNT) * (baseWidth + CARD_GAP),
    y: Math.floor(slot / COLUMN_COUNT) * (CARD_HEIGHT + CARD_GAP),
  };
}

export function assistantReserve(boardWidth: number, boardHeight: number, viewportWidth: number) {
  const compact = viewportWidth <= 800;
  const medium = viewportWidth <= 1100;
  const width = compact ? 490 : medium ? 560 : 630;
  const height = compact ? 250 : medium ? 280 : 320;
  return {
    x: Math.max(0, boardWidth - Math.min(width, boardWidth)),
    y: Math.max(CARD_HEIGHT + CARD_GAP, boardHeight - height),
    width: Math.min(width, boardWidth),
    height: boardHeight,
  };
}

export function collides(a: CardRectangle, b: CardRectangle, gap = 0): boolean {
  return a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y;
}

/**
 * Saved anchors are relative to board dimensions so a card resized from
 * its top or left edge retains the opposite edge as the size changes.
 */
export type CardOrigins = Partial<Record<MetricId, { x: number; y: number }>>;

/**
 * Place pinned/resized tile first, then reflow all remaining tiles without
 * covering each other or the assistant. Saved free-position anchors are
 * preferred while valid; grid slots are the fallback on smaller screens.
 */
export function planCardLayout(
  slots: SlotMap,
  sizes: SizeMap,
  boardWidth: number,
  boardHeight: number,
  viewportWidth: number,
  origins: CardOrigins = {},
  priorityId?: MetricId,
): CardLayout | null {
  const baseWidth = baseCardWidth(boardWidth);
  if (baseWidth <= 0 || boardHeight < CARD_HEIGHT) return null;

  const maxRow = Math.max(0, Math.floor((boardHeight - CARD_HEIGHT) / (CARD_HEIGHT + CARD_GAP)));
  const maxSlot = (maxRow + 1) * COLUMN_COUNT - 1;
  const reserved = assistantReserve(boardWidth, boardHeight, viewportWidth);
  const occupied: CardRectangle[] = [];
  const positions = {} as CardLayout;
  const orderedIds = [...METRIC_IDS].sort((a, b) => {
    if (a === priorityId) return -1;
    if (b === priorityId) return 1;
    const pinnedA = origins[a] ? 0 : 1;
    const pinnedB = origins[b] ? 0 : 1;
    return pinnedA - pinnedB ||
      slots[a] - slots[b] ||
      METRIC_IDS.indexOf(a) - METRIC_IDS.indexOf(b);
  });

  for (const id of orderedIds) {
    const size = sizes[id];
    const width = Math.max(baseWidth, baseWidth * size.widthUnits);
    const height = Math.max(CARD_HEIGHT, size.height);
    const preferredSlot = Math.max(0, Math.min(maxSlot, slots[id]));
    const gridSlots = [
      ...Array.from({ length: maxSlot - preferredSlot + 1 }, (_, i) => preferredSlot + i),
      ...Array.from({ length: preferredSlot }, (_, i) => i),
    ];
    const candidateAnchors: { x: number; y: number }[] = [];
    const saved = origins[id];
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      candidateAnchors.push({
        x: Math.round(saved.x * boardWidth),
        y: Math.round(saved.y * boardHeight),
      });
    }
    if (id !== priorityId) {
      candidateAnchors.push(...gridSlots.map(slot => slotPosition(slot, baseWidth)));
    }
    let placed: CardRectangle | null = null;
    for (const anchor of candidateAnchors) {
      const rect: CardRectangle = { x: anchor.x, y: anchor.y, width, height };
      if (rect.x < 0 || rect.y < 0 ||
        rect.x + width > boardWidth + 0.5 ||
        rect.y + height > boardHeight + 0.5) continue;
      if (collides(rect, reserved) ||
        occupied.some(other => collides(rect, other, CARD_GAP - 0.01))) continue;
      placed = rect;
      break;
    }
    if (!placed) return null;
    positions[id] = placed;
    occupied.push(placed);
  }
  return positions;
}


export type ResizeEdge =
  | "left" | "right" | "top" | "bottom"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Resize from the grabbed edge; the opposite edge stays fixed. */
export function resizeCardRectangle(
  original: CardRectangle,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
  minimumWidth: number,
  maximumWidth: number,
  maximumHeight: number,
): CardRectangle {
  const next = { ...original };
  const left = edge.includes("left");
  const right = edge.includes("right");
  const top = edge.includes("top");
  const bottom = edge.includes("bottom");
  if (left) {
    const x = Math.max(0, Math.min(original.x + deltaX, original.x + original.width - minimumWidth));
    next.x = x;
    next.width = original.width + original.x - x;
  } else if (right) {
    next.width = Math.max(minimumWidth, Math.min(original.width + deltaX, maximumWidth - original.x));
  }
  if (top) {
    const y = Math.max(0, Math.min(original.y + deltaY, original.y + original.height - CARD_HEIGHT));
    next.y = y;
    next.height = original.height + original.y - y;
  } else if (bottom) {
    next.height = Math.max(CARD_HEIGHT, Math.min(original.height + deltaY, maximumHeight - original.y));
  }
  return next;
}
