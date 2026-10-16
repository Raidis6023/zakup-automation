"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import WorkspaceMarketplaceLogo
  from "./WorkspaceMarketplaceLogos";


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


type Position = {
  x: number;
  y: number;
};


type DragState = {
  id: MetricId;
  offsetX: number;
  offsetY: number;
};


const STORAGE_KEY =
  "workspace-home-marketplace-card-positions-v2";


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

  const [
    positions,
    setPositions,
  ] =
    useState<
      Record<
        string,
        Position
      >
    >(
      {}
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


  useEffect(
    () => {
      const board =
        boardRef.current;

      if (!board) {
        return;
      }

      function arrange() {
        const width =
          board.clientWidth;

        const nextCardWidth =
          Math.max(
            230,
            (
              width
              -
              CARD_GAP * 3
            )
            /
            4
          );

        setCardWidth(
          nextCardWidth
        );

        let saved:
        Record<
          string,
          Position
        > = {};

        try {
          const raw =
            window
              .localStorage
              .getItem(
                STORAGE_KEY
              );

          if (raw) {
            saved =
              JSON.parse(
                raw
              ) as
                Record<
                  string,
                  Position
                >;
          }
        } catch {
          saved =
            {};
        }

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
            board.clientHeight
            -
            CARD_HEIGHT
          );

        const next:
        Record<
          string,
          Position
        > = {};

        metrics.forEach(
          (
            metric,
            index
          ) => {
            const stored =
              saved[
                metric.id
              ];

            if (stored) {
              next[
                metric.id
              ] = {
                x:
                  clamp(
                    stored.x,
                    0,
                    maxX
                  ),

                y:
                  clamp(
                    stored.y,
                    0,
                    maxY
                  ),
              };

              return;
            }

            next[
              metric.id
            ] = {
              x:
                Math.min(
                  index
                  *
                  (
                    nextCardWidth
                    +
                    CARD_GAP
                  ),
                  maxX
                ),

              y:
                0,
            };
          }
        );

        setPositions(
          next
        );
      }

      arrange();

      const observer =
        new ResizeObserver(
          arrange
        );

      observer.observe(
        board
      );

      return () => {
        observer.disconnect();
      };
    },
    [
      metrics,
    ]
  );


  function handlePointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>,
    id:
      MetricId
  ) {
    const card =
      event.currentTarget
        .parentElement;

    if (!card) {
      return;
    }

    const rect =
      card.getBoundingClientRect();

    dragRef.current = {
      id,

      offsetX:
        event.clientX
        -
        rect.left,

      offsetY:
        event.clientY
        -
        rect.top,
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

    setPositions(
      current => ({
        ...current,

        [
          drag.id
        ]:
          nextPosition,
      })
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

    try {
      window
        .localStorage
        .setItem(
          STORAGE_KEY,
          JSON.stringify(
            positions
          )
        );
    } catch {
      // Сохранение позиции не влияет на работу карточек.
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
      className=
        "home-marketplace-board"
      aria-label=
        "Финансовые показатели маркетплейсов"
    >
      {
        cardWidth >
          0

          ? metrics.map(
              metric => {
                const position =
                  positions[
                    metric.id
                  ]
                  ??
                  {
                    x:
                      0,

                    y:
                      0,
                  };

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
