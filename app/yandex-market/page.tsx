import Link from "next/link";

import ThemeToggle from "../ThemeToggle";

export const dynamic = "force-dynamic";


// ============================================================
// ТИПЫ
// ============================================================

type RawYandexProduct = {
  offer?: {
    offerId?: string;
    name?: string;
    vendor?: string;
    vendorCode?: string;
    barcodes?: string[];
  };

  mapping?: {
    // ВАЖНО:
    // marketSku храним строкой,
    // потому что некоторые Product ID Яндекса
    // превышают Number.MAX_SAFE_INTEGER.
    marketSku?: string;

    marketSkuName?: string;
    marketModelName?: string;
    marketCategoryId?: number;
    marketCategoryName?: string;
  };
};


type YandexProductRow = {
  id: number;

  offer_id: string;

  // В Supabase market_sku теперь TEXT.
  market_sku: string | null;

  market_category_name: string | null;

  master_code: string | null;

  first_seen_at: string;

  last_seen_at: string;

  is_active: boolean;

  raw_data: RawYandexProduct | null;

  created_at: string;

  updated_at: string;
};


// ============================================================
// НАСТРОЙКИ SUPABASE
// ============================================================

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    ||
    process.env.SUPABASE_URL?.trim();

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY?.trim()
    ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );
  }

  if (!supabaseSecretKey) {
    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return {
    supabaseUrl,
    supabaseSecretKey,
  };
}


// ============================================================
// ЗАГРУЗКА ТОВАРОВ
// ============================================================

async function getYandexProducts():
Promise<YandexProductRow[]> {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } = getSupabaseConfig();

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_products`
    );

  url.searchParams.set(
    "select",
    [
      "id",
      "offer_id",
      "market_sku",
      "market_category_name",
      "master_code",
      "first_seen_at",
      "last_seen_at",
      "is_active",
      "raw_data",
      "created_at",
      "updated_at",
    ].join(",")
  );

  url.searchParams.set(
    "order",
    "offer_id.asc"
  );

  url.searchParams.set(
    "limit",
    "5000"
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase yandex_products: HTTP ${response.status}: ${text}`
    );
  }

  return JSON.parse(
    text
  ) as YandexProductRow[];
}


// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatDateTimeKrasnoyarsk(
  value:
    string
    | null
    | undefined
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

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

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",
    }
  ).format(date);
}


function formatNumber(
  value: number
): string {
  return new Intl.NumberFormat(
    "ru-RU"
  ).format(value);
}


function getProductName(
  product: YandexProductRow
): string {
  const offerName =
    product.raw_data
      ?.offer
      ?.name
      ?.trim();

  if (offerName) {
    return offerName;
  }

  const marketName =
    product.raw_data
      ?.mapping
      ?.marketSkuName
      ?.trim();

  if (marketName) {
    return marketName;
  }

  return "—";
}


function getLatestSync(
  products: YandexProductRow[]
): string | null {
  if (
    products.length ===
    0
  ) {
    return null;
  }

  let latest:
    string | null =
    null;

  let latestTime =
    0;

  for (
    const product
    of products
  ) {
    const time =
      new Date(
        product.last_seen_at
      ).getTime();

    if (
      Number.isFinite(time)
      &&
      time > latestTime
    ) {
      latestTime =
        time;

      latest =
        product.last_seen_at;
    }
  }

  return latest;
}


// ============================================================
// СТРАНИЦА
// ============================================================

