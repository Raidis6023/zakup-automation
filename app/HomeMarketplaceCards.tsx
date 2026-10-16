"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import WorkspaceMarketplaceLogo, {
  type WorkspaceMarketplaceKind,
} from "./WorkspaceMarketplaceLogos";


export type HomeMarketplaceMetric = {
  id:
    | "all"
    | WorkspaceMarketplaceKind;

  title:
    string;

  revenue:
    number;

  operatingProfit:
    number;

  purchases:
    number;
};


type CardPosition = {
  x: number;
  y: number;
};


type PositionMap =
Record<
  HomeMarketplaceMetric["id"],
  CardPosition
>;


type RatioPosition = {
  x: number;
  y: number;
};


type RatioMap =
Partial<
  Record<
    HomeMarketplaceMetric["id"],
    RatioPosition
  >
>;


type DragState = {
  id:
    HomeMarketplaceMetric["id"];

  offsetX:
    number;

  offsetY:
    number;
};


const STORAGE_KEY =
  "workspace-home-marketplace-card-positions-v1";


const CARD_GAP =
  14;


const CARD_HEIGHT =
  184;


const moneyFormatter =
  new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  );


const integerFormatter =
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


function formatInteger(
  value: number
) {
  return integerFormatter.format(
    value
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


function defaultDesktopPositions(
  boardWidth: number,
  cardWidth: number
):
PositionMap {
  const step =
    cardWidth
    +
    CARD_GAP;

  return {
    all: {
      x:
        0,

      y:
        0,
    },

    ozon: {
      x:
        step,

      y:
        0,
    },

    wildberries: {
      x:
        step * 2,

      y:
        0,
    },

    "yandex-market": {
      x:
        Math.min(
          step * 3,
          boardWidth
          -
          cardWidth
        ),

      y:
        0,
    },
  };
}


function defaultCompactPositions(
  boardWidth: number,
  cardWidth: number,
  singleColumn: boolean
):
PositionMap {
  if (singleColumn) {
    const step =
      CARD_HEIGHT
      +
      CARD_GAP;

    return {
      all: {
        x:
          0,

        y:
          0,
      },

      ozon: {
        x:
          0,

        y:
          step,
      },

      wildberries: {
        x:
          0,

        y:
          step * 2,
      },

      "yandex-market": {
        x:
          0,

        y:
          step * 3,
      },
    };
  }

  const secondColumn =
    Math.max(
      0,
      boardWidth
      -
      cardWidth
    );

  const secondRow =
    CARD_HEIGHT
    +
    CARD_GAP;

  return {
    all: {
      x:
        0,

      y:
        0,
    },

    ozon: {
      x:
        secondColumn,

      y:
        0,
    },

    wildberries: {
      x:
        0,

      y:
        secondRow,
    },

    "yandex-market": {
      x:
        secondColumn,

      y:
        secondRow,
    },
  };
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

  const ratiosRef =
    useRef<RatioMap>(
      {}
    );

  const [
    positions,
    setPositions,
  ] =
    useState<PositionMap | null>(
      null
    );

  const [
    cardWidth,
    setCardWidth,
  ] =
    useState(
      0
    );

  const [
    compact,
    setCompact,
  ] =
    useState(
      false
    );

  const [
    singleColumn,
    setSingleColumn,
  ] =
    useState(
      false
    );

  const [
    draggingId,
    setDraggingId,
  ] =
    useState<
      HomeMarketplaceMetric["id"]
      |
      null
    >(
      null
    );


  useEffect(
    () => {
      const board =
        boardRef.current;

      if (!board) {
        return;
      }

      try {
        const saved =
          window
            .localStorage
            .getItem(
              STORAGE_KEY
            );

        if (saved) {
          ratiosRef.current =
            JSON.parse(
              saved
            ) as RatioMap;
        }
      } catch {
        ratiosRef.current =
          {};
      }

      function layoutCards() {
        const width =
          board.clientWidth;

        const height =
          board.clientHeight;

        const nextSingleColumn =
          width <
          540;

        const nextCompact =
          width <
          980;

        const nextCardWidth =
          nextSingleColumn

            ? width

            : nextCompact

              ? (
                  width
                  -
                  CARD_GAP
                )
                /
                2

              : (
                  width
                  -
                  CARD_GAP * 3
                )
                /
                4;

        setCompact(
          nextCompact
        );

        setSingleColumn(
          nextSingleColumn
        );

        setCardWidth(
          nextCardWidth
        );

        if (nextCompact) {
          setPositions(
            defaultCompactPositions(
              width,
              nextCardWidth,
              nextSingleColumn
            )
          );

          return;
        }

        const defaults =
          defaultDesktopPositions(
            width,
            nextCardWidth
          );

        const maxX =
          Math.max(
            0,
            width
            -
            nextCardWidth
          );

        const maxY =
          Math.max(
            0,
            height
            -
            CARD_HEIGHT
          );

        const next =
          {
            ...defaults,
          };

        for (
          const metric
          of metrics
        ) {
          const ratio =
            ratiosRef.current[
              metric.id
            ];

          if (!ratio) {
            continue;
          }

          next[
            metric.id
          ] = {
            x:
              clamp(
                ratio.x
                *
                maxX,
                0,
                maxX
              ),

            y:
              clamp(
                ratio.y
                *
                maxY,
                0,
                maxY
              ),
          };
        }

        setPositions(
          next
        );
      }

      layoutCards();

      const resizeObserver =
        new ResizeObserver(
          layoutCards
        );

      resizeObserver.observe(
        board
      );

      return () => {
        resizeObserver.disconnect();
      };
    },
    [
      metrics,
    ]
  );


  function handlePointerDown(
    event:
      PointerEvent<HTMLDivElement>,
    id:
      HomeMarketplaceMetric["id"]
  ) {
    if (
      compact
      ||
      !positions
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

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );

    setDraggingId(
      id
    );
  }


  function handlePointerMove(
    event:
      PointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragRef.current;

    const board =
      boardRef.current;

    if (
      !drag
      ||
      !board
      ||
      compact
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

    const x =
      clamp(
        event.clientX
        -
        boardRect.left
        -
        drag.offsetX,
        0,
        maxX
      );

    const y =
      clamp(
        event.clientY
        -
        boardRect.top
        -
        drag.offsetY,
        0,
        maxY
      );

    setPositions(
      previous => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,

          [
            drag.id
          ]: {
            x,
            y,
          },
        };
      }
    );
  }


  function handlePointerUp(
    event:
      PointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragRef.current;

    const board =
      boardRef.current;

    if (
      !drag
      ||
      !board
      ||
      !positions
    ) {
      dragRef.current =
        null;

      setDraggingId(
        null
      );

      return;
    }

    const position =
      positions[
        drag.id
      ];

    const maxX =
      Math.max(
        1,
        board.clientWidth
        -
        cardWidth
      );

    const maxY =
      Math.max(
        1,
        board.clientHeight
        -
        CARD_HEIGHT
      );

    ratiosRef.current = {
      ...ratiosRef.current,

      [
        drag.id
      ]: {
        x:
          position.x
          /
          maxX,

        y:
          position.y
          /
          maxY,
      },
    };

    try {
      window
        .localStorage
        .setItem(
          STORAGE_KEY,
          JSON.stringify(
            ratiosRef.current
          )
        );
    } catch {
      // Положение просто не сохранится.
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

    setDraggingId(
      null
    );
  }


  return (
    <div
      ref={
        boardRef
      }
      className={
        singleColumn

          ? "home-marketplace-board home-marketplace-board--compact home-marketplace-board--single"

          : compact

            ? "home-marketplace-board home-marketplace-board--compact"

            : "home-marketplace-board"
      }
      aria-label=
        "Финансовые показатели маркетплейсов"
    >
      {
        positions
        &&
        cardWidth >
          0

          ? metrics.map(
              metric => {
                const position =
                  positions[
                    metric.id
                  ];

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
                        draggingId ===
                          metric.id

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
                        handlePointerUp
                      }
                      onPointerCancel={
                        handlePointerUp
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
                                    WorkspaceMarketplaceKind
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

                      <span
                        className=
                          "home-marketplace-card-grip"
                        aria-hidden="true"
                      />
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

                      <div
                        className=
                          "home-marketplace-card-metric home-marketplace-card-metric--purchases"
                      >
                        <span>
                          Выкупы, шт.
                        </span>

                        <strong>
                          {
                            formatInteger(
                              metric.purchases
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
    </div>
  );
}
