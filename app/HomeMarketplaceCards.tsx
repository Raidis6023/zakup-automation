"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import WorkspaceMarketplaceLogo
  from "./WorkspaceMarketplaceLogos";
import HomeIdlePanda from "./HomeIdlePanda";


type MetricId =
  | "all"
  | "ozon"
  | "wildberries"
  | "yandex-market";


type MarketplaceKind =
  Exclude<
    MetricId,
    "all"
  >;


type Position = {
  x: number;
  y: number;
};


type SlotMap =
Record<
  MetricId,
  number
>;


type DragState = {
  id: MetricId;
  offsetX: number;
  offsetY: number;
};


export type HomeMarketplaceMetric = {
  id:
    MetricId;

  title:
    string;

  revenue:
    number;

  operatingProfit:
    number;

  purchases:
    number;
};


const METRIC_IDS:
MetricId[] = [
  "all",
  "ozon",
  "wildberries",
  "yandex-market",
];


const DEFAULT_SLOTS:
SlotMap = {
  all:
    0,

  ozon:
    1,

  wildberries:
    2,

  "yandex-market":
    3,
};


const STORAGE_KEY =
  "workspace-home-marketplace-card-slots-v1";


const COLUMN_COUNT =
  4;


const CARD_GAP =
  14;


const CARD_HEIGHT =
  136;


const moneyFormatter =
  new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  );


function formatRubles(
  value: number
) {
  return (
    moneyFormatter.format(
      value
    )
    +
    " ₽"
  );
}


function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );
}


function positionForSlot(
  slot: number,
  cardWidth: number
):
Position {
  const column =
    slot
    %
    COLUMN_COUNT;

  const row =
    Math.floor(
      slot
      /
      COLUMN_COUNT
    );

  return {
    x:
      column
      *
      (
        cardWidth
        +
        CARD_GAP
      ),

    y:
      row
      *
      (
        CARD_HEIGHT
        +
        CARD_GAP
      ),
  };
}


function assistantReservedRectangle(boardWidth: number, boardHeight: number) {
  const compact = window.innerWidth <= 800;
  const medium = window.innerWidth <= 1100;
  const width = compact ? 490 : medium ? 560 : 630;
  const height = compact ? 250 : medium ? 280 : 320;
  return {
    left: Math.max(0, boardWidth - Math.min(width, boardWidth)),
    top: Math.max(CARD_HEIGHT + CARD_GAP, boardHeight - height),
  };
}

// Нижние правые ячейки принадлежат помощнику.
function cardHitsAssistant(
  position: Position,
  cardWidth: number,
  boardWidth: number,
  boardHeight: number
): boolean {
  const reserved = assistantReservedRectangle(boardWidth, boardHeight);
  return position.x < boardWidth &&
    position.x + cardWidth > reserved.left &&
    position.y < boardHeight &&
    position.y + CARD_HEIGHT > reserved.top;
}

function isAllowedSlot(
  slot: number,
  cardWidth: number,
  boardWidth: number,
  boardHeight: number
) {
  if (Math.floor(slot / COLUMN_COUNT) === 0) return true;
  return !cardHitsAssistant(
    positionForSlot(slot, cardWidth),
    cardWidth,
    boardWidth,
    boardHeight
  );
}

function readSavedSlots():
SlotMap | null {
  try {
    const raw =
      window
        .localStorage
        .getItem(
          STORAGE_KEY
        );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw
      ) as
        Record<
          string,
          unknown
        >;

    const values =
      METRIC_IDS.map(
        id =>
          parsed[
            id
          ]
      );

    const valid =
      values.every(
        value =>
          typeof value ===
            "number"
          &&
          Number.isInteger(
            value
          )
          &&
          value >=
            0
      )
      &&
      new Set(
        values
      ).size ===
        METRIC_IDS.length;

    if (!valid) {
      return null;
    }

    return {
      all:
        parsed.all as number,

      ozon:
        parsed.ozon as number,

      wildberries:
        parsed.wildberries as number,

      "yandex-market":
        parsed[
          "yandex-market"
        ] as number,
    };
  } catch {
    return null;
  }
}