export default async function YandexMarketPage() {
  let products:
    YandexProductRow[] =
    [];

  let loadError:
    string | null =
    null;

  try {
    products =
      await getYandexProducts();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  const latestSync =
    getLatestSync(
      products
    );

  const activeProducts =
    products.filter(
      (
        product
      ) =>
        product.is_active
    );

  const productsWithMarketSku =
    products.filter(
      (
        product
      ) =>
        product.market_sku !==
        null
        &&
        product.market_sku.trim() !==
        ""
    );

  const unlinkedProducts =
    products.filter(
      (
        product
      ) =>
        !product.master_code
        ||
        product.master_code
          .trim() ===
          ""
    );

  const categories =
    new Set(
      products
        .map(
          (
            product
          ) =>
            product
              .market_category_name
              ?.trim()
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    );

  const sortedProducts =
    [...products]
      .sort(
        (
          a,
          b
        ) => {
          const aUnlinked =
            !a.master_code
            ||
            a.master_code
              .trim() ===
              "";

          const bUnlinked =
            !b.master_code
            ||
            b.master_code
              .trim() ===
              "";

          if (
            aUnlinked
            !==
            bUnlinked
          ) {
            return aUnlinked
              ? -1
              : 1;
          }

          return a.offer_id
            .localeCompare(
              b.offer_id,
              "ru"
            );
        }
      );

  return (
    <main className="page">
      <div className="container">

        {/* ===================================
            HEADER
            =================================== */}

        <header className="header">
          <div>
            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>

            <h1 className="title">
              Яндекс Маркет — синхронизация
            </h1>

            <p className="subtitle">
              Товары каталога и подготовка
              данных FBY Яндекс Маркета.
            </p>
          </div>

          <div className="header-actions">
            <ThemeToggle />

            <Link
              href="/stock-import"
              className=
                "secondary-button navigation-button"
            >
              Остатки склада
            </Link>

            <Link
              href="/"
              className=
                "secondary-button navigation-button"
            >
              ← Главная
            </Link>
          </div>
        </header>


        {/* ===================================
            ОШИБКА
            =================================== */}

        {
          loadError
            ? (
              <section className="section">
                <h2 className="section-title">
                  Ошибка загрузки данных
                  Яндекс Маркета
                </h2>

                <div
                  className="reason-text"
                  style={{
                    color:
                      "#b42318",
                  }}
                >
                  {loadError}
                </div>
              </section>
            )
            : null
        }


        {/* ===================================
            СОСТОЯНИЕ СИНХРОНИЗАЦИИ
            =================================== */}

        <section className="section">
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "flex-start",

              gap:
                "16px",

              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2 className="section-title">
                Состояние синхронизации
              </h2>

              <div className="reason-text">
                Последняя успешная загрузка
                каталога товаров из
                Яндекс Маркета.
              </div>
            </div>

            <div
              style={{
                padding:
                  "8px 12px",

                borderRadius:
                  "999px",

                background:
                  latestSync
                    ? "#ecfdf3"
                    : "#fff4ed",

                color:
                  latestSync
                    ? "#027a48"
                    : "#b54708",

                fontSize:
                  "13px",

                fontWeight:
                  700,
              }}
            >
              {
                latestSync
                  ? "Успешно"
                  : "Нет успешной загрузки"
              }
            </div>
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",

              gap:
                "16px",

              marginTop:
                "20px",
            }}
          >
            <InfoCard
              label=
                "Последняя синхронизация"

              value=
                {
                  formatDateTimeKrasnoyarsk(
                    latestSync
                  )
                }

              hint=
                "Красноярское время"
            />

            <InfoCard
              label=
                "Товаров каталога"

              value=
                {
                  formatNumber(
                    products.length
                  )
                }

              hint=
                "строк yandex_products"
            />

            <InfoCard
              label=
                "Активных товаров"

              value=
                {
                  formatNumber(
                    activeProducts.length
                  )
                }

              hint=
                "is_active = true"
            />

            <InfoCard
              label=
                "Product ID"

              value=
                {
                  formatNumber(
                    productsWithMarketSku
                      .length
                  )
                }

              hint=
                "есть marketSku"
            />

            <InfoCard
              label=
                "Без master_code"

              value=
                {
                  formatNumber(
                    unlinkedProducts.length
                  )
                }

              hint=
                "требуют привязки"
            />
          </div>
        </section>


        {/* ===================================
            КАК СВЕРЯТЬ
            =================================== */}

        <section className="section">
          <h2 className="section-title">
            Как сверять с кабинетом
            Яндекс Маркета
          </h2>

          <div className="reason-text">
            Артикул — offerId продавца,
            полученный из каталога
            Яндекс Маркета.
          </div>

          <div className="reason-text">
            Product ID — marketSku.
            Он хранится как текст,
            чтобы длинные идентификаторы
            Яндекса не округлялись.
          </div>

          <div className="reason-text">
            Категория — категория
            сопоставленной карточки
            Яндекс Маркета.
          </div>

          <div className="reason-text">
            Остатки, оборачиваемость,
            продажи и поставки
            подключим отдельными
            источниками API.
          </div>
        </section>


        {/* ===================================
            KPI КАТАЛОГА
            =================================== */}

        <section className="section">
          <h2 className="section-title">
            Каталог
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",

              gap:
                "16px",

              marginTop:
                "16px",
            }}
          >
            <InfoCard
              label=
                "Категорий"

              value=
                {
                  formatNumber(
                    categories.size
                  )
                }

              hint=
                "уникальных категорий Маркета"
            />

            <InfoCard
              label=
                "Привязано к master_code"

              value=
                {
                  formatNumber(
                    products.length
                    -
                    unlinkedProducts.length
                  )
                }

              hint=
                "физические товары"
            />

            <InfoCard
              label=
                "Требуют привязки"

              value=
                {
                  formatNumber(
                    unlinkedProducts.length
                  )
                }

              hint=
                "пока не участвуют в общей номенклатуре"
            />
          </div>
        </section>


        {/* ===================================
            ТОВАРЫ БЕЗ MASTER_CODE
            =================================== */}

        <section className="section">
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "flex-start",

              gap:
                "16px",

              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2 className="section-title">
                Товары без master_code
              </h2>

              <div className="reason-text">
                Товары Яндекс Маркета,
                которые пока не связаны
                с физическим товаром
                в общей номенклатуре.
              </div>
            </div>

            <div
              style={{
                padding:
                  "8px 12px",

                borderRadius:
                  "999px",

                background:
                  unlinkedProducts.length
                    ? "#fff4ed"
                    : "#ecfdf3",

                color:
                  unlinkedProducts.length
                    ? "#b54708"
                    : "#027a48",

                fontSize:
                  "13px",

                fontWeight:
                  700,
              }}
            >
              {
                unlinkedProducts.length
                  ? `Требуют привязки: ${unlinkedProducts.length}`
                  : "Все товары привязаны"
              }
            </div>
          </div>

          {
            unlinkedProducts.length
              ? (
                <ProductsTable
                  products=
                    {
                      unlinkedProducts
                    }

                  compact
                />
              )
              : (
                <div
                  className="reason-text"
                  style={{
                    marginTop:
                      "16px",
                  }}
                >
                  Непривязанных товаров нет.
                </div>
              )
          }
        </section>


        {/* ===================================
            ВСЕ ТОВАРЫ
            =================================== */}

        <section className="section">
          <h2 className="section-title">
            Данные по товарам
          </h2>

          <div className="reason-text">
            Текущий каталог,
            полученный через
            offer-mappings.
          </div>

          <div className="reason-text">
            Сейчас показываем только
            те данные, которые уже
            подтверждены API.
          </div>

          <ProductsTable
            products=
              {
                sortedProducts
              }
          />
        </section>


        {/* ===================================
            БЕЗОПАСНЫЙ РЕЖИМ
            =================================== */}

        <section className="section">
          <h2 className="section-title">
            Безопасный режим
          </h2>

          <div className="reason-text">
            Система получает каталог
            Яндекс Маркета через
            серверный API route.
          </div>

          <div className="reason-text">
            API-ключ Яндекс Маркета
            не передаётся в браузер
            пользователя.
          </div>

          <div className="reason-text">
            Ошибка API не должна
            превращаться в удаление
            или обнуление уже
            сохранённых товаров.
          </div>

          <div className="reason-text">
            Полный исходный ответ
            по товару сохраняется
            в raw_data для проверки
            и дальнейшего развития
            интеграции.
          </div>
        </section>

      </div>
    </main>
  );
}


