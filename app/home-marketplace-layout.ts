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
 * Keep the original four-card footprint as the minimum. When a card grows,
 * automatically move the others to the nearest free grid anchor. No two
 * cards may overlap, escape the board or cover the assistant.
 *
 * Null means the requested combination cannot fit without introducing a
 * home-page scrollbar; callers must reject that particular resize.
 */
export function planCardLayout(
  slots: SlotMap,
  sizes: SizeMap,
  boardWidth: number,
  boardHeight: number,
  viewportWidth: number,
): CardLayout | null {
  const baseWidth = baseCardWidth(boardWidth);
  if (baseWidth <= 0 || boardHeight < CARD_HEIGHT) return null;

  const maxRow = Math.max(0, Math.floor((boardHeight - CARD_HEIGHT) / (CARD_HEIGHT + CARD_GAP)));
  const maxSlot = (maxRow + 1) * COLUMN_COUNT - 1;
  const reserved = assistantReserve(boardWidth, boardHeight, viewportWidth);
  const occupied: CardRectangle[] = [];
  const positions = {} as CardLayout;

  const orderedIds = [...METRIC_IDS].sort(
    (a, b) => slots[a] - slots[b] || METRIC_IDS.indexOf(a) - METRIC_IDS.indexOf(b),
  );

  for (const id of orderedIds) {
    const size = sizes[id];
    const width = Math.max(baseWidth, baseWidth * size.widthUnits);
    const height = Math.max(CARD_HEIGHT, size.height);
    const preferred = Math.max(0, Math.min(maxSlot, slots[id]));
    const candidates = [
      ...Array.from({ length: maxSlot - preferred + 1 }, (_, i) => preferred + i),
      ...Array.from({ length: preferred }, (_, i) => i),
    ];
    let placement: CardRectangle | null = null;

    for (const slot of candidates) {
      const anchor = slotPosition(slot, baseWidth);
      const rectangle: CardRectangle = { ...anchor, width, height };
      if (rectangle.x + width > boardWidth + 0.5 ||
          rectangle.y + height > boardHeight + 0.5) continue;
      if (collides(rectangle, reserved) ||
          occupied.some(other => collides(rectangle, other, CARD_GAP - 0.01))) continue;
      placement = rectangle;
      break;
    }

    if (!placement) return null;
    positions[id] = placement;
    occupied.push(placement);
  }

  return positions;
}