export default function HomeMarketplaceCards({
  metrics,
}: {
  metrics:
    HomeMarketplaceMetric[];
}) {
  const boardRef =
    useRef<HTMLDivElement>(
      null
    );

  const dragRef =
    useRef<DragState | null>(
      null
    );

  const targetSlotRef =
    useRef<number | null>(
      null
    );

  const [
    slots,
    setSlots,
  ] =
    useState<SlotMap>(
      DEFAULT_SLOTS
    );

  const [
    cardWidth,
    setCardWidth,
  ] =
    useState(
      0
    );

  const [
    draggingId,
    setDraggingId,
  ] =
    useState<MetricId | null>(
      null
    );

  const [
    dragPosition,
    setDragPosition,
  ] =
    useState<Position | null>(
      null
    );

  const [
    targetSlot,
    setTargetSlot,
  ] =
    useState<number | null>(
      null
    );


  useEffect(
    () => {
      const saved =
        readSavedSlots();

      if (saved) {
        setSlots(
          saved
        );
      }
    },
    []
  );


  useEffect(
    () => {
      const currentBoard =
        boardRef.current;

      if (!currentBoard) {
        return;
      }

      const board:
      HTMLDivElement =
        currentBoard;

      function measure() {
        const width =
          board.clientWidth;

        const nextCardWidth =
          (
            width
            -
            CARD_GAP
            *
            (
              COLUMN_COUNT
              -
              1
            )
          )
          /
          COLUMN_COUNT;

        setCardWidth(
          nextCardWidth
        );

        const maxRow =
          Math.max(
            0,
            Math.floor(
              (
                board.clientHeight
                -
                CARD_HEIGHT
              )
              /
              (
                CARD_HEIGHT
                +
                CARD_GAP
              )
            )
          );

        const maxSlot =
          (
            maxRow
            +
            1
          )
          *
          COLUMN_COUNT
          -
          1;

        setSlots(current => {
          const next: SlotMap = { ...current };
          const used = new Set<number>();
          const needsMove: MetricId[] = [];

          for (const id of METRIC_IDS) {
            const slot = next[id];
            if (slot <= maxSlot &&
                !used.has(slot) &&
                isAllowedSlot(slot, nextCardWidth, width, board.clientHeight)) {
              used.add(slot);
            } else {
              needsMove.push(id);
            }
          }

          for (const id of needsMove) {
            const origin = next[id];
            const options = Array.from(
              { length: maxSlot + 1 }, (_, index) => index
            ).filter(slot =>
              !used.has(slot) &&
              isAllowedSlot(slot, nextCardWidth, width, board.clientHeight)
            );
            options.sort((a, b) =>
              Math.abs(a - origin) - Math.abs(b - origin)
            );
            const replacement = options[0];
            if (replacement !== undefined) {
              next[id] = replacement;
              used.add(replacement);
            }
          }

          return METRIC_IDS.every(id => next[id] === current[id])
            ? current
            : next;
        });
      }

      measure();

      const observer =
        new ResizeObserver(
          measure
        );

      observer.observe(
        board
      );

      return () => {
        observer.disconnect();
      };
    },
    []
  );


  function handlePointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>,
    id:
      MetricId
  ) {
    const board =
      boardRef.current;

    if (
      !board
      ||
      cardWidth <=
        0
    ) {
      return;
    }

    const card =
      event.currentTarget
        .parentElement;

    if (!card) {
      return;
    }

    const cardRect =
      card.getBoundingClientRect();

    const initialPosition =
      positionForSlot(
        slots[
          id
        ],
        cardWidth
      );

    dragRef.current = {
      id,

      offsetX:
        event.clientX
        -
        cardRect.left,

      offsetY:
        event.clientY
        -
        cardRect.top,
    };

    targetSlotRef.current =
      slots[
        id
      ];

    setDraggingId(
      id
    );

    setDragPosition(
      initialPosition
    );

    setTargetSlot(
      slots[
        id
      ]
    );

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );
  }


  function handlePointerMove(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    const board =
      boardRef.current;

    const drag =
      dragRef.current;

    if (
      !board
      ||
      !drag
      ||
      cardWidth <=
        0
    ) {
      return;
    }

    const boardRect =
      board.getBoundingClientRect();

    const maxX =
      Math.max(
        0,
        board.clientWidth
        -
        cardWidth
      );

    const maxY =
      Math.max(
        0,
        board.clientHeight
        -
        CARD_HEIGHT
      );

    const nextPosition = {
      x:
        clamp(
          event.clientX
          -
          boardRect.left
          -
          drag.offsetX,
          0,
          maxX
        ),

      y:
        clamp(
          event.clientY
          -
          boardRect.top
          -
          drag.offsetY,
          0,
          maxY
        ),
    };

    // Во время перемещения карточка не должна заходить под панду.
    if (cardHitsAssistant(
      nextPosition, cardWidth, board.clientWidth, board.clientHeight
    )) {
      const reserved = assistantReservedRectangle(
        board.clientWidth, board.clientHeight
      );
      const safeLeft = reserved.left - cardWidth;
      if (safeLeft >= 0 &&
          Math.abs(nextPosition.x - safeLeft) <
            Math.abs(nextPosition.y - (reserved.top - CARD_HEIGHT))) {
        nextPosition.x = Math.min(nextPosition.x, safeLeft);
      } else {
        nextPosition.y = Math.min(
          nextPosition.y, reserved.top - CARD_HEIGHT
        );
      }
    }

    setDragPosition(
      nextPosition
    );

    const column =
      clamp(
        Math.round(
          nextPosition.x
          /
          (
            cardWidth
            +
            CARD_GAP
          )
        ),
        0,
        COLUMN_COUNT
        -
        1
      );

    const maxRow =
      Math.max(
        0,
        Math.floor(
          (
            board.clientHeight
            -
            CARD_HEIGHT
          )
          /
          (
            CARD_HEIGHT
            +
            CARD_GAP
          )
        )
      );

    const row =
      clamp(
        Math.round(
          nextPosition.y
          /
          (
            CARD_HEIGHT
            +
            CARD_GAP
          )
        ),
        0,
        maxRow
      );

    const candidate =
      row
      *
      COLUMN_COUNT
      +
      column;

    const maxSlot = (maxRow + 1) * COLUMN_COUNT - 1;
    const candidates = Array.from(
      { length: maxSlot + 1 }, (_, index) => index
    ).filter(slot =>
      isAllowedSlot(
        slot, cardWidth, board.clientWidth, board.clientHeight
      )
    );
    candidates.sort((a, b) => {
      const distance = (slot: number) => {
        const pos = positionForSlot(slot, cardWidth);
        return (pos.x - nextPosition.x) ** 2 +
          (pos.y - nextPosition.y) ** 2;
      };
      return distance(a) - distance(b);
    });
    const allowedTarget = candidates[0] ?? candidate;

    targetSlotRef.current =
      allowedTarget;

    setTargetSlot(
      allowedTarget
    );
  }


  function handlePointerEnd(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragRef.current;

    if (!drag) {
      return;
    }

    const nextTarget =
      targetSlotRef.current;

    if (
      nextTarget !==
      null
    ) {
      setSlots(
        current => {
          const currentSlot =
            current[
              drag.id
            ];

          const occupant =
            METRIC_IDS.find(
              id =>
                id !==
                  drag.id
                &&
                current[
                  id
                ] ===
                  nextTarget
            );

          const next:
          SlotMap = {
            ...current,

            [
              drag.id
            ]:
              nextTarget,
          };

          if (occupant) {
            next[
              occupant
            ] =
              currentSlot;
          }

          try {
            window
              .localStorage
              .setItem(
                STORAGE_KEY,
                JSON.stringify(
                  next
                )
              );
          } catch {
            // Раскладка продолжит работать без сохранения.
          }

          return next;
        }
      );
    }

    if (
      event.currentTarget
        .hasPointerCapture(
          event.pointerId
        )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    }

    dragRef.current =
      null;

    targetSlotRef.current =
      null;

    setDraggingId(
      null
    );

    setDragPosition(
      null
    );

    setTargetSlot(
      null
    );
  }


  const targetPosition =
    targetSlot !==
      null
    &&
    cardWidth >
      0

      ? positionForSlot(
          targetSlot,
          cardWidth
        )

      : null;


  return (
    <div
      ref={
        boardRef
      }
      className=
        "home-marketplace-board"
      aria-label=
        "Финансовые показатели маркетплейсов"
    >
      {
        draggingId
        &&
        targetPosition

          ? (
            <div
              className={
                "home-marketplace-drop-slot "
                +
                "home-marketplace-drop-slot--"
                +
                draggingId
              }
              style={{
                width:
                  cardWidth,

                transform:
                  "translate3d("
                  +
                  targetPosition.x
                  +
                  "px, "
                  +
                  targetPosition.y
                  +
                  "px, 0)",
              }}
              aria-hidden="true"
            />
          )

          : null
      }

      {
        cardWidth >
          0

          ? metrics.map(
              metric => {
                const isDragging =
                  draggingId ===
                  metric.id;

                const position =
                  isDragging
                  &&
                  dragPosition

                    ? dragPosition

                    : positionForSlot(
                        slots[
                          metric.id
                        ],
                        cardWidth
                      );

                const isAll =
                  metric.id ===
                  "all";

                return (
                  <article
                    key={
                      metric.id
                    }
                    className={
                      "home-marketplace-metric-card "
                      +
                      "home-marketplace-metric-card--"
                      +
                      metric.id
                      +
                      (
                        isDragging

                          ? " home-marketplace-metric-card--dragging"

                          : ""
                      )
                    }
                    style={{
                      width:
                        cardWidth,

                      transform:
                        "translate3d("
                        +
                        position.x
                        +
                        "px, "
                        +
                        position.y
                        +
                        "px, 0)",
                    }}
                  >
                    <div
                      className=
                        "home-marketplace-card-header"
                      onPointerDown={
                        event =>
                          handlePointerDown(
                            event,
                            metric.id
                          )
                      }
                      onPointerMove={
                        handlePointerMove
                      }
                      onPointerUp={
                        handlePointerEnd
                      }
                      onPointerCancel={
                        handlePointerEnd
                      }
                    >
                      <div
                        className=
                          "home-marketplace-card-brand"
                      >
                        {
                          isAll

                            ? (
                              <span
                                className=
                                  "home-marketplace-ip-badge"
                                aria-hidden="true"
                              >
                                ИП
                              </span>
                            )

                            : (
                              <WorkspaceMarketplaceLogo
                                kind={
                                  metric.id as
                                    MarketplaceKind
                                }
                                className=
                                  "home-marketplace-metric-logo"
                              />
                            )
                        }

                        <strong>
                          {
                            metric.title
                          }
                        </strong>
                      </div>

                    </div>

                    <div
                      className=
                        "home-marketplace-card-metrics"
                    >
                      <div
                        className=
                          "home-marketplace-card-metric"
                      >
                        <span>
                          Выручка, ₽
                        </span>

                        <strong>
                          {
                            formatRubles(
                              metric.revenue
                            )
                          }
                        </strong>
                      </div>

                      <div
                        className=
                          "home-marketplace-card-metric home-marketplace-card-metric--profit"
                      >
                        <span>
                          Операционная прибыль, ₽
                        </span>

                        <strong>
                          {
                            formatRubles(
                              metric.operatingProfit
                            )
                          }
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              }
            )

          : null
      }
      <HomeIdlePanda />
    </div>
  );
}