// ============================================================
// INFO CARD
// ============================================================

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="card-label">
        {label}
      </div>

      <div
        style={{
          fontSize:
            "18px",

          fontWeight:
            700,

          marginTop:
            "6px",
        }}
      >
        {value}
      </div>

      {
        hint
          ? (
            <div
              className="muted"
              style={{
                marginTop:
                  "5px",
              }}
            >
              {hint}
            </div>
          )
          : null
      }
    </div>
  );
}


// ============================================================
// ТАБЛИЦА
// ============================================================

function ProductsTable({
  products,
  compact = false,
}: {
  products:
    YandexProductRow[];

  compact?: boolean;
}) {
  return (
    <div
      style={{
        marginTop:
          "18px",

        overflowX:
          "auto",

        border:
          "1px solid var(--table-divider, #282e38)",

        borderRadius:
          "10px",
      }}
    >
      <table
        style={{
          width:
            "100%",

          minWidth:
            compact
              ? "900px"
              : "1050px",

          borderCollapse:
            "separate",

          borderSpacing:
            0,
        }}
      >
        <thead>
          <tr
            style={{
              background:
                "var(--table-header-bg, #1b2028)",
            }}
          >
            <TableHeader>
              Артикул
            </TableHeader>

            <TableHeader>
              Product ID
            </TableHeader>

            <TableHeader>
              Товар
            </TableHeader>

            <TableHeader>
              Категория
            </TableHeader>

            <TableHeader>
              master_code
            </TableHeader>

            {
              !compact
                ? (
                  <>
                    <TableHeader>
                      Статус
                    </TableHeader>

                    <TableHeader>
                      Последняя синхронизация
                    </TableHeader>
                  </>
                )
                : null
            }
          </tr>
        </thead>

        <tbody>
          {
            products.map(
              (
                product,
                index
              ) => {
                const isLast =
                  index ===
                  products.length - 1;

                const divider =
                  isLast
                    ? "none"
                    : "1px solid var(--table-divider, #282e38)";

                const linked =
                  Boolean(
                    product.master_code
                      ?.trim()
                  );

                return (
                  <tr
                    key={
                      product.id
                    }
                  >
                    <TableCell
                      divider=
                        {divider}

                      strong
                    >
                      {
                        product
                          .offer_id
                      }
                    </TableCell>

                    <TableCell
                      divider=
                        {divider}

                      numeric
                    >
                      {
                        product
                          .market_sku
                        ??
                        "—"
                      }
                    </TableCell>

                    <TableCell
                      divider=
                        {divider}
                    >
                      {
                        getProductName(
                          product
                        )
                      }
                    </TableCell>

                    <TableCell
                      divider=
                        {divider}
                    >
                      {
                        product
                          .market_category_name
                        ||
                        "—"
                      }
                    </TableCell>

                    <TableCell
                      divider=
                        {divider}

                      strong=
                        {linked}
                    >
                      {
                        product
                          .master_code
                        ||
                        "—"
                      }
                    </TableCell>

                    {
                      !compact
                        ? (
                          <>
                            <TableCell
                              divider=
                                {divider}
                            >
                              <StatusBadge
                                linked=
                                  {linked}
                              />
                            </TableCell>

                            <TableCell
                              divider=
                                {divider}
                            >
                              {
                                formatDateTimeKrasnoyarsk(
                                  product
                                    .last_seen_at
                                )
                              }
                            </TableCell>
                          </>
                        )
                        : null
                    }
                  </tr>
                );
              }
            )
          }
        </tbody>
      </table>
    </div>
  );
}


