"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles
from "./MarketplaceSuppliesPanel.module.css";


type Marketplace =
  | "ozon"
  | "wildberries"
  | "yandex";


type SupplySummary = {
  key:
    string;

  id:
    string;

  number:
    string;

  secondaryNumber?:
    string
    |
    null;

  status:
    string;

  statusLabel:
    string;

  isTerminal:
    boolean;

  createdAt?:
    string
    |
    null;

  updatedAt?:
    string
    |
    null;

  timeslotFrom?:
    string
    |
    null;

  timeslotTo?:
    string
    |
    null;

  destinationName?:
    string
    |
    null;

  destinationAddress?:
    string
    |
    null;

  transitName?:
    string
    |
    null;

  dropoffName?:
    string
    |
    null;

  plannedUnits?:
    number
    |
    null;

  acceptedUnits?:
    number
    |
    null;

  boxCount?:
    number
    |
    null;

  palletCount?:
    number
    |
    null;

  cargoCount?:
    number
    |
    null;

  supplyType?:
    string
    |
    null;

  detail:
    Record<
      string,
      string
    >;
};


type SupplyItem = {
  sku?:
    string
    |
    null;

  offerId?:
    string
    |
    null;

  name?:
    string
    |
    null;

  barcode?:
    string
    |
    null;

  plannedQuantity:
    number;

  acceptedQuantity?:
    number
    |
    null;
};


type CargoPlace = {
  id:
    string;

  type:
    string;

  barcode?:
    string
    |
    null;

  quantity?:
    number
    |
    null;

  description?:
    string
    |
    null;

  items?:
    Array<{
      barcode:
        string;

      quantity:
        number;
    }>;
};


type SupplyDetail = {
  ok:
    boolean;

  error?:
    string;

  summary?:
    SupplySummary;

  items:
    SupplyItem[];

  cargoPlaces:
    CargoPlace[];

  notes?:
    string[];
};


type SupplyListResponse = {
  ok:
    boolean;

  error?:
    string;

  marketplace:
    Marketplace;

  updatedAt:
    string;

  supplies:
    SupplySummary[];
};


type DetailState = {
  loading:
    boolean;

  error:
    string;

  data:
    SupplyDetail
    |
    null;
};


function formatNumber(
  value:
    number
    |
    null
    |
    undefined
) {

  if (
    value ===
      null
    ||
    value ===
      undefined
    ||
    !Number.isFinite(
      Number(
        value
      )
    )
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value
    )
  );

}


function formatDateTime(
  value:
    string
    |
    null
    |
    undefined
) {

  if (!value) {

    return "—";

  }


  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {

    const [
      year,
      month,
      day,
    ] =
      value.split(
        "-"
      );


    return `${day}.${month}.${year}`;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Krasnoyarsk",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    date
  );

}


function formatTimeslot(
  from:
    string
    |
    null
    |
    undefined,

  to:
    string
    |
    null
    |
    undefined
) {

  if (!from) {

    return "—";

  }


  if (!to) {

    return formatDateTime(
      from
    );

  }


  return `${formatDateTime(
    from
  )} → ${formatDateTime(
    to
  )}`;

}


function getMarketplaceCaption(
  marketplace:
    Marketplace
) {

  if (
    marketplace ===
    "ozon"
  ) {

    return "FBO-заявки, cross-dock маршрут, склады размещения, грузоместа и товарный состав.";

  }


  if (
    marketplace ===
    "wildberries"
  ) {

    return "FBW-поставки, плановая дата, склады, упаковка и товарный состав.";

  }


  return "FBY-поставки, точки назначения/транзита, грузоместа и товарный состав.";

}


function getCargoLabel(
  supply:
    SupplySummary
) {

  const parts:
    string[] =
    [];


  if (
    supply.boxCount !==
      null
    &&
    supply.boxCount !==
      undefined
  ) {

    parts.push(
      `коробов: ${formatNumber(
        supply.boxCount
      )}`
    );

  }


  if (
    supply.palletCount !==
      null
    &&
    supply.palletCount !==
      undefined
  ) {

    parts.push(
      `паллет: ${formatNumber(
        supply.palletCount
      )}`
    );

  }


  if (
    parts.length >
    0
  ) {

    return parts.join(
      " · "
    );

  }


  return supply.cargoCount !==
    null
    &&
    supply.cargoCount !==
      undefined
    ? formatNumber(
        supply.cargoCount
      )
    : "—";

}


function TruckIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3.5 6.5h10.2v10H3.5z" />
      <path d="M13.7 9h3.1l3.7 4.1v3.4h-6.8z" />
      <path d="M16.8 9v4.1h3.7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </svg>
  );

}


export default function MarketplaceSuppliesPanel({
  marketplace,
  endpoint,
  title,
}: {
  marketplace:
    Marketplace;

  endpoint:
    string;

  title:
    string;
}) {

  const [
    data,
    setData,
  ] =
    useState<
      SupplyListResponse
      |
      null
    >(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );
  const [wbRateLimited, setWbRateLimited] = useState(false);


  const [wbLoadedOnce, setWbLoadedOnce] = useState(false);

  const [
    panelExpanded,
    setPanelExpanded,
  ] =
    useState(
      false
    );


  const [
    expandedKey,
    setExpandedKey,
  ] =
    useState<
      string
      |
      null
    >(
      null
    );


  const [
    details,
    setDetails,
  ] =
    useState<
      Record<
        string,
        DetailState
      >
    >(
      {}
    );


  const loadOverview =
    useCallback(
      async (
        manual =
          false
      ) => {

        if (manual) {

          setRefreshing(
            true
          );

        } else {

          setLoading(
            true
          );

        }


        setError(
          ""
        );
        if (marketplace === "wildberries") setWbRateLimited(false);


        try {

          const response =
            await fetch(
              endpoint,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              }
            );


          const payload =
            await response
              .json() as
              SupplyListResponse;


          if (marketplace === "wildberries" && response.status === 429) setWbRateLimited(true);

          if (
            !response.ok
            ||
            payload.ok !==
              true
          ) {

            throw new Error(
              payload.error
              ??
              `HTTP ${response.status}`
            );

          }


          setData(
            payload
          );

        } catch (
          loadError
        ) {

          setError(
            loadError
              instanceof Error
              ? loadError.message
              : String(
                  loadError
                )
          );

        } finally {

          setLoading(
            false
          );


          setRefreshing(
            false
          );

        }

      },
      [
        endpoint, marketplace,
      ]
    );


  useEffect(
    () => {

      if (marketplace !== "wildberries") void loadOverview();

    },
    [
      loadOverview, marketplace,
    ]
  );


  useEffect(() => {
    if (marketplace === "wildberries" && panelExpanded && !wbLoadedOnce) {
      setWbLoadedOnce(true);
      void loadOverview();
    }
  }, [marketplace, panelExpanded, wbLoadedOnce, loadOverview]);


  async function loadDetail(
    supply:
      SupplySummary
  ) {

    const current =
      details[
        supply.key
      ];


    if (
      current?.loading
      ||
      current?.data
    ) {

      return;

    }


    setDetails(
      previous => ({
        ...previous,

        [supply.key]: {
          loading:
            true,

          error:
            "",

          data:
            null,
        },
      })
    );


    try {

      const url =
        new URL(
          endpoint,
          window.location.origin
        );


      for (
        const [
          key,
          value,
        ]
        of Object.entries(
          supply.detail
        )
      ) {

        url.searchParams.set(
          key,
          value
        );

      }


      const response =
        await fetch(
          url.toString(),
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const payload =
        await response
          .json() as
          SupplyDetail;


      if (
        !response.ok
        ||
        payload.ok !==
          true
      ) {

        throw new Error(
          payload.error
          ??
          `HTTP ${response.status}`
        );

      }


      setDetails(
        previous => ({
          ...previous,

          [supply.key]: {
            loading:
              false,

            error:
              "",

            data:
              payload,
          },
        })
      );

    } catch (
      detailError
    ) {

      setDetails(
        previous => ({
          ...previous,

          [supply.key]: {
            loading:
              false,

            error:
              detailError
                instanceof Error
                ? detailError.message
                : String(
                    detailError
                  ),

            data:
              null,
          },
        })
      );

    }

  }


  async function toggleSupply(
    supply:
      SupplySummary
  ) {

    if (
      expandedKey ===
      supply.key
    ) {

      setExpandedKey(
        null
      );


      return;

    }


    setExpandedKey(
      supply.key
    );


    await loadDetail(
      supply
    );

  }


  const supplies =
    data?.supplies
    ??
    [];


  const activeCount =
    supplies.filter(
      supply =>
        !supply.isTerminal
    ).length;


  const plannedUnits =
    supplies.reduce(
      (
        total,
        supply
      ) =>
        total
        +
        (
          Number.isFinite(
            Number(
              supply.plannedUnits
            )
          )
            ? Number(
                supply.plannedUnits
              )
            : 0
        ),
      0
    );


  const cargoCount =
    supplies.reduce(
      (
        total,
        supply
      ) => {

        if (
          supply.cargoCount !==
            null
          &&
          supply.cargoCount !==
            undefined
        ) {

          return total
          +
          Number(
            supply.cargoCount
          );

        }


        return total
        +
        Number(
          supply.boxCount
          ??
          0
        )
        +
        Number(
          supply.palletCount
          ??
          0
        );

      },
      0
    );


  const nearestTimeslot =
    useMemo(
      () =>
        supplies
          .map(
            supply =>
              supply.timeslotFrom
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
          .filter(
            value => {

              const timestamp =
                Date.parse(
                  value
                );


              return (
                !Number.isFinite(
                  timestamp
                )
                ||
                timestamp >=
                  Date.now()
                  -
                  86_400_000
              );

            }
          )
          .sort(
            (
              left,
              right
            ) => {

              const leftTime =
                Date.parse(
                  left
                );

              const rightTime =
                Date.parse(
                  right
                );


              if (
                Number.isFinite(
                  leftTime
                )
                &&
                Number.isFinite(
                  rightTime
                )
              ) {

                return leftTime
                -
                rightTime;

              }


              return left.localeCompare(
                right
              );

            }
          )[
            0
          ]
        ??
        null,
      [
        supplies,
      ]
    );


  return (

    <section
      className={
        `section ${styles.panel} ${styles[`panel_${marketplace}`]}`
      }
    >

      <div
        className={
          `${styles.header} ${styles[`header_${marketplace}`]}`
        }

        role="button"

        tabIndex={0}

        aria-expanded={
          panelExpanded
        }

        onClick={
          () =>
            setPanelExpanded(
              current =>
                !current
            )
        }

        onKeyDown={
          event => {

            if (
              event.key ===
                "Enter"
              ||
              event.key ===
                " "
            ) {

              event.preventDefault();

              setPanelExpanded(
                current =>
                  !current
              );

            }

          }
        }
      >

        <span
          className={
            styles.headerIcon
          }

          aria-hidden="true"
        >
          <TruckIcon />
        </span>


        <div
          className={
            styles.headerCopy
          }
        >

          <h2
            className=
              "section-title"
          >
            {title}
          </h2>


          <div
            className={
              styles.caption
            }
          >
            {
              getMarketplaceCaption(
                marketplace
              )
            }
          </div>

        </div>


        <button
          type="button"

          className=
            "secondary-button"

          disabled={
            loading
            ||
            refreshing
            || (marketplace === "wildberries" && wbRateLimited)
          }

          onClick={
            event => {

              event.stopPropagation();

              void loadOverview(
                true
              );

            }
          }
        >
          {
            refreshing
              ? "Обновляем..."
              : "Обновить поставки"
          }
        </button>

      </div>


      {
        panelExpanded
          ? (
            <div
              className={
                styles.body
              }
            >

      {
        error
          ? (

            <div
              className={
                styles.error
              }
            >
              <strong>
                Поставки не загрузились
              </strong>

              <span>
                {error}
              </span>
              {marketplace === "wildberries" && wbRateLimited ? <span>Повторный запрос временно заблокирован до перезагрузки страницы. Дождитесь окончания лимита WB.</span> : null}
            </div>

          )
          : null
      }


      {
        loading
          ? (

            <div
              className={
                styles.loading
              }
            >
              Получаем поставки маркетплейса...
            </div>

          )
          : null
      }


      {
        !loading
        &&
        !error
          ? (

            <>

              <div
                className={
                  styles.summary
                }
              >

                <SummaryFact
                  label="Поставок"
                  value={
                    formatNumber(
                      supplies.length
                    )
                  }
                />


                <SummaryFact
                  label="В работе"
                  value={
                    formatNumber(
                      activeCount
                    )
                  }
                />


                <SummaryFact
                  label="Товаров по плану"
                  value={
                    plannedUnits >
                      0
                      ? formatNumber(
                          plannedUnits
                        )
                      : "—"
                  }
                />


                <SummaryFact
                  label="Грузомест"
                  value={
                    cargoCount >
                      0
                      ? formatNumber(
                          cargoCount
                        )
                      : "—"
                  }
                />


                <SummaryFact
                  label="Ближайшая дата / тайм-слот"
                  value={
                    formatDateTime(
                      nearestTimeslot
                    )
                  }
                  wide
                />

              </div>


              {
                supplies.length ===
                  0
                  ? (

                    <div
                      className={
                        styles.empty
                      }
                    >
                      Поставок в доступной выборке нет.
                    </div>

                  )
                  : (

                    <div
                      className={
                        styles.list
                      }
                    >

                      {
                        supplies.map(
                          supply => {

                            const expanded =
                              expandedKey ===
                              supply.key;


                            const detail =
                              details[
                                supply.key
                              ];


                            return (

                              <article
                                key={
                                  supply.key
                                }

                                className={
                                  styles.supply
                                }
                              >

                                <div
                                  className={
                                    styles.supplyMain
                                  }
                                >

                                  <div
                                    className={
                                      styles.identity
                                    }
                                  >

                                    <div
                                      className={
                                        styles.number
                                      }
                                    >
                                      {
                                        supply.number
                                      }
                                    </div>


                                    {
                                      supply.secondaryNumber
                                        ? (
                                          <div
                                            className={
                                              styles.secondary
                                            }
                                          >
                                            {
                                              supply.secondaryNumber
                                            }
                                          </div>
                                        )
                                        : null
                                    }


                                    <span
                                      className={
                                        `${styles.status} ${
                                          supply.isTerminal
                                            ? styles.statusTerminal
                                            : styles.statusActive
                                        }`
                                      }
                                    >
                                      {
                                        supply.statusLabel
                                      }
                                    </span>

                                  </div>


                                  <SupplyFact
                                    label="Дата / тайм-слот"
                                    value={
                                      formatTimeslot(
                                        supply.timeslotFrom,
                                        supply.timeslotTo
                                      )
                                    }
                                  />


                                  <SupplyFact
                                    label="Куда"
                                    value={
                                      supply.destinationName
                                      ??
                                      "—"
                                    }
                                    hint={
                                      supply.destinationAddress
                                      ??
                                      undefined
                                    }
                                  />


                                  <SupplyFact
                                    label="Транзит / точка сдачи"
                                    value={
                                      supply.transitName
                                      ??
                                      supply.dropoffName
                                      ??
                                      "—"
                                    }
                                  />


                                  <SupplyFact
                                    label="Состав"
                                    value={
                                      supply.plannedUnits !==
                                        null
                                      &&
                                      supply.plannedUnits !==
                                        undefined
                                        ? `${formatNumber(
                                            supply.plannedUnits
                                          )} шт.`
                                        : "открыть"
                                    }
                                    hint={
                                      supply.acceptedUnits !==
                                        null
                                      &&
                                      supply.acceptedUnits !==
                                        undefined
                                        ? `Принято: ${formatNumber(
                                            supply.acceptedUnits
                                          )}`
                                        : undefined
                                    }
                                  />


                                  <SupplyFact
                                    label="Грузоместа"
                                    value={
                                      getCargoLabel(
                                        supply
                                      )
                                    }
                                  />


                                  <button
                                    type="button"

                                    className={
                                      styles.detailButton
                                    }

                                    onClick={
                                      () => {
                                        void toggleSupply(
                                          supply
                                        );
                                      }
                                    }
                                  >
                                    {
                                      expanded
                                        ? "Скрыть"
                                        : "Состав и грузоместа"
                                    }
                                  </button>

                                </div>


                                {
                                  expanded
                                    ? (

                                      <SupplyDetailBlock
                                        state={
                                          detail
                                        }
                                      />

                                    )
                                    : null
                                }

                              </article>

                            );

                          }
                        )
                      }

                    </div>

                  )
              }


              {
                data?.updatedAt
                  ? (
                    <div
                      className={
                        styles.updated
                      }
                    >
                      Получено с маркетплейса:{" "}
                      {
                        formatDateTime(
                          data.updatedAt
                        )
                      }
                    </div>
                  )
                  : null
              }

            </>

          )
          : null
      }

            </div>
          )
          : null
      }

    </section>

  );

}


function SummaryFact({
  label,
  value,
  wide =
    false,
}: {
  label:
    string;

  value:
    string;

  wide?:
    boolean;
}) {

  return (

    <div
      className={
        wide
          ? `${styles.summaryFact} ${styles.summaryFactWide}`
          : styles.summaryFact
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>

  );

}


function SupplyFact({
  label,
  value,
  hint,
}: {
  label:
    string;

  value:
    string;

  hint?:
    string;
}) {

  return (

    <div
      className={
        styles.fact
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {
        hint
          ? (
            <small>
              {hint}
            </small>
          )
          : null
      }
    </div>

  );

}


function SupplyDetailBlock({
  state,
}: {
  state:
    DetailState
    |
    undefined;
}) {

  if (
    !state
    ||
    state.loading
  ) {

    return (
      <div
        className={
          styles.detailLoading
        }
      >
        Получаем состав и грузоместа...
      </div>
    );

  }


  if (
    state.error
  ) {

    return (
      <div
        className={
          styles.detailError
        }
      >
        {
          state.error
        }
      </div>
    );

  }


  const detail =
    state.data;


  if (!detail) {

    return null;

  }


  return (

    <div
      className={
        styles.detail
      }
    >

      <div
        className={
          styles.detailColumn
        }
      >

        <h3>
          Состав поставки
        </h3>


        {
          detail.items.length ===
            0
            ? (
              <div
                className={
                  styles.emptyDetail
                }
              >
                Состав не передан API для этой стадии поставки.
              </div>
            )
            : (

              <div
                className={
                  styles.tableWrap
                }
              >
                <table
                  className={
                    styles.table
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        SKU / артикул
                      </th>

                      <th>
                        Товар
                      </th>

                      <th>
                        Баркод
                      </th>

                      <th>
                        План
                      </th>

                      <th>
                        Принято
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {
                      detail.items.map(
                        (
                          item,
                          index
                        ) => (
                          <tr
                            key={
                              [
                                item.sku,
                                item.offerId,
                                item.barcode,
                                index,
                              ].join(
                                ":"
                              )
                            }
                          >
                            <td>
                              {
                                item.offerId
                                ??
                                item.sku
                                ??
                                "—"
                              }
                            </td>

                            <td>
                              {
                                item.name
                                ??
                                "—"
                              }
                            </td>

                            <td>
                              {
                                item.barcode
                                ??
                                "—"
                              }
                            </td>

                            <td>
                              {
                                formatNumber(
                                  item.plannedQuantity
                                )
                              }
                            </td>

                            <td>
                              {
                                formatNumber(
                                  item.acceptedQuantity
                                )
                              }
                            </td>
                          </tr>
                        )
                      )
                    }
                  </tbody>
                </table>
              </div>

            )
        }

      </div>


      <div
        className={
          styles.detailColumn
        }
      >

        <h3>
          Грузоместа
        </h3>


        {
          detail.cargoPlaces.length ===
            0
            ? (
              <div
                className={
                  styles.emptyDetail
                }
              >
                Грузоместа ещё не сформированы или API их не возвращает.
              </div>
            )
            : (

              <div
                className={
                  styles.cargoList
                }
              >
                {
                  detail.cargoPlaces.map(
                    cargo => (
                      <div
                        key={
                          cargo.id
                        }

                        className={
                          styles.cargo
                        }
                      >
                        <div>
                          <strong>
                            {
                              cargo.type
                            }
                          </strong>

                          <span>
                            {
                              cargo.barcode
                              ??
                              cargo.id
                            }
                          </span>
                        </div>


                        {
                          cargo.quantity !==
                            null
                          &&
                          cargo.quantity !==
                            undefined
                            ? (
                              <strong>
                                {
                                  formatNumber(
                                    cargo.quantity
                                  )
                                } шт.
                              </strong>
                            )
                            : null
                        }


                        {
                          cargo.description
                            ? (
                              <small>
                                {
                                  cargo.description
                                }
                              </small>
                            )
                            : null
                        }
                      </div>
                    )
                  )
                }
              </div>

            )
        }


        {
          detail.notes
          &&
          detail.notes.length >
            0
            ? (
              <div
                className={
                  styles.notes
                }
              >
                {
                  detail.notes.map(
                    (
                      note,
                      index
                    ) => (
                      <div
                        key={
                          `${index}:${note}`
                        }
                      >
                        {note}
                      </div>
                    )
                  )
                }
              </div>
            )
            : null
        }

      </div>

    </div>

  );

}