// ============================================================
// HEADER CELL
// ============================================================

function TableHeader({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          "left",

        fontSize:
          "12px",

        fontWeight:
          700,

        color:
          "var(--text-secondary, #b8c0cc)",

        border:
          "none",

        borderBottom:
          "1px solid var(--table-divider, #282e38)",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>
  );
}


// ============================================================
// TABLE CELL
// ============================================================

function TableCell({
  children,
  divider,
  strong = false,
  numeric = false,
}: {
  children:
    React.ReactNode;

  divider:
    string;

  strong?: boolean;

  numeric?: boolean;
}) {
  return (
    <td
      style={{
        padding:
          "11px 14px",

        border:
          "none",

        borderBottom:
          divider,

        verticalAlign:
          "top",

        fontSize:
          "12px",

        fontWeight:
          strong
            ? 700
            : 500,

        textAlign:
          numeric
            ? "right"
            : "left",

        whiteSpace:
          numeric
            ? "nowrap"
            : "normal",
      }}
    >
      {children}
    </td>
  );
}


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({
  linked,
}: {
  linked:
    boolean;
}) {
  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "5px 8px",

        borderRadius:
          "999px",

        background:
          linked
            ? "#ecfdf3"
            : "#fff4ed",

        color:
          linked
            ? "#027a48"
            : "#b54708",

        fontSize:
          "11px",

        fontWeight:
          700,

        whiteSpace:
          "nowrap",
      }}
    >
      {
        linked
          ? "Привязан"
          : "Без master_code"
      }
    </span>
  );
}
